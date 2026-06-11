# Revisión completa de RLS — 2026-06-10

**Alcance:** las 62 tablas del schema `public` (tipos generados en `lib/types/database.ts`).
**Fuente de verdad:** dump real de `pg_policies` (`docs/rls-policies-backup-2026-06-10.json`, 214 policies, tomado de producción el 2026-06-10) menos los drops de la migración `20260610120000`, más las 101 migraciones del repo y grep de uso real en `app/`, `components/`, `hooks/`, `lib/`.
**Fix resultante:** `supabase/migrations/20260610140000_rls_close_secondary_gaps.sql`.

> Nota sobre roles: el sistema no tiene un rol "viewer" literal. Los roles de solo-lectura departamental son `engineering`, `it`, `systems`; el más parecido a "viewer" general es `general_manager` (lectura amplia de su hotel). `mystery_shopper` opera como auditor limitado a sus áreas asignadas.

---

## 1. Hallazgos

### Críticos (fuga de datos entre hoteles) — corregidos en 20260610140000

| # | Tabla | Problema |
|---|-------|----------|
| C1 | `audit_targets` | `audit_targets_select` con `USING (true)`: **cualquier autenticado leía los objetivos de auditoría de todos los hoteles**. Las policies `*_admin_quality` (insert/update/delete) comprobaban solo el rol del actor, sin cruzar hotel: un admin o quality del hotel A podía crear, editar o borrar targets del hotel B. Además `audit_targets_update_staff` tenía `WITH CHECK (true)`, que permitía reasignar `hotel_id` de una fila a otro hotel. |
| C2 | `hotel_settings` | Las tres policies `Authenticated users can view/insert/update hotel settings` solo exigían `auth.uid() IS NOT NULL`: **cualquier usuario autenticado de cualquier hotel podía leer y modificar la configuración (logo, contacto, idioma, moneda) de todos los hoteles**. El UPDATE además no tenía `WITH CHECK`. |
| C3 | `user_area_permissions`, `user_audit_permissions` | `uarep_admin_write` / `uap_admin_write` con `USING (is_admin())` sin acotar hotel: un admin de cualquier hotel podía conceder/revocar permisos de área y de auditoría a usuarios de otros hoteles. (Tablas sin uso en el código actual, pero expuestas vía PostgREST.) |
| C4 | RLS posiblemente deshabilitado | `area_targets`, `area_target_assignments`, `global_packs`, `global_pack_templates`, `hotel_quality_thresholds` no tienen `ENABLE ROW LEVEL SECURITY` en ninguna migración ni policies en el dump. Si `relrowsecurity` está apagado en prod, PostgREST las expone por completo a cualquier autenticado. La migración lo habilita (idempotente); como no tienen policies quedan deny-all, y la app solo las usa con service role (`hotel_quality_thresholds` vía `app/api/admin/quality-thresholds/route.ts`) o no las usa. **Verificar en prod con la query de la sección 5.** |

### Medios (exceso de privilegio dentro del hotel) — corregidos en 20260610140000

| # | Tabla | Problema |
|---|-------|----------|
| M1 | `departments` | insert/update/delete permitidos a **cualquier rol** del hotel (un auditor podía borrar departamentos). Ahora: lectura todo el hotel, escritura solo superadmin/admin (alineado con `areas`). |
| M2 | `team_members`, `team_member_areas` | Policies legacy (`team_members_*`, `tma_*`) permitían a cualquier rol del hotel escribir la plantilla de empleados, en paralelo al set canónico `sc_can_write_team_member` (superadmin/admin/GM/quality). Se eliminan las legacy. |
| M3 | `reaudit_training_logs`, `reaudit_assignment_logs` | `read ... by hotel` daba lectura a cualquier rol del hotel; el set `_scoped` la limita a superadmin/admin/GM/manager/quality. Se eliminan las legacy (lectura e insert redundante). |
| M4 | `standards`, `standard_libraries`, `standard_templates`, `standard_sections`, `standard_questions` | Policies legacy dependientes de helpers pre-hardening **no versionados en el repo** (`is_admin()`, `has_hotel_access()`, `current_hotel_id()`, `can_admin_hotel()`), con semántica no auditable. Reescritas con helpers `sc_*` conservando la semántica de lectura (scope `global` legible por cualquier autenticado, scope `hotel` solo el propio hotel) — necesario porque `app/(app)/standards/[id]/page.tsx` lee estas tablas con el cliente de navegador. |
| M5 | `hotel_memberships` | Modelo multi-hotel legacy sin uso en la app: `memberships_insert/update` permitían a "hotel admins" (según `hotel_role()`, sin versionar) gestionar membresías. Queda superadmin-only + lectura de la propia fila. |
| M6 | `profiles` | `profiles_select_same_hotel` (`hotel_id = my_hotel_id()`) exponía email y rol de toda la plantilla a cualquier rol, auditores incluidos. Eliminada; quedan `profiles_select_self` y `profiles_select_scoped` (roles elevados del mismo hotel vía `sc_can_read_profile`). Ver punto de verificación V3. |
| M7 | `audit_evidence` | Tabla legacy (la evidencia actual va a Storage + `photo_paths`): lectura sin requisito de rol vía `current_hotel_id()`. Realineada con `sc_can_view_run`/`sc_can_mutate_run`. |

### Bajos / aceptados (sin cambio, documentados)

- `plan_entitlements`: `SELECT` público con `USING (true)` — **intencional** (catálogo de planes para pricing).
- `hotels`: tres policies superadmin redundantes (`hotels_superadmin_manage`, `hotels_write_superadmin`, `superadmin_manage_hotels`). Inocuo; consolidable en una futura limpieza.
- `hotel_notification_settings`: una policy `ALL` para admin/GM/superadmin del mismo hotel. El superadmin solo alcanza el hotel de su propio profile (no cross-hotel); el panel superadmin usa service role, así que no bloquea nada.
- `hotel_audit_rules`: sin policy de `DELETE` (solo insert/update/select). Si el flujo de reglas necesita borrado cliente-side, añadirla; hoy no lo usa.
- `billing_accounts.update`: sin `WITH CHECK` explícito, pero Postgres aplica el `USING` (`owner_user_id = auth.uid()`) a la fila nueva → el owner no puede transferir la cuenta. Correcto.
- `score_events`, `user_scores`, `user_hotels`, `tasks`, `task_assignments`, `superadmins`, `notifications`, `department_backlog_items`, `hotel_departments`: solo lectura correctamente acotada (propia fila u hotel propio); escrituras vía service role/RPC. OK.

---

## 2. Estado por tabla (tras 20260610120000 + 20260610140000)

### Núcleo de auditorías (endurecido en 20260610120000, sin cambios aquí)

| Tabla | SELECT | INSERT/UPDATE/DELETE |
|-------|--------|----------------------|
| `hotels` | Mismo hotel (`sc_is_same_hotel`) o superadmin | Solo superadmin |
| `profiles` | Propio perfil; roles elevados (superadmin/admin/GM/manager/quality) ven su hotel | Admin de su hotel (sin crear superadmins); self-update blindado por trigger `trg_prevent_profile_escalation` (no puede tocar `role`/`hotel_id`/`active`/`is_trial`) |
| `areas` | `sc_can_view_area`: roles elevados todo su hotel; auditor/engineering/it/systems/mystery_shopper solo áreas asignadas | Solo superadmin/admin del hotel |
| `audit_templates` | Globales (`hotel_id IS NULL`) + las del propio hotel | `sc_can_mutate_template`: superadmin (globales), admin del hotel (propias) |
| `audit_sections`, `audit_questions` | Vía plantilla: global o del propio hotel | Igual que templates |
| `audit_runs` | `sc_can_view_run`: visibilidad de área + rol | INSERT/UPDATE `sc_can_mutate_run` (sin GM ni engineering/it/systems); DELETE solo superadmin/admin |
| `audit_answers` | `sc_can_view_run` del run | `sc_can_mutate_run`; DELETE solo superadmin/admin |
| `audit_corrective_actions` | `sc_can_read_corrective_action`: elevados todo el hotel, manager solo sus áreas | Solo UPDATE con el mismo predicado; INSERT/DELETE vía RPC |
| `user_area_access` | Propia fila o roles elevados del hotel | Solo superadmin/admin del hotel |
| `area_template_targets`, `area_template_target_assignments` | Roles operativos del hotel (incl. auditor) | Solo superadmin/admin del hotel |

### Endurecidas en 20260610140000

| Tabla | SELECT | Escrituras |
|-------|--------|-----------|
| `audit_targets` | superadmin/admin/quality del hotel | Ídem, con `WITH CHECK` que impide cambiar de hotel |
| `hotel_settings` | Todo el hotel (branding necesario para la UI) | Solo superadmin/admin del hotel; DELETE denegado |
| `user_area_permissions`, `user_audit_permissions` | Propia fila o admin del hotel del usuario objetivo | Admin del hotel del usuario objetivo |
| `departments` | Todo el hotel | Solo superadmin/admin del hotel |
| `team_members` | `sc_can_read_team_member`: elevados todo el hotel; manager solo empleados de sus áreas | `sc_can_write_team_member`: superadmin/admin/GM/quality |
| `team_member_areas` | `sc_can_read_team_member_area` (mismo patrón) | Ídem escritura |
| `reaudit_training_logs`, `reaudit_assignment_logs` | superadmin/admin/GM/manager/quality del hotel | INSERT mismo conjunto; sin UPDATE/DELETE |
| `standards` | Mismo hotel | Solo superadmin/admin del hotel |
| `standard_libraries`, `standard_templates` | `scope='global'` cualquiera; `scope='hotel'` el propio hotel | Global: superadmin; hotel: admin del hotel |
| `standard_sections`, `standard_questions` | Vía template (global u hotel propio) | Solo superadmin (`*_mutate_superadmin`) |
| `audit_evidence` | `sc_can_view_run` del answer | INSERT `sc_can_mutate_run`; sin UPDATE/DELETE |
| `hotel_memberships` | Propia fila o superadmin | Solo superadmin |
| `profiles` (extra) | Eliminada la lectura same-hotel universal | — |

### RLS habilitado, sin policies (deny-all deliberado: solo service role)

`trial_leads`, `admin_audit_log`, `api_cost_logs`, `billing_events`, `audit_template_members`, `training_topics`, `training_sessions`, `training_attendances`, `training_registration_tokens`, y tras esta migración también `area_targets`, `area_target_assignments`, `global_packs`, `global_pack_templates`, `hotel_quality_thresholds`.

Verificado: todos los accesos de la app a estas tablas pasan por route handlers con `supabaseAdmin` (p. ej. `lib/trainings/server.ts`, `lib/members/server.ts`, `app/api/admin/quality-thresholds/route.ts`).

### Resto (sin cambios, correctas)

`notifications` (propia fila), `report_subscriptions` (admin/GM/quality del hotel), `report_narratives` y `ai_training_suggestions` (lectura staff del hotel, escritura service role), `audit_logs` (lectura superadmin/admin/manager/quality del hotel), `department_backlog_items` y `hotel_departments` (lectura hotel), `billing_accounts`/`billing_subscriptions` (owner), `plan_entitlements` (público intencional), `score_events`/`user_scores` (lectura hotel), `user_hotels`/`task_assignments`/`tasks` (propia fila), `superadmins` (solo superadmin), `hotel_audit_rules` (lectura staff, escritura admin), `global_audit_packs`/`global_audit_pack_templates` (lectura superadmin/admin, escritura superadmin).

---

## 3. Matriz de acceso efectiva por rol (tras ambas migraciones)

| Recurso | superadmin | admin | general_manager | manager | quality | auditor / mystery_shopper | engineering / it / systems |
|---|---|---|---|---|---|---|---|
| Hoteles (otros) | R/W | — | — | — | — | — | — |
| Su hotel (fila) | R/W | R | R | R | R | R | R |
| Perfiles del hotel | R/W | R/W | R | R | R | solo el suyo | solo el suyo |
| Áreas | R/W | R/W | R | R | R | R (asignadas) | R (asignadas) |
| Plantillas | R/W (+globales) | R/W | R | R | R | R | R |
| Runs/Answers | R/W | R/W | R | R/W | R/W | R/W (asignadas) | — |
| Acciones correctivas | R/W | R/W | R/W | R/W (sus áreas) | R/W | — | vía RPC scoped |
| Equipo (team_members) | R/W | R/W | R/W | R (sus áreas) | R/W | — | — |
| Targets de auditoría | R/W | R/W | — | — | R/W | — | — |
| Settings del hotel | R/W | R/W | R | R | R | R | R |
| Departamentos | R/W | R/W | R | R | R | R | R |
| Biblioteca global de estándares | R/W | R | — | — | — | — | — |
| Billing | — (owner) | — (owner) | — | — | — | — | — |

---

## 4. Qué hace la migración `20260610140000_rls_close_secondary_gaps.sql`

1. **Habilita RLS** (idempotente) en las 5 tablas sin constancia de RLS y, defensivamente, en las 13 tablas legacy cuyas policies se crearon vía dashboard.
2. **`audit_targets`**: elimina el select universal y las escrituras sin hotel; recrea el set `sc_*` para superadmin/admin/quality del hotel con `WITH CHECK` correcto.
3. **`hotel_settings`**: lectura para el propio hotel, escritura solo admin.
4. **`user_area_permissions` / `user_audit_permissions`**: acotadas por el hotel del usuario objetivo (las tablas no tienen `hotel_id`).
5. **`departments`**: escritura restringida a admin.
6. **`team_members` / `team_member_areas` / `reaudit_*_logs`**: elimina las policies legacy permisivas; queda el set canónico.
7. **`standards` / `standard_*`**: reescritas con helpers `sc_*` conservando la semántica de lectura que usa la página de standards.
8. **`audit_evidence`**: alineada con la visibilidad real de runs.
9. **`hotel_memberships`**: superadmin-only + lectura propia.
10. **`profiles`**: elimina la lectura same-hotel universal.

---

## 5. Revisión manual antes de aplicar

**V1 — Confirmar `relrowsecurity` en prod** (el repo no puede saberlo; ejecutar en el SQL editor):

```sql
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;
```

Cualquier tabla con `relrowsecurity = false` antes de la migración estaba expuesta; revisar logs de acceso si aplica.

**V2 — Orden de aplicación:** esta migración asume aplicada `20260610120000` (la suite de integración 76/76 lo confirmó el 2026-06-10). Verificar en `supabase migration list` que prod está al día antes de aplicar.

**V3 — Lectura de perfiles por roles no elevados:** al quitar `profiles_select_same_hotel`, un auditor ya no puede leer perfiles de compañeros con el cliente de navegador. Los flujos detectados (login, onboarding, `hooks/useProfile.ts`, página de equipo —restringida a roles elevados—, desplegable de colaboradores vía RPC `get_audit_run_full` y route handlers) no lo necesitan. Si alguna vista de auditor muestra nombres de otros usuarios consultando `profiles` directamente, reintroducir una policy de lectura limitada a columnas no sensibles vía vista.

**V4 — Página de standards:** `app/(app)/standards/[id]/page.tsx` lee `standard_*` con el cliente de navegador. La semántica de lectura se conserva, pero conviene smoke-test con un usuario no-admin tras aplicar.

**V5 — Helpers legacy huérfanos:** tras esta migración, `is_admin()`, `has_hotel_access()`, `current_hotel_id()`, `my_hotel_id()`, `can_admin_hotel()`, `can_manage_areas()`, `hotel_role()` quedan sin referencias en policies (e `is_superadmin()`/`is_hotel_member()` solo en `hotels`/`hotel_memberships`/`superadmins`). **No se eliminan aquí** por si los usa alguna vista o RPC; auditarlos con `_sc_dump_funcs`-style antes de droparlos en una migración posterior.

**V6 — Tablas candidatas a eliminación** (sin uso en código; reducirían superficie): `audit_targets`, `area_targets`, `area_target_assignments`, `global_packs`, `global_pack_templates`, `standards`, `audit_evidence`, `user_area_permissions`, `user_audit_permissions`, `user_hotels`, `hotel_memberships`, `user_scores`, `score_events`, `tasks`, `task_assignments`, `superadmins`, `hotel_settings` (esta última, confirmar que ninguna Edge Function ni vista la usa antes).

**V7 — Tras aplicar:** correr `npm run test:integration` (76 tests) y considerar añadir casos para `audit_targets` y `hotel_settings` (cross-hotel read/write deben fallar).