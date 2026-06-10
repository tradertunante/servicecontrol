# ServiceControl — Revisión de arquitectura (2026-06-09)

Alcance: codebase completo (482 módulos TS/TSX analizados, 82 route handlers, 97 migraciones, 2 Edge Functions).
Nota previa: ServiceControl **no es un sistema multi-agente en runtime** — es un monolito Next.js 13 (App Router) + Supabase. Los archivos `AGENTS.md`, `.agents/` y `.claude/agents/` son tooling de desarrollo (agentes de Claude Code), no componentes de la aplicación. Este informe mapea los "agentes" como **actores arquitectónicos del sistema**.

---

## 1. Mapa de arquitectura (actores + relaciones)

### Actores del sistema

| # | Actor | Responsabilidad | Entradas | Salidas | Dependencias |
|---|-------|----------------|----------|---------|--------------|
| 1 | **Edge Middleware** (`middleware.ts`) | Rate limit, CORS, secreto superadmin, guard de presencia de token, i18n marketing | Toda request (matcher manual de 23 rutas) | `NextResponse` (next/redirect/403/429) | `lib/api/rateLimit`, `lib/logger`, `i18n/routing` |
| 2 | **Cliente browser** (`lib/supabaseClient.ts`) | Acceso a datos con sesión de usuario, sujeto a RLS | Sesión localStorage | Queries PostgREST + Storage | Supabase anon key. Usado directamente por **54 archivos** cliente |
| 3 | **Cliente con token** (`lib/supabaseServer.ts` → `supabaseWithToken`) | Validar identidad server-side respetando RLS | Token (cookie `sc-access-token` o Bearer) | `auth.getUser`, queries RLS | anon key |
| 4 | **Cliente admin** (`lib/supabaseAdmin.ts`) | Acceso service-role (bypasea RLS), singleton | — | Queries sin restricción | `SUPABASE_SERVICE_ROLE_KEY`. Usado por **67 de 82** routes |
| 5 | **Capa de autorización** (`lib/auth/server.ts`, `lib/auth/permissions.tsx`) | `authorizeRouteRequest`, `requirePageAccess`, scoping hotel/área, matriz rol→permiso | Token + cookies (`HOTEL_SCOPE`) | `AuthContext`, redirects, scoping | Actores 3 y 4. **Importada por casi todo el backend — guardián único** |
| 6 | **Route handlers** (`app/api/**`, 82 rutas) | API de dominio: audits, areas, members, trainings, admin, superadmin, billing, trial, reports, notifications | HTTP + token | JSON (`jsonOk`/`jsonError`/`jsonDbError`) | Actores 4, 5, RPCs Postgres, email, AI |
| 7 | **RPCs Postgres** (97 migraciones) | Transacciones atómicas: `submit_audit_run`, `get_audit_run_full`, `start_audit_run`, `rpc_team_summary` (v1/v2/wrapper), flujos atómicos secundarios | Args RPC | Filas/JSON | Schema + RLS helpers |
| 8 | **Edge Functions Supabase** | `auth-email-hook` (421 líneas, emails de auth — invocada por Supabase Auth) · `create-user` (95 líneas, **muerta**, 0 referencias, roles desactualizados) | Webhooks Supabase | Emails / usuario creado | Deno, service key |
| 9 | **Cron jobs Vercel** (`vercel.json`) | `send-weekly` (lun 8h), `send-monthly` (día 1), `trainings/generate-suggestions` (lun 9h) | GET de Vercel cron | Emails + sugerencias IA | Actores 6, 10, 11. **Rotos — ver C-1** |
| 10 | **Email** (`lib/email/*`, Resend) | Welcome, role-change, instant audit, weekly/monthly report, mystery shopper, trial | Datos de dominio | Emails vía API Resend | `RESEND_API_KEY`; `lib/notifications/notificationSettings` |
| 11 | **IA** (`lib/reports/generateNarrative.ts`, `app/api/trainings/generate-suggestions`, `lib/ai/costLogger.ts`) | Narrativas de reportes y sugerencias de formación; log de costes en `api_cost_logs` | Datos agregados de auditorías | Texto/JSON estructurado | `@anthropic-ai/sdk` (**en devDependencies — ver C-4**) |
| 12 | **Billing** (`lib/billing/*`, `lib/stripe.ts`, `app/api/billing/*`) | Checkout, portal, status, webhook (firma verificada + idempotencia vía `billing_events`), enforcement | Stripe events / usuario | Subscripciones, límites | Stripe SDK, actor 4 |
| 13 | **Shells UI** | `app/(app)` (autenticado, ~42 páginas), `app/superadmin` (cross-hotel), `app/(marketing)` + `app/[locale]` (público i18n), `app/help`, `app/formaciones/registro` (QR público) | Sesión / token QR | React Server + Client Components (169 archivos `"use client"`) | Actores 2, 5, 6 |
| 14 | **Sync de sesión** (`AuthSessionSync.tsx` + `/api/auth/sync-session`) | Replicar access token de localStorage a cookie httpOnly tras login/refresh | `onAuthStateChange` | Cookie `sc-access-token` | Actores 1, 2 |
| 15 | **Observabilidad** | `lib/logger.ts` (Logtail/Better Stack + consola), Sentry (client/server/edge), PostHog (provider cliente) | Eventos | Logs/traces externos | Tokens env, degradación correcta si faltan |
| 16 | **Scripts ops** (`scripts/`) | Notion posts, Brevo sync, Stripe lookup keys | CLI manual | Side effects externos | Tokens manuales |

### Relaciones (flujo principal)

```
Browser ──(sesión RLS)──────────► Supabase Postgres/Storage     [path 1: directo, 54 archivos]
Browser ──HTTP──► Middleware ──► Route handler ──authorizeRouteRequest──► supabaseAdmin ──► Postgres  [path 2: API]
AuthSessionSync ──POST /api/auth/sync-session──► cookie httpOnly ──► SSR guards (requirePageAccess)
Vercel cron ──GET──► /api/reports/send-* ✗ (roto)  ──► generateNarrative (Anthropic) ──► Resend
Stripe ──webhook firmado──► /api/billing/webhook ──► billing_events / billing_accounts
Supabase Auth ──hook──► Edge Fn auth-email-hook ──► emails de auth
```

### Dependencias circulares

**Ninguna a nivel de módulos** (madge sobre 482 archivos: `✔ No circular dependency found`). Sí existe un acoplamiento atípico: `app/api/user-management/users/route.ts` y `delete-user/route.ts` **re-exportan handlers de otras rutas** (`export { GET } from "@/app/api/admin/users/route"`), acoplando rutas entre sí (ver Q-5).

### Puntos únicos de fallo (SPOF)

| SPOF | Riesgo | Severidad |
|------|--------|-----------|
| `lib/auth/server.ts` — único guardián de 67 rutas que operan con service-role (RLS bypaseado en el path API). Un bug aquí = exposición cross-hotel | Diseño: la seguridad multi-tenant del path API depende 100% de código de aplicación | **HIGH** |
| Middleware como única capa de rate-limit/CORS, con matcher **manual** — rutas nuevas no listadas quedan fuera (`/otros` y `/mystery-shopper` ya faltan) | Olvido humano al añadir rutas | **MEDIUM** |
| `AuthSessionSync` (cliente) como único mecanismo que mantiene la cookie httpOnly fresca — si el POST falla, SSR redirige a login con sesión válida en localStorage | UX degradada, difícil de diagnosticar | **MEDIUM** |
| Proveedores externos sin fallback: Resend (emails), Anthropic (narrativas/sugerencias), Stripe | Indisponibilidad parcial de features | **LOW-MEDIUM** |
| Un único proyecto Supabase (DB+Auth+Storage) para todos los tenants | Normal en SaaS de esta etapa; mitigar con backups/PITR | **LOW** |

---

## 2. Problemas críticos (resolver antes de escalar)

### C-1 · CRITICAL — Los 3 cron jobs de Vercel no pueden ejecutarse
- `vercel.json` define crons para `/api/reports/send-weekly`, `/api/reports/send-monthly` y `/api/trainings/generate-suggestions`.
- Vercel cron invoca con **GET** y autentica con header `Authorization: Bearer ${CRON_SECRET}`.
- Las tres rutas solo exportan **POST** ([send-weekly/route.ts:15](app/api/reports/send-weekly/route.ts#L15), [send-monthly/route.ts:15](app/api/reports/send-monthly/route.ts#L15), [generate-suggestions/route.ts:338](app/api/trainings/generate-suggestions/route.ts#L338)) → el cron recibe **405** siempre.
- Además validan el header `x-cron-secret`, que Vercel no envía.
- **Consecuencia**: reportes semanales/mensuales y sugerencias IA solo salen si alguien los dispara manualmente. Coincide con el pendiente "Envío automático de reportes por email" — la causa raíz es esta.
- **Fix**: exportar `GET` que valide `Authorization: Bearer ${CRON_SECRET}` (y mantener `POST` para disparo manual de admin).

### C-2 · HIGH — Rate limiting in-memory inservible en Vercel a escala
- [lib/api/rateLimit.ts:1-8](lib/api/rateLimit.ts#L1-L8) lo documenta él mismo: el `Map` no se comparte entre instancias edge/serverless. Con tráfico real cada instancia tiene su propio contador → el límite efectivo es `100 × nº instancias`.
- Peor: el límite de auth (5 req/min/IP) aplica a `/api/auth/sync-session`, que **cada usuario llama en login y en cada refresh de token**. Los hoteles comparten IP (NAT del WiFi corporativo): 6+ empleados refrescando en el mismo minuto → 429 → cookies httpOnly desincronizadas → logouts fantasma en SSR.
- **Fix**: Upstash Redis/Vercel KV para el limiter, y keyear auth por `IP+user-id` o subir el límite de `sync-session`.

### C-3 · HIGH — 67/82 rutas usan service-role: la autorización multi-tenant vive solo en TypeScript
- Solo 2 rutas usan `supabaseWithToken` para queries; el resto valida con `authorizeRouteRequest` y luego opera con `supabaseAdmin()` (RLS bypaseado).
- El RLS existe y está cuidado (migraciones de hardening), pero **solo protege el path browser**. En el path API, cualquier ruta que olvide filtrar por `hotel_id` filtra datos cross-hotel sin que la base de datos lo impida.
- **Fix recomendado** (no reescribir todo): (a) tests de autorización por ruta (hoy hay 3 archivos de test en total), (b) helper único que devuelva un query builder ya scoped a `hotelId`, (c) usar `supabaseWithToken` donde no se necesite privilegio admin.

### C-4 · HIGH — `@anthropic-ai/sdk` está en `devDependencies` pero se importa en runtime
- [package.json](package.json): `"devDependencies": { "@anthropic-ai/sdk": "^0.97.1", "vitest": ... }`.
- Importado en producción: [lib/reports/generateNarrative.ts:3](lib/reports/generateNarrative.ts#L3) y [generate-suggestions/route.ts:3](app/api/trainings/generate-suggestions/route.ts#L3).
- Hoy funciona porque Vercel instala devDeps en build y Next bundlea, pero cualquier pipeline con `npm ci --omit=dev`, migración a pnpm/turbo o build standalone romperá las features de IA en silencio.
- **Fix**: moverlo a `dependencies` (1 línea).

### C-5 · HIGH — Cobertura de tests casi nula para un sistema con autorización app-level
- 3 archivos en `__tests__/` (rateLimit, dashboardUtils, validate). Cero tests sobre `lib/auth/server.ts`, scoping de hotel/área, RPCs de submit, billing enforcement.
- Dado C-3, esto es el multiplicador de riesgo número uno antes de escalar equipo o tenants.

### C-6 · MEDIUM-HIGH — Bucket `audit-photos` público
- [20260605110000_make_audit_photos_bucket_public.sql](supabase/migrations/20260605110000_make_audit_photos_bucket_public.sql) hizo público el bucket para que `<img>` renderice.
- Los nombres (`${runId}_${questionId}_${timestamp}.ext`, [useAuditAnswers.ts:180](app/(app)/audits/[id]/_hooks/useAuditAnswers.ts#L180)) son prácticamente inadivinables, pero cualquier URL que se filtre (email reenviado, reporte compartido, logs) expone evidencia fotográfica del hotel para siempre y sin revocación.
- **Fix**: volver a bucket privado + `createSignedUrl` (o signed URLs de larga duración cacheadas en el RPC `get_audit_run_full`).

### C-7 · HIGH — Next.js 13.5.1 (sept 2023) y React 18.2
- Tres major versions por detrás; sin parches de seguridad activos para 13.x; bloquea mejoras (Server Actions estables, caching moderno, `next-intl` actualizado). Cuanto más crezca el código, más cara la migración. Planificarla ya.

---

## 3. Mejoras estructurales (prioridad media)

### S-1 · MEDIUM — Doble vía de acceso a datos sin criterio explícito
54 archivos cliente consultan Supabase directamente (RLS) mientras existen 82 rutas API para lo mismo en otros flujos (p. ej. `app/(app)/team/_hooks/useTeamData.ts` directo vs `/api/team/...`). Dos modelos de seguridad, dos formas de error, doble mantenimiento. Definir la regla (sugerencia: lecturas simples vía RLS, escrituras y agregaciones vía API) y documentarla en `ARCHITECTURE.md`.

### S-2 · MEDIUM — 16 rutas sin `try/catch` → excepciones no capturadas = 500 opaco sin log estructurado
Afecta entre otras a [billing/portal](app/api/billing/portal/route.ts), [billing/status](app/api/billing/status/route.ts), [audits/[id]/full](app/api/audits/[id]/full/route.ts), [audit-runs/[id]](app/api/audit-runs/[id]/route.ts), [departments/backlog](app/api/departments/backlog/route.ts), [my/area-access](app/api/my/area-access/route.ts). Un `withErrorHandler(handler)` wrapper unificaría logging (`logger.error`) + respuesta segura, y eliminaría la deriva entre rutas con/sin catch.

### S-3 · MEDIUM — `requireActiveHotel` lanza `Error` genérico
[lib/auth/server.ts:140-150](lib/auth/server.ts#L140-L150): en un route handler sin catch (ver S-2) se convierte en 500 en lugar de 400/403 con mensaje controlado. Devolver `ScopedHotelResult` como hacen sus hermanos.

### S-4 · MEDIUM — Matcher del middleware mantenido a mano
[middleware.ts:163-189](middleware.ts#L163-L189) enumera 23 prefijos; `/otros` y `/mystery-shopper` ya no están (sus páginas se salvan por guard server-side, pero pierden rate-limit-redirect y es un patrón frágil). Invertir la lógica: matchear todo y mantener una lista de **públicas**, o al menos test que compare matcher vs directorios de `app/(app)`.

### S-5 · MEDIUM — Crons procesan hoteles secuencialmente con llamadas IA por área
`send-weekly` itera hoteles → áreas → `generateReportNarrative` (Anthropic) → email, todo en una invocación. Con decenas de hoteles excederá el timeout de la función. Trocear por hotel (fan-out con `waitUntil`, cola, o cron por lotes con cursor).

### S-6 · MEDIUM — 97 migraciones con alta deriva: mismos RPCs redeplegados 4-6 veces
`submit_audit_run` (5 versiones), `rpc_team_summary` (v1, v2, wrapper compat, 4 fixes), más una migración de debug en histórico ([20260426120000_debug_submit_exception.sql](supabase/migrations/20260426120000_debug_submit_exception.sql)). Extraer los RPCs a archivos fuente versionados (patrón "declarative schema" de Supabase o carpeta `supabase/functions_sql/`) y que la migración solo haga `create or replace` desde ahí; valorar squash de baseline.

### S-7 · MEDIUM — Componentes y hooks repartidos en 3 ubicaciones cada uno
Componentes: `components/`, `app/components/`, `app/(app)/_components` (+ colocación por ruta, que está bien). Hooks: `hooks/`, `lib/hooks/`, `_hooks/` por ruta. Además convive `lib/auth.ts` (archivo) con `lib/auth/` (carpeta). Consolidar: colocación por ruta para lo local, una única carpeta global para lo compartido.

### S-8 · MEDIUM — Componentes cliente de 800-1.250 líneas
[AuditReportPageClient.tsx](app/(app)/reports/audit/[runId]/AuditReportPageClient.tsx) (1.247), [UsersPageClient.tsx](app/(app)/users/UsersPageClient.tsx) (1.139), [TrainingsModule.tsx](app/(app)/formaciones/_components/TrainingsModule.tsx) (948), [superadmin/templates/[templateId]/page.tsx](app/superadmin/templates/[templateId]/page.tsx) (891). Mezclan fetching, estado y render; dividir en `_hooks` + presentacionales al tocarlos.

### S-9 · MEDIUM — `xlsx@0.18.5` (SheetJS npm) con CVEs conocidos sin parche en npm
Usado en import de members y export de reportes, procesando **archivos subidos por usuarios** (prototype pollution / ReDoS). Migrar al build oficial de SheetJS (CDN propio) o a `exceljs`.

### S-10 · LOW-MEDIUM — i18n a dos velocidades
Marketing usa `next-intl` con locales en ruta; el shell `(app)` carga `messages/{en,es}.json` pero abundan strings hardcodeados en español (p. ej. [otros/page.tsx](app/(app)/otros/page.tsx), mensajes de error de API). Si habrá clientes no hispanohablantes, definir ya la política para frenar la deuda.

### S-11 · LOW — `sync-session` acepta cualquier string como token
[app/api/auth/sync-session/route.ts:18-42](app/api/auth/sync-session/route.ts#L18-L42) setea la cookie sin validar el token contra `auth.getUser`. El riesgo real es bajo (todo consumidor revalida), pero validar antes de setear elimina una clase de bugs y de fijación de cookie.

---

## 4. Quick wins (<1 hora cada uno)

| # | Acción | Severidad | Detalle |
|---|--------|-----------|---------|
| Q-1 | **Borrar `lib/types/database.generated.ts`** | MEDIUM | 4.524 líneas, byte-a-byte idéntico a `lib/types/database.ts` (`diff` = 0) y con **0 imports**. Duplica el coste de cada regeneración de tipos. (Actualizar también la nota de memoria/docs que dice que es el archivo conectado — el conectado es `database.ts`.) |
| Q-2 | Mover `@anthropic-ai/sdk` a `dependencies` | HIGH (fix de C-4) | 1 línea en [package.json](package.json) |
| Q-3 | Borrar directorios vacíos | LOW | `app/api/gamification/leaderboard/`, `app/api/gamification/area-leaderboard/`, `app/api/_debug/latest-backlog-run/`, `app/debug/session/` |
| Q-4 | Borrar `supabase/functions/create-user/` | MEDIUM | Edge Function muerta: 0 referencias en el código, solo conoce roles `admin\|manager\|auditor` (modelo de roles antiguo). Superseded por `POST /api/admin/users`. Riesgo: sigue desplegada y acepta llamadas con lógica de autorización desactualizada — retirarla también del proyecto Supabase |
| Q-5 | Eliminar rutas alias `app/api/user-management/*` y `app/api/admin/create-user` | LOW | Son `export { ... } from` de las rutas canónicas en `admin/`. Buscar consumidores (`grep "user-management"` en cliente), apuntarlos a `/api/admin/*` y borrar |
| Q-6 | Borrar ruta tumba [superadmin/templates/[templateId]/historical-import/route.ts](app/api/superadmin/templates/[templateId]/historical-import/route.ts) | LOW | Solo devuelve "ruta retirada" |
| Q-7 | Borrar hooks huérfanos | LOW | `hooks/useAreas.ts`, `hooks/useOnboarding.ts`, `hooks/useTemplates.ts`, `lib/auth/useActiveHotel.ts` — 0 importadores (verificado con madge incluyendo `app/`) |
| Q-8 | Añadir `/otros` y `/mystery-shopper` al matcher de [middleware.ts:163](middleware.ts#L163) | MEDIUM | Mitigación inmediata de S-4 |
| Q-9 | Exportar `GET` con check de `Authorization: Bearer ${CRON_SECRET}` en las 3 rutas cron | CRITICAL (fix de C-1) | ~15 líneas por ruta; conservar `POST` manual |
| Q-10 | Validar token en `sync-session` antes de setear cookie | LOW (fix de S-11) | `supabaseWithToken(token).auth.getUser()` y 401 si falla |
| Q-11 | Cambiar `requireActiveHotel` a resultado tipado | MEDIUM (fix de S-3) | Ya existe `getActiveHotel` con la forma correcta; migrar los call-sites |
| Q-12 | Limpiar raíz del repo | LOW | `.env.save` (no trackeado pero presente), `tsconfig.tsbuildinfo` (2,8 MB — añadir a `.gitignore` si no está), carpetas `claude-mcp-sentinel/` y `competitor-profiles/` fuera del árbol de la app o a `docs/` |

---

## Apéndice: lo que está bien (no tocar)

- **Webhook de Stripe**: verificación de firma + idempotencia vía `billing_events` — correcto.
- **Capa de respuesta API** (`jsonOk/jsonError/jsonDbError`): adoptada en ~75% de rutas, errores de DB no expuestos al cliente.
- **Sin dependencias circulares** en 482 módulos.
- **Auth en rutas**: las 82 rutas tienen mecanismo de autorización identificable (helpers de dominio, tokens QR de un solo uso en trainings, firma HMAC en cal webhook, firma Stripe en billing).
- **RPCs transaccionales** para submit/start/import — elimina estados a medias.
- **Logger** con degradación limpia sin token y soporte de `waitUntil` en edge.
- **Cookies httpOnly** para token y scope de hotel, con guard server-side en layout + páginas.