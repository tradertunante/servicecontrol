# ServiceControl - Known Issues

Este archivo registra problemas técnicos detectados en el repositorio.

Objetivo:
mantener memoria operativa para agentes y desarrolladores, evitando redescubrir el mismo problema varias veces.

---

## Formato

Cada issue debe registrar:

- fecha
- síntoma
- causa raíz
- solución aplicada
- cómo evitarlo en el futuro
- archivos relacionados

---

## Issue 1

### Fecha
2026-03-10

### Síntoma
`submitAudit` ejecuta lógica crítica desde cliente y realiza múltiples escrituras separadas.

### Causa raíz
La implementación actual en `app/(app)/audits/[id]/page.tsx` resuelve en frontend:

- validación final de evidencia
- cálculo de score
- creación de corrective actions
- creación de reauditoría automática
- actualización final de `audit_runs`

Esto deja la operación sin atomicidad real y con riesgo de inconsistencias.

### Solución aplicada
Resuelto parcialmente en dos capas complementarias:

- `POST /api/audits/submit` delega el submit final a la RPC transaccional `submit_audit_run(...)`
- `POST /api/audits/[id]/draft` y `PATCH /api/audits/[id]/metadata` eliminan los writes directos desde `useAuditSession`
- `POST /api/audits/start` siembra respuestas draft desde servidor para que la auditoría no dependa de seed cliente

Queda pendiente únicamente seguir endureciendo atomicidad del create inicial si se quiere llevar también esa fase a RPC.

### Cómo evitarlo en el futuro
- no implementar operaciones críticas multi-tabla en cliente
- usar una única unidad transaccional para cambios de estado operativos
- tratar el frontend solo como capa de UX y no de autoridad final

### Archivos relacionados
- `app/(app)/audits/[id]/_hooks/useAuditSession.ts`
- `app/api/audits/[id]/draft/route.ts`
- `app/api/audits/[id]/metadata/route.ts`
- `app/api/audits/start/route.ts`
- `app/api/audits/submit/route.ts`
- `app/(app)/team/_components/CorrectiveActionsPanel.tsx`
- `app/(app)/team/_hooks/useReauditActions.ts`

---

## Issue 2

### Fecha
2026-03-10

### Síntoma
Riesgo de reauditorías automáticas duplicadas si hay retries, doble submit o carreras.

### Causa raíz
La creación de reauditorías hoy depende del flujo cliente y no está blindada por una operación transaccional única ni por una restricción estructural explícita.

### Solución aplicada
Pendiente.

Solución planificada:
- lock del `audit_run` durante submit
- búsqueda/reuso de reauditoría existente
- constraint/índice único lógico para una sola reauditoría automática por `parent_audit_run_id + origin_type`

### Cómo evitarlo en el futuro
- cualquier operación derivada de submit debe ejecutarse dentro de la misma transacción
- reforzar reglas de unicidad en base de datos además de validación lógica

### Archivos relacionados
- `app/(app)/audits/[id]/page.tsx`
- `app/(app)/team/_hooks/useReauditsData.ts`

---

## Issue 3

### Fecha
2026-03-10

### Síntoma
Riesgo de corrective actions duplicadas para la misma pregunta fallida de una auditoría.

### Causa raíz
Las corrective actions se generan en submit desde cliente y no existe aún una estrategia formal de idempotencia o constraint estructural documentada para evitar duplicación.

### Solución aplicada
Pendiente.

Solución planificada:
- generar acciones en backend transaccional
- consultar existentes antes de insertar
- reforzar con unicidad lógica por `audit_run_id + question_id`

### Cómo evitarlo en el futuro
- no permitir inserts derivados duplicables en flows con retries
- definir claves naturales de unicidad para datos derivados

### Archivos relacionados
- `app/(app)/audits/[id]/page.tsx`
- `app/(app)/team/_components/CorrectiveActionsPanel.tsx`

---

## Issue 4

### Fecha
2026-03-10

### Síntoma
El contexto multi-hotel está repartido entre `profiles.hotel_id` y `localStorage["sc_hotel_id"]`.

### Causa raíz
El sistema soporta escenarios distintos para usuarios normales y `superadmin`, pero el contexto de hotel no está completamente centralizado.

### Solución aplicada
Resuelto el 2026-03-17.

Se cerró la ambigüedad con una única resolución canónica server-side:

- `lib/auth/server.ts` concentra la resolución de hotel activo para todos los roles
- usuarios normales quedan anclados a `profiles.hotel_id`
- `superadmin` usa el hotel seleccionado en cookie, pero ya no como excepción repartida por páginas/hooks sino a través de la misma abstracción server-side
- páginas server-side relevantes entregan `hotelId` ya resuelto al cliente
- hooks y módulos cliente críticos dejaron de decidir scope mezclando `profile.hotel_id` con `fetchActiveHotel()`

### Cómo evitarlo en el futuro
- no leer `profile.hotel_id` ni `sc_hotel_id` directamente en páginas/hooks para decidir scope real
- entrar siempre por `requirePageAccess(..., requireHotel: true)`, `requireHotelScope(...)` o `resolveRouteHotelScope(...)`
- si una superficie cliente necesita el hotel activo, recibirlo como prop desde el borde server-side

### Archivos relacionados
- `app/(app)/home/page.tsx`
- `app/components/HotelHeader.tsx`
- `app/(app)/dashboard/_hooks/useDashboardData.ts`
- `app/(app)/admin/_components/AdminShell.tsx`
- `lib/auth/server.ts`
- `app/(app)/team/_hooks/useTeamWorkspace.ts`
- `app/(app)/members/_components/MembersModule.tsx`

---

## Issue 5

### Fecha
2026-03-10

### Síntoma
Tipos de dominio y de tablas están duplicados o redefinidos en múltiples módulos.

### Causa raíz
No existe aún una fuente tipada única generada desde Supabase. El repo usa muchos tipos locales por pantalla o hook.

### Solución aplicada
Pendiente.

Solución recomendada:
- generar tipos oficiales desde Supabase
- consolidar tipos compartidos del dominio
- reducir tipos ad hoc por pantalla

### Cómo evitarlo en el futuro
- no volver a definir manualmente la misma entidad en muchos lugares
- usar una capa compartida para tablas y enums de negocio

### Archivos relacionados
- `lib/types.ts`
- `app/(app)/dashboard/_lib/*`
- `app/(app)/areas/[areaId]/_lib/*`
- `app/(app)/team/_lib/*`

---

## Cómo registrar nuevos issues

Añadir nuevas entradas siguiendo exactamente este formato.

Si el issue quedó resuelto:
- mantenerlo en el archivo
- actualizar “solución aplicada”
- indicar claramente qué cambió
- dejar aprendizaje para futuros agentes

---

## Issue 7

### Fecha
2026-03-16

### Síntoma
El módulo de `members` podía fallar al crear o editar colaboradores por `employee_number` existente en otro hotel, y además resolvía el hotel activo del cliente desde `localStorage` aunque el usuario normal ya tenía `profiles.hotel_id`.

### Causa raíz
El flujo dependía de dos piezas sueltas:

- el cliente de `members` tomaba `hotel_id` desde `localStorage["sc_hotel_id"]` para todos los roles, en vez de fijar `profiles.hotel_id` como fuente de verdad para usuarios no `superadmin`
- la API de `members` no hacía una validación previa explícita por `(hotel_id, employee_number)` y confiaba solo en el `23505` devuelto por la base de datos

Aunque en el repo ya existía un índice único compuesto por hotel, seguía faltando blindar el flujo server-side y hacer explícita la resolución de hotel por rol dentro del módulo.

### Solución aplicada
Se corrigió el módulo para que:

- usuarios normales resuelvan `hotel_id` desde `profiles.hotel_id`
- `localStorage["sc_hotel_id"]` quede reservado solo para `superadmin`
- `POST /api/members` y `PATCH /api/members/[id]` validen duplicados por `(hotel_id, employee_number)` antes de insertar o actualizar
- la base de datos elimine cualquier unicidad global residual sobre `team_members.employee_number` y conserve un único índice parcial compuesto por `(hotel_id, employee_number)`

---

## Issue 8

### Fecha
2026-03-16

### Síntoma
El módulo `superadmin` todavía ejecutaba mutaciones globales sensibles desde cliente con `supabase` browser-side.

### Causa raíz
Las pantallas de `superadmin` hacían `insert`, `update` y `delete` directos sobre recursos globales como:

- `audit_templates`
- `audit_questions`
- `audit_sections`
- `global_audit_packs`
- `global_audit_pack_templates`
- `hotels`

Eso dejaba el control visible apoyado en RLS + cliente, con permisos dispersos en UI y sin un borde HTTP explícito reutilizable.

### Solución aplicada
Se movieron las mutaciones globales activas del módulo detrás de `app/api/superadmin/**` con validación server-side de:

- usuario autenticado
- rol `superadmin`
- recurso objetivo válido
- payload permitido

La UI solo conservó las lecturas con Supabase browser y pasó las escrituras sensibles a `fetch` contra endpoints server-side.

### Cómo evitarlo en el futuro
- no introducir nuevas mutaciones globales de `superadmin` directo desde `supabaseClient`
- si una operación crea, edita o asocia recursos globales, exponerla primero en `app/api`
- tratar RLS como defensa adicional, no como única frontera visible

### Archivos relacionados
- `app/superadmin/templates/*`
- `app/superadmin/global-audits/*`
- `app/superadmin/hotels/*`
- `app/api/superadmin/**`
- `lib/superadmin/server.ts`

---

## Issue 9

### Fecha
2026-03-16

### Síntoma
Seguían existiendo páginas sueltas que usaban `requireRoleOrRedirect(...)` o gating equivalente en cliente aunque el acceso real del segmento ya estaba o debía estar controlado server-side.

### Causa raíz
Las primeras pasadas endurecieron segmentos completos, pero quedaron residuos en pages puntuales:

- `app/(app)/audits/[id]/view/page.tsx`
- `app/(app)/members/page.tsx`
- `app/(app)/task/page.tsx`
- `app/(app)/my/page.tsx`
- `app/(app)/formaciones/page.tsx`

Eso mantenía checks duplicados, incoherentes o más restrictivos que la política real del servidor.

### Solución aplicada
Se eliminaron los guards client-side a nivel página y se dejó el control real en:

- layouts server-side del segmento
- `requireRole(...)`
- `requireModuleAccess(...)`
- `requireAuditRunScope(...)`

En `audits/[id]/view` se removió además un check cliente que bloqueaba indebidamente a roles ya permitidos por el layout (`superadmin` y `quality`).

### Cómo evitarlo en el futuro
- no añadir `requireRoleOrRedirect(...)` en pages bajo segmentos ya cerrados server-side
- si una ruta depende de un recurso concreto, validar ese recurso en layout o helper server-side
- dejar los componentes cliente solo para UX y carga de datos permitidos

### Archivos relacionados
- `app/(app)/audits/[id]/view/page.tsx`
- `app/(app)/members/page.tsx`
- `app/(app)/task/page.tsx`
- `app/(app)/my/page.tsx`
- `app/(app)/formaciones/page.tsx`

---

## Issue 8

### Fecha
2026-03-16

### Síntoma
Varias rutas App Router protegidas seguían confiando en `requireRoleOrRedirect(...)` dentro de páginas cliente, por lo que un acceso directo por URL podía iniciar render y bootstrapping antes del control real server-side.

### Causa raíz
El repo ya tenía helpers server-side y algunos layouts protegidos, pero faltaba cerrar de forma consistente:

- `dashboard`, que no tenía layout server-side propio
- segmentos hotel-dependientes que validaban rol en servidor pero no exigían hotel activo antes de renderizar
- `team/page`, que resolvía la redirección principal solo con lógica cliente

### Solución aplicada
Se endureció el acceso App Router con una capa reutilizable:

- `requirePageAccess(...)` en `lib/auth/server.ts` para combinar rol/módulo + hotel scope
- layouts server-side con hotel scope en `dashboard`, `admin`, `builder`, `standards`, `users`, `areas`, `reports` y subzonas operativas de `team`
- `app/(app)/team/page.tsx` convertido a redirección server-side según rol

### Cómo evitarlo en el futuro
- cualquier zona protegida nueva debe cerrar acceso desde layout o página server antes del primer render
- si la pantalla depende de hotel activo o área concreta, validar ese scope en servidor y no solo en hooks cliente
- mantener checks cliente solo como UX secundaria, nunca como autoridad de acceso

### Archivos relacionados
- `lib/auth/server.ts`
- `app/(app)/dashboard/layout.tsx`
- `app/(app)/admin/layout.tsx`
- `app/(app)/builder/layout.tsx`
- `app/(app)/areas/layout.tsx`
- `app/(app)/reports/layout.tsx`
- `app/(app)/team/page.tsx`

---

## Issue 9

### Fecha
2026-03-16

### Síntoma
Tras cerrar el acceso real server-side en App Router, seguían existiendo páginas de `superadmin`, `standards`, `users` y `builder` que todavía ejecutaban `requireRoleOrRedirect(...)` o checks equivalentes en cliente como si fueran el control principal.

### Causa raíz
El repo quedó en un estado híbrido:

- el acceso real ya se resolvía por `layout.tsx` server-side
- varias páginas cliente seguían cargando perfil y rol con una semántica de pseudo-seguridad
- eso mezclaba responsabilidad de seguridad con bootstrap de UI y dejaba señales engañosas en el código

### Solución aplicada
Se completó la limpieza residual:

- eliminación de `requireRoleOrRedirect(...)` en `app/superadmin/*`, `app/(app)/standards/*`, `app/(app)/users/*` y `app/(app)/builder/*`
- incorporación de `getClientProfile()` como helper neutral para los casos donde el perfil sigue siendo necesario para render o decidir hotel activo
- sin cambios de permisos: la seguridad real sigue viviendo en layouts y helpers server-side

### Cómo evitarlo en el futuro
- si un segmento ya está blindado por layout o por page server-side, no reintroducir auth cliente como autoridad
- usar helpers cliente de perfil solo para render, no para control de acceso
- al migrar un segmento, completar también la limpieza de checks residuales para evitar ambigüedad arquitectónica

### Archivos relacionados
- `lib/auth/clientProfile.ts`
- `app/superadmin/*`
- `app/(app)/standards/*`
- `app/(app)/users/*`
- `app/(app)/builder/*`

---

## Issue 11

### Fecha
2026-03-17

### Síntoma
Rutas protegidas de `areas`, `reports`, `standards` e `history` seguían leyendo perfil o sesión cliente para decidir acceso o bootstrap crítico.

### Causa raíz
El layout server-side ya existía, pero faltaba completar la última milla en páginas reales e hooks:

- `standards/page`
- `areas/page`
- `areas/order/page`
- `areas/[areaId]`
- `areas/[areaId]/history`
- `areas/[areaId]/history/[runId]`
- `reports/weekly/area/[areaId]`
- `reports/monthly/area/[areaId]`
- `reports/audit/[runId]`

### Solución aplicada
Se reemplazaron las pages reales por wrappers server-side y se dejaron los clients solo con props ya autorizadas y `fetch` autenticado para acciones.

Se eliminaron:

- `getClientProfile()` como barrera en esas rutas
- checks cliente de rol/permisos
- resolución de hotel en navegador para decidir acceso en esas pantallas

### Cómo evitarlo en el futuro
- si una ruta ya está cerrada por layout o helper server-side, no volver a consultar sesión cliente para decidir acceso
- usar `supabase.auth.getSession()` en cliente solo para adjuntar bearer tokens a APIs permitidas
- si un client necesita rol o hotel para render, recibirlo por props desde un wrapper server-side

### Archivos relacionados
- `app/(app)/standards/*`
- `app/(app)/areas/*`
- `app/(app)/reports/*`

---

## Issue 10

### Fecha
2026-03-16

### Síntoma
Algunas APIs privilegiadas seguían validando autenticación y hotel activo, pero no siempre cerraban toda la autorización contextual del recurso objetivo.

### Causa raíz
Quedaban tres patrones de riesgo:

- endpoints administrativos que comprobaban hotel del target pero no si el actor podía administrar el rol del usuario objetivo
- endpoints de acceso por área que aceptaban `user_id` del cliente sin validar capacidad real de administrar a ese usuario
- `POST /api/audits/submit` confiaba en autenticación y en la RPC downstream, sin validar en la propia API el scope real del run y del área

### Solución aplicada
Se endurecieron los bordes HTTP para que la API valide explícitamente:

- acceso de administración real sobre el usuario objetivo en `admin/delete-user` y `admin/user-area-access/*`
- hotel y área reales del `audit_run` en `audits/submit`
- restricción adicional para que un `auditor` solo pueda enviar auditorías ejecutadas por sí mismo

### Cómo evitarlo en el futuro
- no asumir que la RPC o la UI reemplazan la autorización del endpoint
- cuando un endpoint opere sobre un recurso ajeno, validar actor + target + scope en la misma API
- si el target es un usuario, reutilizar un helper compartido para hotel scope y capacidad de administración del rol objetivo

### Archivos relacionados
- `app/api/admin/delete-user/route.ts`
- `app/api/admin/user-area-access/get/route.ts`
- `app/api/admin/user-area-access/set/route.ts`
- `app/api/audits/submit/route.ts`
- `lib/auth/userManagement.ts`

### Cómo evitarlo en el futuro
- no usar `localStorage` como fuente primaria de `hotel_id` en módulos que ya pueden resolver el perfil autenticado
- cuando una regla de unicidad sea multi-tenant, validar siempre con su scope completo en server-side
- mantener la restricción estructural en DB alineada con la validación lógica del handler

### Archivos relacionados
- `app/(app)/members/_components/MembersModule.tsx`
- `app/api/members/route.ts`
- `app/api/members/[id]/route.ts`
- `supabase/migrations/20260316123000_fix_team_members_employee_number_scope.sql`

---

## Issue 8

### Fecha
2026-03-16

### Síntoma
El registro público de asistencia en `/formaciones/registro/[token]` fallaba en producción con `Could not find the 'team_member_id' column of 'training_attendances' in the schema cache`.

### Causa raíz
El flujo actual de formaciones ya insertaba `team_member_id`, pero el esquema histórico de `training_attendances` seguía dependiendo de `employee_profile_id not null`. Además, había entornos donde el schema cache de PostgREST no estaba refrescado tras introducir `team_member_id`.

### Solución aplicada
Se agregó una migración aditiva para:

- asegurar `training_attendances.team_member_id`
- mantener `employee_profile_id` pero quitarle el `not null`
- refrescar el schema cache con `notify pgrst, 'reload schema'`

También se ajustó `app/api/trainings/attendances/route.ts` para que:

- resuelva `team_member_id` por `employee_number` cuando exista match
- permita registrar asistencia manual aunque no exista match en `team_members`
- deje `team_member_id = null` en esos casos sin romper el insert

### Cómo evitarlo en el futuro
- no dejar rutas activas apuntando a columnas nuevas sin una migración idempotente que también refresque PostgREST
- cuando un flujo migra de `profiles` a `team_members`, mantener compatibilidad con columnas heredadas hasta terminar la transición
- para registros públicos, tolerar identidad parcial y no depender de una relación estricta si el negocio permite captura manual

### Archivos relacionados
- `supabase/migrations/20260316103000_fix_training_attendances_schema_for_manual_registration.sql`
- `app/api/trainings/attendances/route.ts`

---

## Issue 6

### Fecha
2026-03-11

### Síntoma
En el dashboard de área, el panel "Clasificaciones con más FAIL" aparecía vacío o incompleto mientras "Estándares con más FAIL" sí mostraba resultados.

### Causa raíz
El ranking por clasificación en `app/(app)/areas/[areaId]/_components/DashboardPanel.tsx` dependía de `audit_questions.classification`, pero el builder/importador del sistema usa `CLASSIFICATION` para resolver la sección (`audit_sections`) y no persiste ese valor en la pregunta. Como resultado, muchas preguntas quedaban con `classification` nula aunque sí tenían sección válida.

### Solución aplicada
Se alineó el dashboard de área con el modelo efectivo actual del sistema:

- en `app/(app)/areas/[areaId]/_hooks/useAreaData.ts`, la clasificación de cada pregunta ahora usa `audit_questions.classification` si existe y, si no, hace fallback a `audit_sections.name`
- en `app/(app)/areas/[areaId]/_components/HistoryPanel.tsx`, el filtro por clasificación usa la misma regla para que el click desde el ranking abra las auditorías correctas

### Cómo evitarlo en el futuro
- no duplicar el concepto de clasificación entre columna de pregunta y nombre de sección sin definir una fuente de verdad única
- si se vuelve a introducir `audit_questions.classification` como dato formal, poblarla y mantenerla de forma consistente en importación, edición y reporting
- cuando un panel agregue por clasificación, reutilizar una "clasificación efectiva" común en vez de leer columnas opcionales de forma directa

### Archivos relacionados
- `app/(app)/areas/[areaId]/_hooks/useAreaData.ts`
- `app/(app)/areas/[areaId]/_components/DashboardPanel.tsx`
- `app/(app)/areas/[areaId]/_components/HistoryPanel.tsx`
- `app/(app)/builder/[templateId]/import/page.tsx`

---

## Issue 7

### Fecha
2026-03-11

### Síntoma
Una auditoría podía mostrar `100%` y `0 hallazgos` incluso cuando el auditor había marcado varios `FAIL` antes de enviar.

### Causa raíz
Se detectaron dos causas encadenadas:

1. La página de detalle de auditoría leía `audit_answers` de forma incompleta y dependía de `result`, cuando el sistema puede tener datos mixtos entre `answer` y `result`.
2. El submit dependía de que `flushAll()` dejara persistidas todas las respuestas antes de llamar a `submit_audit_run`, pero el autosave tenía una carrera: una acción ya iniciada podía desaparecer de la cola antes de terminar el `upsert`, permitiendo que el RPC leyera valores viejos en DB.

### Solución aplicada
Se corrigió el problema en dos capas:

- en `app/(app)/audits/[id]/view/page.tsx`, todas las lecturas del detalle ahora normalizan con `answer ?? result`
- en `app/(app)/audits/[id]/_hooks/useAuditAutosave.ts`, `flushAll()` ahora espera también saves en vuelo, no solo saves pendientes
- en `app/(app)/audits/[id]/_hooks/useAuditSession.ts`, justo antes del submit se fuerza un `upsert` final de `answersByQ` hacia `audit_answers` para asegurar que el RPC calcule score con el estado local más reciente

### Cómo evitarlo en el futuro
- cualquier read path de `audit_answers` debe normalizar desde `answer` primero y luego `result`
- no asumir que una cola de autosave vacía implica que no hay escrituras en vuelo
- antes de ejecutar operaciones críticas server-side, sincronizar explícitamente el estado local relevante si el flujo depende de autosave asíncrono
- no introducir nuevas lecturas o reportes sobre `audit_answers` que dependan solo de una de las dos columnas sin documentarlo

### Archivos relacionados
- `app/(app)/audits/[id]/view/page.tsx`
- `app/(app)/audits/[id]/_hooks/useAuditAutosave.ts`
- `app/(app)/audits/[id]/_hooks/useAuditSession.ts`
- `supabase/migrations/20260310_120000_submit_audit_run_rpc.sql`

---

## Issue 8

### Fecha
2026-03-16

### Síntoma
Los módulos priorizados de seguridad seguían teniendo huecos concretos de escalada y scope: `admin` podía crear/promover `superadmin`, `auditor` podía leer `profiles` same-hotel, `manager` podía consultar `audit_logs` sin `area_id` y la RLS de builder/team members seguía más amplia que las reglas de negocio.

### Solución aplicada
- roles asignables centralizados y aplicados en `create-user` y `update user`
- edición sensible de usuarios movida a API server-side
- `profiles` endurecida con lectura propia + lectura same-hotel solo para roles operativos elevados
- endpoint limitado `/api/profiles/names` para resolver nombres en áreas sin reabrir `profiles`
- templates globales mutables solo por `superadmin`
- `team_members` y `team_member_areas` bloqueados para mutación directa de manager
- `audit-logs` endurecido para exigir `area_id` a managers

### Archivos relacionados
- `lib/auth/permissions.tsx`
- `lib/auth/server.ts`
- `lib/auth/userManagement.ts`
- `app/api/admin/create-user/route.ts`
- `app/api/admin/users/route.ts`
- `app/api/admin/users/[id]/route.ts`
- `app/api/audit-logs/route.ts`
- `app/api/profiles/names/route.ts`
- `supabase/migrations/20260316170000_close_remaining_security_gaps.sql`

---

## Issue 9

### Fecha
2026-03-16

### Síntoma
Fuera de los módulos priorizados seguían existiendo patrones repetidos de seguridad: `trainings` con endpoint público demasiado abierto, `superadmin` y `standards` protegidos solo en cliente, rutas secundarias sin auth server-side y tablas globales/secundarias sin cobertura RLS clara.

### Solución aplicada
- `trainings/attendances` ahora exige `registration_token` firmado y consumible una sola vez
- `trainings/topics`, `trainings/sessions` y `trainings/history` validan hotel scope y area scope real
- layouts server-side añadidos para `superadmin`, `standards`, `audits`, `analytics`, `task`, `my` y `formaciones`
- mutaciones de `standards` movidas a `/api/standards/actions`
- endpoints legacy `user-management/*` delegados a la capa admin actual
- migración `20260316190000_preventive_hardening_secondary_surfaces.sql` versiona RLS para assets globales, standards, tasks y tokens de registro

### Archivos relacionados
- `lib/trainings/server.ts`
- `app/api/trainings/topics/route.ts`
- `app/api/trainings/sessions/route.ts`
- `app/api/trainings/history/route.ts`
- `app/api/trainings/attendances/route.ts`
- `app/api/standards/actions/route.ts`
- `app/(app)/layout.tsx`
- `app/superadmin/layout.tsx`
- `app/(app)/standards/layout.tsx`
- `app/(app)/audits/layout.tsx`
- `app/(app)/audits/[id]/layout.tsx`
- `app/(app)/analytics/layout.tsx`
- `app/(app)/task/layout.tsx`
- `app/(app)/my/layout.tsx`
- `app/(app)/formaciones/layout.tsx`
- `supabase/migrations/20260316190000_preventive_hardening_secondary_surfaces.sql`
