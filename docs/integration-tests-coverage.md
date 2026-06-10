# Tests de integración Supabase — Cobertura de flujos

**Fecha:** 2026-06-10 · **Runner:** Vitest 4 · **Resultado:** **76 passed, 0 fallos**, 5 suites, ~115 s contra Supabase real.

> **Actualización 2026-06-10:** los 7 gaps de RLS que esta suite detectó (marcados antes como `it.fails`) **fueron reparados** en la migración `20260610120000_remove_legacy_permissive_rls_policies.sql` y promovidos a tests normales. Ver la sección [Reparación del RLS](#reparación-del-rls-aplicada) más abajo.

## Cómo ejecutar

```bash
npm run test:integration
```

- Config: `vitest.integration.config.ts` (carga `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` desde `.env`/`.env.local`).
- Requiere el opt-in `RUN_SUPABASE_INTEGRATION=1` (lo pone el script npm); sin él, las suites se omiten y `npm test` (unitarios) no las toca.
- Los tests corren **en serie** contra la BD real. Todo dato de test lleva el prefijo `[IT][<runTag>]` o el dominio `@sc-integration-tests.dev`; cada suite limpia lo suyo en `afterAll` (y **lanza error** si la purga queda incompleta) y un sweep en `globalSetup` borra restos de ejecuciones crasheadas con más de 1 h.

## Estructura

| Archivo | Rol |
|---|---|
| `__tests__/integration/helpers/env.ts` | Detección de entorno y constantes de namespacing |
| `__tests__/integration/helpers/clients.ts` | Clientes admin (service-role), anon y autenticado (RLS real) |
| `__tests__/integration/helpers/factory.ts` | `TestBed`: factories (hotel, usuario+auth, área, plantilla, pack LHW, targets, runs) con tracking y cleanup |
| `__tests__/integration/helpers/purge.ts` | Purga de un hotel y su árbol de FKs (compartida por cleanup y sweep) |
| `__tests__/integration/helpers/globalSetup.ts` | Sweep de restos huérfanos |

## Cobertura por flujo

### 1. Registro de hotel y setup inicial — `hotel-registration.test.ts` (10 tests)

| Caso | Tipo |
|---|---|
| Alta de hotel con defaults (status, timezone, sin soft-delete) | Happy |
| Trigger `sync_profile_from_auth_user`: profile auto-creado con rol/hotel/full_name | Happy |
| Rol inválido en metadata → fallback seguro a `auditor` | Edge |
| Updates de metadata posteriores **no** re-sincronizan el profile (trigger solo on INSERT — comportamiento verificado) | Edge |
| Borrar usuario auth → trigger limpia profile y `user_area_access` | Happy |
| Creación de áreas operativas | Happy |
| `hotel_audit_rules` único por hotel (upsert no duplica) | Edge |
| `sync_global_audit_pack_to_hotel` clona plantilla+secciones+preguntas (scope `hotel`, `source_template_id`, área null) | Happy |
| Re-sincronización del pack idempotente (0 añadidos, sin duplicados) | Edge |
| `trial_leads` con email duplicado → 23505 | Failure |

### 2. Creación, asignación y completado de auditorías — `audit-lifecycle.test.ts` (19 tests)

| Caso | Tipo |
|---|---|
| `start_audit_run`: draft + seed PASS solo de preguntas activas | Happy |
| `ACTOR_NOT_FOUND`, `FORBIDDEN_ROLE` (engineering), `INVALID_AUDIT_CHANNEL` | Failure |
| `AREA_OUT_OF_SCOPE`, `AREA_INACTIVE`, `TEMPLATE_INACTIVE`, `TEMPLATE_OUT_OF_SCOPE` | Failure |
| Auditor asignado (sin ser ejecutor) puede enviar; no asignado → `FORBIDDEN_RUN_ACCESS`; admin envía cualquier run del hotel | Happy + Failure |
| `submit_audit_run` happy path: submitted + score + summary | Happy |
| Submit idempotente → `AUDIT_ALREADY_SUBMITTED` con `meta.idempotent` | Edge |
| `RUN_NOT_FOUND`, `RUN_INVALID_STATUS`, `ACTOR_INACTIVE` | Failure |
| `MISSING_ANSWER` (con question_id del error), valores inválidos rechazados por el CHECK `audit_answers_answer_result_check` (23514) | Failure |
| `MISSING_REQUIRED_COMMENT` (if_fail, comentario en blanco) y desbloqueo al añadirlo | Failure + Happy |
| `MISSING_REQUIRED_PHOTO` (always) y desbloqueo | Failure + Happy |
| `ROOM_NUMBER_REQUIRED`, `AUDITED_EMPLOYEE_REQUIRED`, `NO_ACTIVE_QUESTIONS` | Failure |

### 3. Scoring LHW y agregación — `lhw-scoring.test.ts` (15 tests)

| Caso | Tipo |
|---|---|
| End-to-end sobre plantilla clonada del pack "CHECK OUT -LHW": todo PASS → 100 | Happy |
| 1 FAIL de 4 → 75.00 con summary exacto | Happy |
| NA fuera del denominador: 1 FAIL + 1 NA de 4 → 66.67 (redondeo a 2 decimales) | Edge |
| Todo NA → score `null`, run submitted | Edge |
| Vista `audit_run_summary` (pass/fail/na/score_pct) coincide con el RPC | Happy |
| `v_area_latest_score` apunta al último run del área | Happy |
| `rpc_team_summary_v2`: `total_audits_done`, leaderboard con `avg_score` 87.5 (solo agrega usuarios con target en `area_template_target_assignments`; caller manager necesita `user_area_access`) | Happy |
| `rpc_team_summary_v2` con periodo inválido → excepción | Failure |
| Score < umbral → reauditoría draft `auto_below_threshold` con delay programado y auditor heredado | Happy |
| Score ≥ umbral → sin reauditoría | Edge |
| Reauditoría suspendida no genera otra reauditoría (sin cascada); nace **sin** respuestas (hay que sembrarlas) | Edge |
| `require_training_before_reaudit` → reauditoría en `pending_training` | Edge |
| FAIL `non_operational`/engineering bloqueante → acción correctiva `open` + reauditoría `blocked_by_non_operational` | Happy |
| FAIL con `owner_department` → ítem en `department_backlog_items` | Happy |
| FAIL `training_only` → ni acciones ni backlog | Edge |

### 4. Roles y permisos (RLS) — `rls-permissions.test.ts` (13 tests)

| Caso | Tipo | Estado |
|---|---|---|
| Anónimo no lee hotels/profiles/runs | Failure | ✅ |
| `start_audit_run`/`submit_audit_run` revocados para `authenticated` (solo service-role) | Failure | ✅ |
| Auditor asignado ve área/runs/respuestas y puede editar respuestas (autosave) | Happy | ✅ |
| Auditor no ve acciones correctivas | Failure | ✅ |
| Admin ve hotel/áreas/profiles, cambia roles, crea plantillas, ve correctivas | Happy | ✅ |
| Auditor **sin** asignación no debería ver área/runs/respuestas | Failure | ⚠️ `it.fails` (gap) |
| Auditor no debería poder crear plantillas | Failure | ⚠️ `it.fails` (gap) |
| Auditor no debería poder escalar su propio rol a admin | Failure | ⚠️ `it.fails` (gap) |

### 5. Aislamiento entre hoteles — `hotel-isolation.test.ts` (15 tests)

| Caso | Tipo | Estado |
|---|---|---|
| Admin A no ve profiles de B | Failure | ✅ |
| Admin A no puede crear áreas en B (42501), ni modificar profiles/runs de B | Failure | ✅ |
| Auditor A solo lista runs de su hotel; no ve el run de B por id | Failure | ✅ |
| RPC: `submit_audit_run` cruzado → `FORBIDDEN_HOTEL` (run intacto); `start_audit_run` → `AREA_OUT_OF_SCOPE` | Failure | ✅ |
| `rpc_team_summary_v2` de A no cuenta auditorías de B | Happy | ✅ |
| Admin A no debería ver hotel B / áreas-plantillas-preguntas de B / runs-respuestas de B | Failure | ⚠️ `it.fails` (gap) |
| Admin A no debería poder **modificar respuestas** de runs de B | Failure | 🔴 `it.fails` (gap grave) |

## Reparación del RLS (aplicada)

**Migración:** `supabase/migrations/20260610120000_remove_legacy_permissive_rls_policies.sql`
**Backup del estado previo:** `docs/rls-policies-backup-2026-06-10.json` (las 214 policies con sus predicados, por si hay que revertir).

Causa raíz: las policies `sc_*` del hardening eran correctas, pero **nunca se eliminaron las policies permisivas anteriores**. Como las PERMISSIVE se combinan con OR, una sola policy laxa reabría el acceso. Los helpers legacy (`has_hotel_access`, `is_hotel_member`) además se basan en `hotel_memberships` —que la app puebla de forma inconsistente— mientras que los `sc_*` derivan el hotel de `profiles.hotel_id`, que es la fuente real.

Qué hizo la migración:

1. **Eliminó las policies legacy** de 10 tablas (`hotels`, `profiles`, `areas`, `audit_templates`, `audit_sections`, `audit_questions`, `audit_runs`, `audit_answers`, `user_area_access`), dejando solo el set canónico `*_scoped` / `*_admin_scoped`. Las peores eran las de `USING true` / `CHECK true` en `audit_answers` (`*_auth`), que daban lectura y escritura cross-hotel total.
2. **Reescribió `audit_sections_select_scoped` y `audit_questions_select_scoped`**, que estaban mal: solo comprobaban que la plantilla existiera, sin filtrar por hotel. Ahora exigen `t.hotel_id IS NULL OR sc_is_same_hotel(t.hotel_id)` (globales visibles para todos, las del hotel solo a su hotel).
3. **Añadió el trigger `prevent_profile_privilege_escalation`** sobre `profiles`: conserva el self-update (necesario para onboarding/aceptación de términos) pero bloquea con 42501 que un no-admin cambie su propio `role`, `hotel_id`, `active` o `is_trial`. Cierra la auto-escalada sin romper el flujo legítimo. Se mantuvo `profiles_update_own`; se eliminó `profiles_insert_own`.

Verificación: la suite completa pasa en verde (76/76), lo que confirma a la vez que **los 7 gaps quedaron cerrados** y que **los accesos legítimos siguen funcionando** (auditor asignado ve/edita su área, admin gestiona su hotel, self-update de perfil, RPCs transaccionales, agregados por hotel).

### Cambios de comportamiento a tener en cuenta

El modelo resultante es el del hardening (`sc_*`), más estricto que el revoltijo legacy. Si alguna pantalla dependía del comportamiento laxo, cambiará:

- **Managers** ya no pueden crear/editar/borrar **áreas ni plantillas** vía cliente directo (queda reservado a `admin`/`superadmin`). Si el producto requiere que los managers gestionen estructura, habría que añadir policies `sc_*` explícitas para `manager` (no reintroducir las legacy).
- **Auditores** solo ven áreas/runs/respuestas de las áreas que tienen **asignadas** (`user_area_access`), no todo el hotel.
- Escrituras server-side vía `supabaseAdmin` (service-role) **no se ven afectadas** (saltan RLS); el endurecimiento solo aplica al cliente `anon`/`authenticated`.

### Pendiente (fuera del alcance verificado por la suite)

La migración limpió las 10 tablas core. Quedan ~38 tablas con RLS que esta suite no cubre (notifications, billing, trainings, tasks, score_events, department_backlog_items, etc.). Conviene auditarlas con el mismo criterio (`pg_policies`) y extender la suite antes de limpiarlas.

## 🔴 Hallazgo de seguridad original: policies RLS permisivas legacy

Verificado contra la BD real (2026-06-09/10): las policies `sc_*` de las migraciones de hardening (`20260316140000_harden_prioritized_module_rls.sql` y posteriores) **conviven con policies permisivas anteriores que no se eliminaron**. Como las policies permisivas se combinan con OR, las restrictivas no tienen efecto en esos casos. Comportamiento observado:

1. **Un admin de un hotel puede LEER datos de otros hoteles**: hotels, areas, audit_templates, audit_questions, audit_runs y audit_answers (profiles y acciones correctivas sí están scoped).
2. **Un admin de un hotel puede MODIFICAR audit_answers de runs de otro hotel** — puede falsear resultados de auditorías ajenas. Es el gap más grave.
3. **Un auditor puede crear plantillas** en su hotel (escritura que debería ser de admin).
4. **Un auditor puede escalar su propio rol** (`update profiles set role='admin'` sobre sí mismo funciona) — probablemente una policy legacy tipo "users can update own profile" sin restringir columnas.
5. **Un auditor sin asignación de área ve áreas/runs/respuestas** de su hotel (el scoping por `user_area_access` no aplica en la práctica).

El patrón sugiere que admins pasan por un helper tipo `is_admin()` sin scoping por hotel, y que hay policies de lectura/escritura por pertenencia al hotel sin filtro de rol. **Acción recomendada:** auditar `pg_policies` en producción (`select * from pg_policies where schemaname='public'`), eliminar las policies que no sean las `sc_*` del hardening y re-ejecutar esta suite: los 7 tests `it.fails` pasarán a fallar "en verde", señal para promoverlos a `it` normales.

Los 7 tests marcados `it.fails` codifican el comportamiento **esperado** y actúan como detector: mantienen la suite verde hoy y avisarán en cuanto el RLS se corrija o el gap cambie.

## Otros comportamientos documentados por la suite

- El trigger de sync de profiles solo actúa **on INSERT** en `auth.users`; cambios de metadata posteriores no tocan `public.profiles`.
- `rpc_team_summary` solo agrega usuarios presentes en `area_template_target_assignments` para el periodo, y un caller `manager` solo ve áreas de su `user_area_access` (admin/quality ven todo el hotel).
- Las reauditorías automáticas nacen **sin respuestas sembradas** (el seed es exclusivo de `start_audit_run`).
- La validación de valores de respuesta vive en el CHECK constraint de BD, no en el RPC (el branch `INVALID_ANSWER_VALUE` es inalcanzable por escritura normal).

## No cubierto (fuera de alcance de esta suite)

- Route handlers de Next.js (`app/api/**`) — se testea la capa Supabase que invocan, no el HTTP.
- Storage (upload de fotos), Edge Functions, emails (Resend/Brevo), Stripe/billing.
- `get_audit_run_full`, `process_reaudit_action`, archivado de runs, trainings, notificaciones.
- Mystery shopper, gamificación (`score_events`/`user_scores`).