# ServiceControl — Informe estratégico completo (2026-06-11)

**Alcance:** codebase completo (~69.300 líneas TS/TSX, 79 route handlers, 100+ migraciones, landing i18n, capa IA, billing).
**Base:** análisis directo del código en rama `landing/cta-jerarquia` + contraste con `docs/architecture-review-2026-06-09.md` y `docs/rls-review-2026-06-10.md` para no repetir lo ya resuelto.

**Estado de lo reportado anteriormente (verificado hoy):**

| Hallazgo previo | Estado |
|---|---|
| C-1 Crons rotos (solo POST) | ✅ Arreglado — las 3 rutas exportan `GET` con `Bearer ${CRON_SECRET}` |
| C-4 `@anthropic-ai/sdk` en devDependencies | ✅ Arreglado — está en `dependencies` |
| C-7 Next 13 / React 18 | ✅ Arreglado — Next 15.5 + React 19.2 |
| Q-1 `database.generated.ts` duplicado | ✅ Borrado |
| Q-7 hooks huérfanos | ✅ Borrados |
| Q-8 `/otros` y `/mystery-shopper` fuera del matcher | ✅ Añadidos al matcher |
| S-11 sync-session sin validar token | ✅ Validado con `auth.getUser` |
| RLS gaps críticos (C1–C4) | ✅ Migración `20260610140000` aplicada, 76/76 tests verdes |
| **C-2 Rate limit in-memory** | ❌ **Sigue abierto** — `lib/api/rateLimit.ts` sin cambios |
| **C-3 67 rutas con service-role, autorización solo en TS** | ❌ Sigue abierto (mitigado por RLS en path browser) |
| **C-5 Cobertura de tests de autorización casi nula** | ❌ Sigue abierto — 3 archivos unit + 76 integración RLS, 0 tests de rutas |
| **C-6 Bucket `audit-photos` público** | ❌ Sigue abierto — ninguna migración lo revierte |
| **S-5 Crons secuenciales por hotel con IA** | ❌ Sigue abierto |
| **S-9 `xlsx@0.18.5` con CVEs** | ❌ Sigue abierto |

---

## 1. ARQUITECTURA

### 1.1 Mapa (resumen actualizado)

Monolito Next.js 15 App Router + Supabase (Postgres/Auth/Storage) en Vercel. No hay agentes en runtime; los "actores" son:

```
Browser ──(RLS, sesión)──────────► Supabase           [~54 archivos cliente]
Browser ──HTTP──► middleware.ts ──► app/api/** ──authorizeRouteRequest──► supabaseAdmin (service-role) ──► Postgres
AuthSessionSync ──► /api/auth/sync-session ──► cookie httpOnly ──► guards SSR (lib/auth/server.ts)
Vercel cron (GET) ──► send-weekly / send-monthly / generate-suggestions ──► Anthropic ──► Resend
Stripe ──webhook firmado──► /api/billing/webhook ──► billing_events (idempotente, UNIQUE provider_event_id)
Cal.com ──HMAC──► /api/cal/webhook ──► Brevo + Notion
Supabase Auth ──hook──► Edge Fn auth-email-hook
```

### 1.2 Puntos únicos de fallo y cuellos de botella

| # | Punto | Riesgo | Severidad |
|---|---|---|---|
| A-1 | [lib/auth/server.ts](lib/auth/server.ts) — guardián único de ~67 rutas que operan con service-role. Un bug = fuga cross-hotel sin que la DB lo impida | La seguridad multi-tenant del path API es 100 % código de aplicación, sin tests de autorización por ruta | **ALTA** |
| A-2 | [lib/api/rateLimit.ts](lib/api/rateLimit.ts) — `Map` in-memory por instancia. El límite de auth (5 req/min/IP) aplica a `sync-session`, que cada usuario llama en login y refresh. Hoteles = NAT compartida → 6 empleados en el mismo minuto = 429 → logouts fantasma | UX rota justo en el cliente objetivo (hotel con WiFi corporativo) | **ALTA** |
| A-3 | Crons secuenciales: [generate-suggestions/route.ts:396](app/api/trainings/generate-suggestions/route.ts#L396) itera hoteles → fetch → llamada IA → inserts → notificaciones, todo en una invocación. `send-weekly`/`send-monthly` igual | Con >10-15 hoteles activos excede el timeout de Vercel; los hoteles del final de la lista nunca reciben reporte | **MEDIA hoy, ALTA al escalar** |
| A-4 | `AuthSessionSync` cliente como único refresco de la cookie httpOnly | Si el POST falla (p. ej. por A-2), SSR redirige a login con sesión válida | MEDIA |
| A-5 | Proveedores sin fallback: Resend, Anthropic, Stripe, Brevo, Notion | Indisponibilidad parcial; en `trial/register` un fallo de Brevo/Notion rompe el alta (ver B-3) | MEDIA |

### 1.3 Sobre-ingeniería / superficie muerta

- **~17 tablas sin uso en el código** (lista V6 de la revisión RLS): `audit_targets`, `area_targets`, `area_target_assignments`, `user_hotels`, `hotel_memberships`, `score_events`, `user_scores`, `tasks`, `task_assignments`, `superadmins`, `standards`, `audit_evidence`, `user_area_permissions`, `user_audit_permissions`, `global_packs`, `global_pack_templates`, `hotel_settings`. Cada una es superficie RLS que mantener. **Fix:** migración de drop tras verificar `pg_stat_user_tables` en prod.
- **Deriva de migraciones:** `submit_audit_run` redeplegado 5+ veces, `rpc_team_summary` con wrapper de compatibilidad y 4 fixes, y una migración temporal de introspección ([20260610100001_introspect_funcs_temp.sql](supabase/migrations/20260610100001_introspect_funcs_temp.sql)) en el histórico. **Fix:** extraer RPCs a archivos fuente y `create or replace` desde ahí; squash de baseline cuando haya ventana.
- `canAddHotel` en [lib/billing/enforcement.ts](lib/billing/enforcement.ts) no se llama desde ningún sitio.

### 1.4 Schema Supabase — índices que faltan

Solo existen 6 índices de aplicación (+billing). Faltan, ordenados por impacto:

| Índice | Por qué |
|---|---|
| `audit_corrective_actions (hotel_id, status)` | Paneles de correctivas y backlog filtran por esto constantemente |
| `audit_answers (question_id)` | [departments/backlog/route.ts:336](app/api/departments/backlog/route.ts#L336) hace `.in("question_id", ...)` sobre la tabla más grande del sistema |
| `audit_runs (hotel_id, executed_at DESC) WHERE status='submitted'` | `generate-suggestions` y reportes filtran por hotel+status+fecha; el índice actual `(hotel_id, status)` no cubre el rango temporal |
| `profiles (hotel_id)` | Lookups de plantilla por hotel en decenas de rutas |
| `notifications (user_id, created_at DESC)` | Campana de notificaciones |
| `ai_training_suggestions (hotel_id, review_status, created_at)` | Dedupe del cron de sugerencias |
| `trial_leads (email)` UNIQUE | El check de duplicado en [trial/register/route.ts:65](app/api/trial/register/route.ts#L65) es por email sin índice **y sin constraint** → carrera: dos requests simultáneas del mismo email pasan ambas el check |

---

## 2. CALIDAD DE CÓDIGO

| # | Problema | Dónde | Fix |
|---|---|---|---|
| Q-1 | **Fuga de error crudo al cliente** — único caso que rompe el patrón `jsonDbError` | [app/api/my/area-access/route.ts:23](app/api/my/area-access/route.ts#L23) `return jsonError(error.message, 500)` | Cambiar a `jsonDbError(error)` |
| Q-2 | Componentes cliente gigantes que mezclan fetching+estado+render | [AuditReportPageClient.tsx](app/(app)/reports/audit/[runId]/AuditReportPageClient.tsx) (1.247), [UsersPageClient.tsx](app/(app)/users/UsersPageClient.tsx) (1.139), [TrainingsModule.tsx](app/(app)/formaciones/_components/TrainingsModule.tsx) (948), [superadmin/templates/[templateId]/page.tsx](app/superadmin/templates/[templateId]/page.tsx) (891) | Dividir en `_hooks` + presentacionales al tocarlos; no big-bang |
| Q-3 | Logging inconsistente: `console.error` en vez de `logger` en ~10 sitios; [createHistoricalRun.ts:87](lib/superadmin/createHistoricalRun.ts#L87) vuelca `JSON.stringify(runError, null, 2)` completo (puede incluir filas) | `lib/superadmin/createHistoricalRun.ts`, `lib/auth/userManagement.ts:313`, `lib/email/sendInstantNotifications.ts` | Unificar en `logger.*`; nunca volcar el error entero |
| Q-4 | Hack de ofuscación `const envKey = "ANTHROPIC" + "_API_KEY"` | [generate-suggestions/route.ts:163](app/api/trainings/generate-suggestions/route.ts#L163) | Usar `process.env.ANTHROPIC_API_KEY` como en `generateNarrative.ts`; si un scanner lo bloquea, configurar el scanner, no el código |
| Q-5 | Valores hardcodeados que deberían ser config: precios de planes en [PricingQuiz.tsx:31-52](app/(marketing)/_components/PricingQuiz.tsx#L31-L52) (195/259/349 €) duplicados respecto a Stripe/`plan_entitlements` → driftarán; coste por token en [costLogger.ts:5-6](lib/ai/costLogger.ts#L5-L6); fallback `https://app.servicecontrol.io` en [trial/register/route.ts:141](app/api/trial/register/route.ts#L141); modelo `claude-sonnet-4-6` repetido en 3 sitios | varios | Tabla de precios única (env o `plan_entitlements` con campo `display_price`); constante `AI_MODEL` compartida |
| Q-6 | Rutas sin `try/catch` siguen existiendo (el catch global de Next devuelve 500 opaco sin log): [billing/portal](app/api/billing/portal/route.ts), [billing/status](app/api/billing/status/route.ts), [my/area-access](app/api/my/area-access/route.ts), [trial/register](app/api/trial/register/route.ts) (este último es el más grave, ver B-3) | — | Wrapper `withErrorHandler(handler)` en `lib/api/response.ts` y adoptarlo ruta a ruta |
| Q-7 | Tests: 3 unit + 76 integración RLS. **Cero tests** sobre `lib/auth/server.ts`, scoping hotel/área en rutas, enforcement de billing, webhook Stripe | `__tests__/` | Prioridad nº1 de testing: tabla de casos por ruta (rol × hotel × resultado esperado) contra un Supabase local |

---

## 3. SEGURIDAD

### S-1 · ALTA — El sandbox de trial da rol `admin` real en un hotel compartido

[app/api/trial/register/route.ts:83-94](app/api/trial/register/route.ts#L83-L94): cada lead se crea como usuario **`role: "admin"` del mismo `TRIAL_DEMO_HOTEL_ID`**. Según la matriz RLS vigente (rls-review, sección 3), un admin de hotel puede:

- **Leer y escribir los `profiles` de su hotel** → un prospecto ve nombre y email de todos los demás prospectos (fuga de datos personales entre leads de venta, problema RGPD real), puede desactivarlos o renombrarlos.
- Crear usuarios vía `/api/admin/users` — `canAddUser` no lo frena porque el trial no tiene billing account (grace period).
- Borrar runs/answers del hotel demo (DELETE admin en RLS), vaciando el sandbox para los demás.
- Editar `hotel_settings` (logo, idioma) del sandbox de todos.

La nota del copy del trial ("el sandbox comparte datos de demostración") cubre los datos ficticios, **no** el que otros prospectos vean tu email.

**Fix recomendado (orden de menor a mayor esfuerzo):** (a) rol `auditor` o un rol `trial_admin` nuevo con escrituras limitadas; (b) excluir `is_trial=true` de `sc_can_read_profile`/escrituras de admin vía RLS; (c) ideal a medio plazo: un hotel-sandbox efímero por lead (plantilla clonada), que además convierte mejor.

### S-2 · ALTA — `trial_expires_at` se escribe pero no se aplica en ningún sitio

`grep trial_expires_at` → solo se setea en [trial/register/route.ts:118](app/api/trial/register/route.ts#L118). Ni [loadProfileWithToken](lib/auth/server.ts#L63) (que sí aplica `access_expires_at` para mystery shoppers) ni ningún cron lo comprueban. **Los trials de 14 días duran para siempre**, con rol admin (ver S-1). **Fix:** en `loadProfileWithToken`, si `is_trial` y `trial_expires_at < now()` → null (mismo patrón que mystery_shopper); 3 líneas.

### S-3 · ALTA (heredada, sigue abierta) — Bucket `audit-photos` público

[20260605110000_make_audit_photos_bucket_public.sql](supabase/migrations/20260605110000_make_audit_photos_bucket_public.sql) sin migración posterior que lo revierta. Evidencia fotográfica de hoteles de lujo accesible para siempre por URL filtrada, sin revocación. **Fix:** bucket privado + `createSignedUrl` en `get_audit_run_full` (TTL 7 días, regenerable).

### S-4 · MEDIA — PostHog sin consentimiento mientras la landing promete RGPD

[PostHogProvider.tsx:9-14](app/providers/PostHogProvider.tsx#L9-L14): `persistence: "localStorage+cookie"`, host por defecto `us.i.posthog.com` (datos fuera de la UE), sin banner de consentimiento — y [TrustSection copy](messages/es.json) afirma "Datos alojados en la Unión Europea… cumplimiento RGPD". Incoherencia legal y de credibilidad ante un GM de lujo. **Fix:** `persistence: "memory"` + `opt_out_capturing_by_default` hasta consentimiento, host EU (`eu.i.posthog.com`), y banner mínimo. Además falta **política de privacidad** (no existe ninguna página `privacy`; el footer solo enlaza pricing/demo/trial/login/help — solo hay `/terms`).

### S-5 · MEDIA — Autorización multi-tenant solo en TypeScript (C-3 heredado)

Sin cambios: ~67 rutas validan con `authorizeRouteRequest` y operan con `supabaseAdmin()`. El RLS endurecido protege el path browser; el path API depende de que cada ruta filtre por `hotel_id`. Spot-check de hoy (submit, reopen, mystery-shopper/progress, profiles/names, backlog): todas filtran correctamente. El riesgo es la **ruta nº 80 que alguien escriba mañana**. **Fix realista:** tests de autorización por ruta (Q-7) + helper `scopedAdmin(hotelId)` que devuelva builders pre-filtrados.

### S-6 · BAJA-MEDIA — Varios

- `xlsx@0.18.5` (CVEs sin parche en npm) procesando **archivos subidos por usuarios** en import de members/históricos. Migrar a `exceljs` o build oficial SheetJS.
- [trial/register](app/api/trial/register/route.ts): contraseña en texto plano por email (aceptable para sandbox, pero con S-1/S-2 el riesgo agrega); sin CAPTCHA (mitigado por rate limit IP en DB).
- Carrera de idempotencia en [billing/webhook/route.ts:59-67](app/api/billing/webhook/route.ts#L59-L67): dos entregas simultáneas del mismo evento pasan ambas el check `existing`; el `UNIQUE provider_event_id` salva el insert duplicado pero el segundo `insert` falla sin que se compruebe el error → ambos procesan el evento. Inocuo hoy (los handlers son upserts), pero documentarlo o usar `upsert ... on conflict do nothing` + re-check.

---

## 4. RENDIMIENTO

### P-1 · ALTA — Truncado silencioso a 1.000 filas (límite por defecto de PostgREST)

Solo hay 12 usos de `.limit()/.range()` en `lib` + `app/api`. Todas estas lecturas masivas devuelven **máximo 1.000 filas sin error**:

- [generate-suggestions/route.ts:86-97](app/api/trainings/generate-suggestions/route.ts#L86-L97) — `audit_answers .in(run_ids)` sobre 90 días: un hotel con 100 runs × 30 preguntas ya son 3.000 answers → **los ratios de fallo se calculan sobre un tercio de los datos y nadie lo sabe**.
- [lib/analytics/server.ts:629](lib/analytics/server.ts#L629) — mismo patrón para el dashboard de analytics.
- [departments/backlog/route.ts:336](app/api/departments/backlog/route.ts#L336) — answers por `question_id`.
- Builders de reportes semanal/mensual (`lib/reports/build*`).

**Fix:** helper `fetchAll(query, pageSize=1000)` con `.range()` paginado, o agregaciones en SQL (RPC `count/filter` por pregunta — más correcto y más barato que traer las filas).

### P-2 · MEDIA — N+1 y queries redundantes

- [generate-suggestions/route.ts:311-327](app/api/trainings/generate-suggestions/route.ts#L311-L327): **dentro del loop de sugerencias** se re-consultan los managers del hotel (misma query cada iteración) y se llama `notify_user` RPC una a una. Sacar la query de managers fuera del loop; batch de notificaciones.
- [generate-suggestions/route.ts:51-67](app/api/trainings/generate-suggestions/route.ts#L51-L67): `recentRuns ⊂ historicalRuns` — bastaría una query (90 días) y particionar en memoria. Mitad de queries y de answers transferidas.
- [superadmin/templates/[templateId]/duplicate/route.ts:46](app/api/superadmin/templates/[templateId]/duplicate/route.ts#L46): insert por sección en loop — batch insert.

### P-3 · MEDIA — Trabajo pesado síncrono en requests

- Cron de reportes y sugerencias: secuencial por hotel con llamada IA bloqueante (ver A-3). Fan-out con `waitUntil` por hotel o cursor por lotes.
- [trial/register/route.ts:142-154](app/api/trial/register/route.ts#L142-L154): email + Brevo + Notion **bloquean la respuesta** del formulario de trial (3 proveedores externos en el camino crítico de conversión). Mover a `waitUntil` y responder ya (ver B-3).
- [costLogger.ts:24-36](lib/ai/costLogger.ts#L24-L36): insert fire-and-forget **sin `waitUntil`** — en Vercel la función puede congelarse antes de completar el insert → logs de coste perdidos justo en las ejecuciones largas. Envolver en `waitUntil(...)`.

### P-4 · BAJA — Caching

- `plan_entitlements` (catálogo estático) se consulta en cada `getActiveSubscription` (3 queries por check de enforcement, 2 veces por request en algunos flujos). Cache in-memory con TTL 5 min.
- Landing: [MarketingShowcase.tsx](app/(marketing)/_components/MarketingShowcase.tsx) (601 líneas, client) se bundlea también para móvil aunque el mock del hero es `hidden lg:block`. Carga diferida con `next/dynamic` o split del mock.

---

## 5. LÓGICA DE NEGOCIO

### B-1 · CRÍTICA — El enforcement de planes no aplica a quien realmente usa el producto

[lib/billing/getActiveSubscription.ts:49-53](lib/billing/getActiveSubscription.ts#L49-L53) busca la cuenta por `owner_user_id = userId` **del que llama**. Pero [audits/start/route.ts:36](app/api/audits/start/route.ts#L36) y [admin/users/route.ts:37](app/api/admin/users/route.ts#L37) pasan `caller.profile.id` — el auditor o admin que ejecuta, no el dueño de la cuenta. Resultado: **cualquier usuario que no sea el owner devuelve `has_account: false` → grace period → sin límites**. Como los audits los crean auditores/managers, los límites `max_audits_per_month` y `max_users_per_hotel` son letra muerta en el 95 % del uso real.

**Fix:** resolver billing por hotel, no por caller: `hotels.billing_account_id` ya existe ([migración billing_system](supabase/migrations/20260325100000_billing_system.sql)). `getActiveSubscriptionForHotel(hotelId)` y migrar los 2 call-sites. Imprescindible antes del primer cliente de pago — si no, no hay nada que les obligue a pagar el plan correcto.

### B-2 · ALTA — Trial: medio construido en tres frentes

1. Expiración no aplicada (S-2).
2. [trial/register/route.ts:128-131](app/api/trial/register/route.ts#L128-L131) resetea `enabled_packs` del hotel demo **en cada registro** — escritura redundante y pisaría cualquier ajuste manual del sandbox.
3. No hay flujo de conversión trial→pago: nada conecta `is_trial` con checkout de Stripe ni hay CTA de upgrade en `TrialBanner` más allá del banner.

### B-3 · ALTA — Alta de trial frágil ante fallos de terceros

[trial/register/route.ts:142-156](app/api/trial/register/route.ts#L142-L156): `Promise.all(email, Brevo, Notion)` **sin catch y sin try/catch en la ruta**. Si Brevo o Notion fallan: el usuario ya existe en Auth, pero recibe 500 ("inténtalo de nuevo"), reintenta y recibe 409 ("este email ya tiene acceso") **sin haber recibido nunca la contraseña**. Lead quemado en el peor momento. **Fix:** `await` solo el email de bienvenida (con catch → rollback o aviso claro), Brevo/Notion a `waitUntil` con catch logueado.

### B-4 · MEDIA — Sugerencias IA notifican a managers equivocados

[generate-suggestions/route.ts:311-327](app/api/trainings/generate-suggestions/route.ts#L311-L327) notifica a **todos** los managers del hotel por cada sugerencia, aunque el modelo de visibilidad del resto del sistema asigna managers a áreas (`user_area_access`). El manager de F&B recibe "patrón de fallos en Housekeeping". Ruido que entrena a ignorar notificaciones. **Fix:** join con `user_area_access` por `s.area_id`.

### B-5 · MEDIA — Degradaciones silenciosas en narrativas IA

- [generateNarrative.ts:105-108](lib/reports/generateNarrative.ts#L105-L108): si el JSON no parsea, devuelve el texto crudo truncado a 600 chars como narrativa de hotel y **`areas: {}`** — los managers de área reciben el reporte sin su párrafo y nadie se entera. Loguear el fallo de parseo (`logger.warn`) y marcar el reporte como degradado.
- [callAiForSuggestions:221-223](app/api/trainings/generate-suggestions/route.ts#L221-L223): parse fallido → `[]` silencioso → "0 sugerencias esta semana" indistinguible de "la IA falló". Mismo fix.
- El resultado del cron (`results[]` con errores por hotel) se devuelve en la respuesta HTTP **que nadie lee** (la lee Vercel cron). Loguear errores con `logger.error` para que lleguen a Better Stack.

### B-6 · BAJA-MEDIA — Edge cases varios

- Carrera en alta de trial por email duplicado (sin UNIQUE en `trial_leads.email`, ver índices) — el segundo pasa el check y `createUser` lo salva de milagro vía el 422 de Auth.
- [LandingTracker.tsx:30](app/(marketing)/_components/LandingTracker.tsx#L30): compara `href === "/demo"` pero los `Link` de `i18n/navigation` renderizan rutas con prefijo de locale (`/en/demo`) → **los clicks de CTA del locale no-default no se trackean**. Usar `href.endsWith("/demo")` o `includes`.
- [PostHogProvider.tsx:9](app/providers/PostHogProvider.tsx#L9): `NEXT_PUBLIC_POSTHOG_KEY!` con non-null assertion — sin la env inicializa con `undefined` y rompe silenciosamente. Guard con `if (key)`.

---

## 6. CAPA IA

**Cobertura de costLogger: completa.** Solo hay 3 call-sites de Anthropic (`generateReportNarrative`, `generateMysteryShopperNarrative`, `callAiForSuggestions`) y los tres llaman `logApiCost` tras la respuesta. No hay llamadas sin trackear.

Problemas, por orden:

| # | Problema | Fix |
|---|---|---|
| AI-1 | [costLogger.ts:24-36](lib/ai/costLogger.ts#L24-L36) — insert fire-and-forget sin `waitUntil`: los logs se pierden si la función serverless se congela tras responder (= justo en crons largos) | `waitUntil(supabaseAdmin().from("api_cost_logs").insert(...))` |
| AI-2 | [costLogger.ts:5-6](lib/ai/costLogger.ts#L5-L6) — pricing hardcodeado de Sonnet ignorando el parámetro `model`; `sessionTotal` module-level no significa nada entre invocaciones serverless | Mapa `model → {in, out}` con fallback; eliminar `sessionTotal` |
| AI-3 | Prompt de mystery shopper ([generateNarrative.ts:154-202](lib/reports/generateNarrative.ts#L154-L202)) envía **todas las respuestas de todos los runs**, incluidos los ✓ — input sin techo en estancias largas (coste y degradación de foco). El post-procesado `stripRecommendationSentence` con 14 regex es frágil | Enviar fallos completos + conteo agregado de aciertos por área; pedir el cierre sin recomendaciones con un ejemplo en el prompt en vez de regex |
| AI-4 | Fallos silenciosos (B-5): parse JSON degradado sin log en narrativas y sugerencias | `logger.warn("ai_parse_fallback", ...)` en ambos catch |
| AI-5 | Sin reintento ni timeout explícito en las llamadas (`messages.create` con defaults del SDK); en cron secuencial un hotel colgado bloquea a los demás | `maxRetries: 2, timeout: 60_000` en el constructor del cliente |
| AI-6 | Parseo JSON artesanal (`indexOf("{")`/`lastIndexOf("}")`) | Usar tool-use forzado (un tool `emit_report` con schema) — elimina la clase entera de errores de parseo |

---

## 7. LANDING

**Lo que está bien** (no tocar): jerarquía de CTA demo-primero coherente con producto high-touch, hero orientado a resolución, sección de confianza honesta sin testimonios inventados (pre-lanzamiento), pricing transparente con quiz de recomendación, SEO técnico completo (sitemap con hreflang, robots, OG image, metadataBase correcto), paridad es/en al 100 % en `messages/`.

### Gaps de conversión y confianza

| # | Problema | Dónde | Fix |
|---|---|---|---|
| L-1 | **La página de pricing ignora su propio i18n**: [pricing/page.tsx:16-20](app/[locale]/(marketing)/pricing/page.tsx#L16-L20) hardcodea eyebrow "Pricing" (inglés) + título/descripción en español **para ambos locales**, mientras `pricingPage.eyebrow/title/description` existen traducidos en `messages/`. Un GM que navegue en inglés ve la página de la decisión de compra a medio traducir | pricing/page.tsx | Usar `getTranslations("pricingPage")` — 10 min |
| L-2 | **Sin política de privacidad ni aviso legal** — el footer solo tiene pricing/demo/trial/login/help; existe `/terms` pero ninguna página de privacidad, y la TrustSection promete RGPD. Para un GM de lujo (y su DPO) esto desmiente la promesa de confianza en un click | [MarketingFooter.tsx](app/(marketing)/_components/MarketingFooter.tsx) | Página `/privacy` + enlace a terms y privacy en footer + banner de consentimiento (ver S-4) |
| L-3 | CTA primario inconsistente: hero empuja **/demo** ("Ver ServiceControl en 30 min"), pero el botón destacado del header es **/trial** | [MarketingHeader.tsx:52-63](app/(marketing)/_components/MarketingHeader.tsx#L52-L63) | Header: botón primario → /demo, /trial como secundario textual (igual que el hero) |
| L-4 | Móvil no ve el producto hasta muy abajo: el mock del dashboard es `hidden lg:block` ([HeroSection.tsx:102](app/(marketing)/_components/HeroSection.tsx#L102)) y DemoShowcase llega tras 7 secciones | HeroSection | Versión compacta del mock (o screenshot estático ligero) bajo el CTA en móvil |
| L-5 | Sin FAQ ni manejo de objeciones (precio "desde", migración desde Excel/papel, cuánto tarda la implantación, qué pasa con mis datos) — objeciones típicas de un GM antes de regalar 30 min | — | Sección FAQ en home o pricing; además es material para AI-SEO |
| L-6 | Cero prueba social siendo pre-lanzamiento: aceptable, pero hay sustitutos disponibles que no se usan — "Construido con operadores de hoteles 5★", foto/nombre del fundador, número de estándares FTG/LHW soportados | TrustSection | Una línea de origen/founder story baja la fricción sin inventar logos |
| L-7 | Tracking de CTA roto en locale inglés (B-6, `href === "/demo"`) y scroll-depth 100 % casi nunca dispara (compara contra `scrollHeight` exacto) | [LandingTracker.tsx](app/(marketing)/_components/LandingTracker.tsx) | `endsWith` + umbral 90 % |
| L-8 | Quiz de pricing exige 2 respuestas antes de mostrar precios — fricción para el visitante que solo quiere "el número"; los precios además están hardcodeados (Q-5) | [PricingQuiz.tsx](app/(marketing)/_components/PricingQuiz.tsx) | Mostrar las 3 tarjetas siempre y usar el quiz solo para resaltar la recomendada |

---

## 8. PLAN DE ACCIÓN PRIORIZADO

### Top 10 antes del primer cliente de pago

1. **Arreglar enforcement de billing por hotel** (B-1) — sin esto, los planes no limitan nada. `getActiveSubscriptionForHotel(hotelId)` vía `hotels.billing_account_id` + 2 call-sites + test.
2. **Aplicar `trial_expires_at`** (S-2) — 3 líneas en `loadProfileWithToken` + test.
3. **Quitar rol admin a los trials del hotel compartido** (S-1) — rol `auditor` o RLS que excluya `is_trial` de lectura/escritura de profiles ajenos.
4. **Bucket `audit-photos` privado + signed URLs** (S-3) — la evidencia fotográfica de un hotel de lujo no puede ser pública.
5. **Rate limiter distribuido (Upstash/Vercel KV) y subir el límite de `sync-session`** (A-2) — los logouts fantasma bajo NAT hotelera aparecerán el primer día de uso real.
6. **Paginar/agregar las lecturas masivas de `audit_answers`** (P-1) — hoy los análisis IA y analytics mienten silenciosamente a partir de 1.000 filas.
7. **Tests de autorización por ruta** (Q-7/S-5) — tabla rol×hotel×ruta para las 15 rutas más sensibles (audits, admin/users, superadmin, billing).
8. **Endurecer el alta de trial** (B-3) — try/catch + `waitUntil` para Brevo/Notion + UNIQUE en `trial_leads.email`.
9. **Privacidad y consentimiento** (S-4/L-2) — página de privacidad, banner, PostHog EU. La promesa RGPD de la landing debe ser verdad.
10. **Índices que faltan** (sección 1.4) — una migración, 30 min, evita los primeros "el dashboard va lento" con datos reales.

### Top 5 quick wins (<30 min cada uno)

1. [my/area-access/route.ts:23](app/api/my/area-access/route.ts#L23): `jsonError(error.message)` → `jsonDbError(error)` (única fuga de error crudo).
2. `waitUntil` en [costLogger.ts](lib/ai/costLogger.ts) + eliminar `sessionTotal`.
3. Sacar la query de managers fuera del loop en [generate-suggestions:311](app/api/trainings/generate-suggestions/route.ts#L311) y filtrar por `user_area_access` del área.
4. `getTranslations("pricingPage")` en [pricing/page.tsx](app/[locale]/(marketing)/pricing/page.tsx) (L-1).
5. Arreglar [LandingTracker](app/(marketing)/_components/LandingTracker.tsx): `endsWith("/demo")` y scroll 90 % (L-7) — sin esto, los datos con los que vais a iterar la landing están sesgados al locale español.

### Top 3 para conversión

1. **Página de pricing**: i18n correcto + las 3 tarjetas visibles sin quiz + FAQ de objeciones al pie (L-1, L-8, L-5). Es la página donde el GM decide si la demo merece 30 minutos.
2. **Coherencia de confianza**: privacidad + consentimiento + una línea de founder/origen en TrustSection (L-2, L-6). El segmento lujo compra confianza antes que features; hoy la promesa RGPD es refutable en un click.
3. **CTA primario unificado a /demo** en header + producto visible en el hero móvil (L-3, L-4). El visitante móvil (mayoría del tráfico frío) hoy decide sin haber visto la interfaz.

---

## Apéndice — Lo que está bien y no hay que tocar

- Webhook Stripe: firma + idempotencia con `UNIQUE provider_event_id` + estados pending/processed/failed.
- Webhook Cal.com: HMAC con `timingSafeEqual`, PING permitido sin firma de forma explícita y razonada.
- [audits/submit](app/api/audits/submit/route.ts): cadena de autorización ejemplar (rol → hotel → área → ownership de auditor), RPC transaccional, side-effects en `waitUntil` con catch. Es el patrón a copiar en el resto.
- RLS: tras `20260610120000` + `20260610140000`, el path browser está bien cerrado y testeado (76/76).
- `jsonDbError` centralizado — los errores de DB no llegan al cliente (1 excepción, Q-1).
- SEO técnico de la landing completo y correcto.
- Cobertura de `logApiCost`: 3/3 call-sites de IA trackeados.