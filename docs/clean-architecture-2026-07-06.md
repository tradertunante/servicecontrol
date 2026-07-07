# Arquitectura limpia — convenciones y plan de migración (2026-07-06)

Objetivo: separar transporte, aplicación, dominio e infraestructura sin pelear
contra Next.js App Router. `app/` es enrutado y transporte; **toda la lógica
vive en `lib/` organizada por dominio**. La migración es incremental y cada
paso debe preservar el comportamiento observable (mismos códigos, mensajes y
status HTTP).

## Capas y reglas de dependencia

```
┌─ Transporte ──────────────────────────────────────────────────┐
│ app/api/*/route.ts · app/**/page.tsx · middleware             │
│ Parsear request → llamar servicio → mapear resultado a HTTP   │
│ Aquí viven: NextRequest/NextResponse, envelopes, waitUntil    │
└──────────────────────────┬────────────────────────────────────┘
                           ▼
┌─ Aplicación (casos de uso) ───────────────────────────────────┐
│ lib/<dominio>/<casoDeUso>.ts  (p. ej. lib/audits/submitRun)   │
│ Orquesta autorización de dominio + persistencia + efectos.    │
│ Devuelve uniones discriminadas {ok:true,…}|{ok:false,failure} │
│ Prohibido: NextResponse, envelopes HTTP                       │
└──────────────────────────┬────────────────────────────────────┘
                           ▼
┌─ Dominio (puro) ──────────────────────────────────────────────┐
│ lib/<dominio>/*Contract.ts, permisos, mapeos, scoring         │
│ Sin I/O, sin "server-only" → testeable con vitest unitario    │
└──────────────────────────┬────────────────────────────────────┘
                           ▼
┌─ Infraestructura ─────────────────────────────────────────────┐
│ lib/supabase{Client,Server,Admin}.ts · lib/integrations/*     │
│ lib/email/* · lib/billing/stripe.ts · lib/logger.ts           │
└───────────────────────────────────────────────────────────────┘
```

Reglas:

1. **Un route handler no consulta la base de datos directamente.** Llama a un
   servicio de `lib/<dominio>/` y traduce su resultado al envelope HTTP. El
   handler queda en <150 líneas: parseo, auth de transporte, mapeo.
2. **La autorización de dominio se comparte, no se copia.** El pipeline
   "cargar recurso → scope de hotel → scope de área → propiedad" existe una
   sola vez por recurso (`authorizeRunForProfile`, `authorizeSessionForCaller`)
   y devuelve códigos (`RunAccessFailureCode`) que cada endpoint mapea a su
   contrato propio. Así dos endpoints pueden responder distinto (404 vs 403)
   sin duplicar el pipeline.
3. **Los fallos de servicio distinguen `db` de `app`.** Los errores de DB
   crudos nunca se serializan al cliente: el transporte los pasa por
   `jsonDbError` (log server-side + mensaje seguro). Ver
   `ServiceFailure` en `lib/trainings/sessions.ts`.
4. **Lo puro va en módulos sin `server-only`.** Mapeos de contrato, permisos y
   cálculos van en archivos importables desde vitest sin mocks
   (`lib/audits/submitContract.ts` es el patrón). `import type` desde módulos
   server-only está permitido (se borra en compilación).
5. **Componentes cliente no importan `supabaseClient` para datos de negocio**
   (solo para auth de sesión). Datos → route handler → hook de fetch.
   Regla para código nuevo; el legado se migra al tocar cada pantalla.
6. **`lib/` raíz solo contiene infraestructura transversal**
   (supabase*, logger, types). Todo lo demás vive en carpeta de dominio.

## Estructura objetivo de `lib/`

```
lib/
├─ api/            # helpers de transporte: response, validate, rateLimit
├─ auth/           # transporte-auth (server.ts), permisos, clientSession
├─ audits/         # server (authz), submitRun (caso de uso), submitContract (puro)
├─ trainings/      # server (authz/tokens), sessions (casos de uso)
├─ billing/        # plans, enforcement, provisioning, stripe (infra)
├─ integrations/   # adaptadores de servicios externos: brevo, notion
├─ email/          # envío de emails (Resend) + plantillas
├─ auditLogs/      # (pendiente) types / server / client
├─ …resto de dominios (members, reports, superadmin, notifications)
└─ supabaseClient|Server|Admin.ts, logger.ts, types.ts   # infra transversal
```

## Ejecutado en esta pasada (2026-07-06)

| Cambio | Antes | Después |
|---|---|---|
| `app/api/audits/submit/route.ts` | 326 líneas; duplicaba en línea el pipeline de authz de `lib/audits/server.ts` | Adaptador HTTP; dominio en `lib/audits/submitRun.ts` + `submitContract.ts` |
| `lib/audits/server.ts` | `authorizeAuditRunAccess` acoplado a NextRequest | Núcleo `authorizeRunForProfile` (sin framework, con códigos); el wrapper HTTP lo compone |
| `app/api/trainings/sessions/route.ts` | 291 líneas; pipeline sesión→hotel→tema→área repetido 3× + queries inline | Adaptador; casos de uso en `lib/trainings/sessions.ts` con pipeline único |
| `lib/auth.ts` (vs carpeta `lib/auth/`) | Ambigüedad archivo/carpeta | → `lib/auth/clientSession.ts` |
| `lib/stripe.ts` | Suelto en raíz | → `lib/billing/stripe.ts` |
| `lib/brevo.ts`, `lib/notion.ts` | Sueltos en raíz | → `lib/integrations/` |
| Tests | — | `__tests__/submitContract.test.ts` fija el contrato del endpoint submit (incl. disfraz 404→403) |

Verificación: `tsc --noEmit` limpio, 33/33 unitarios, 76/76 integración
Supabase, `next build` OK.

## Backlog de migración (orden sugerido)

1. **`lib/auditLogs/`** — agrupar `auditLogs.ts`, `auditLogsClient.ts`,
   `auditLogTypes.ts`. Bloqueado hoy: `app/api/audit-logs/route.ts` tiene
   cambios de perf sin commitear; hacerlo justo después de ese commit.
2. **`app/api/departments/backlog/route.ts` (474 líneas)** — extraer a
   `lib/departments/backlog.ts`. Mismo bloqueo (working tree sucio).
3. **`app/api/trainings/generate-suggestions/route.ts` (481)** y
   `topics/route.ts` (288) — mismo patrón que sessions.
4. **`app/api/members/[id]/route.ts` (326)** — mover reglas a `lib/members/`.
5. **Componentes cliente con `supabaseClient` (31 archivos)** — migrar a
   route handlers + hooks al tocar cada pantalla; no hacer big-bang.
6. **Páginas cliente >600 líneas** (`AuditReportPageClient` 1247,
   `UsersPageClient` 1139, `TrainingsModule` 948…) — separar hook de datos +
   componentes de presentación.
7. **`marketingSeo.ts`, `help.ts`, `search-index.ts`** — a carpetas de dominio
   cuando se toquen.
