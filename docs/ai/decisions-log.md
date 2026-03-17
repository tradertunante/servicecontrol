# ServiceControl - Decisions Log

Este archivo registra decisiones relevantes de arquitectura y diseño técnico.

Objetivo:
dejar trazabilidad clara de por qué se eligió una dirección y qué impacto se espera.

---

## Formato

Cada decisión debe registrar:

- fecha
- decisión
- contexto
- alternativas consideradas
- decisión final
- impacto esperado

---

## Decisión 1

### Fecha
2026-03-10

### Decisión
Tratar `submitAudit` como una operación crítica de arquitectura, no como una simple acción de UI.

### Contexto
El flujo actual de submit vive principalmente en cliente y ejecuta varias operaciones críticas:

- cálculo de score
- validación final
- creación de corrective actions
- creación de reauditoría
- update final de `audit_runs`

Esto afecta integridad de negocio, consistencia histórica y seguridad operativa.

### Alternativas consideradas
- mantener submit en cliente con pequeños parches
- mover submit a route handler con múltiples queries desde Node
- mover submit a una operación transaccional en base de datos

### Decisión final
Migrar `submitAudit` a una unidad server-side transaccional.

### Impacto esperado
- mayor integridad de datos
- menos riesgo de estados parciales
- base más segura para reauditorías y reporting
- menor dependencia del cliente como fuente de verdad

---

## Decisión 2

### Fecha
2026-03-10

### Decisión
Usar una combinación de Next.js route handler + RPC SQL para el submit de auditoría.

### Contexto
El submit necesita dos cosas a la vez:

- autorización y borde HTTP claro
- atomicidad real entre múltiples lecturas e inserciones

Un route handler por sí solo no garantiza atomicidad multi-query real con `supabase-js`.

### Alternativas consideradas
- route handler con toda la lógica en TypeScript
- RPC SQL llamada directamente desde cliente
- route handler que delega en RPC SQL

### Decisión final
Adoptar:

- route handler de Next.js para autenticación/autorización y contrato HTTP
- RPC SQL para la lógica transaccional de negocio

### Impacto esperado
- equilibrio entre seguridad, atomicidad y mantenibilidad
- mejor control de errores
- menor exposición directa de una operación crítica al cliente

---

## Decisión 3

### Fecha
2026-03-10

### Decisión
Diseñar `submitAudit` como operación idempotente por `audit_run`.

### Contexto
Un usuario puede hacer doble click, un request puede repetirse, o puede haber reintentos por red. Si el submit no es idempotente, se pueden duplicar efectos secundarios.

### Alternativas consideradas
- tratar un segundo submit como error duro
- permitir reejecución completa del flujo
- devolver éxito idempotente si el run ya quedó enviado

### Decisión final
Si el `audit_run` ya está `submitted`, devolver respuesta idempotente y no repetir side effects.

### Impacto esperado
- menos duplicación
- menos errores por retries
- comportamiento más robusto en producción

---

## Decisión 4

### Fecha
2026-03-10

### Decisión
Bloquear la fila de `audit_runs` durante submit usando locking a nivel DB.

### Contexto
Dos submits concurrentes sobre el mismo run pueden competir por:

- crear reauditoría
- insertar corrective actions
- cambiar estado del run

### Alternativas consideradas
- no usar locking y confiar en checks lógicos
- locking en aplicación
- locking de fila en Postgres

### Decisión final
Usar `SELECT ... FOR UPDATE` sobre la fila del run durante la transacción.

### Impacto esperado
- protección contra carreras
- serialización natural del submit por run
- reducción del riesgo de duplicación

---

## Decisión 5

### Fecha
2026-03-10

### Decisión
Una reauditoría automática debe ser única por auditoría original y tipo de origen.

### Contexto
La reauditoría automática es un dato derivado del submit original. Si se duplica, rompe el flujo operativo y complica el seguimiento.

### Alternativas consideradas
- permitir múltiples reauditorías automáticas por run
- confiar solo en validación lógica
- reforzar la unicidad lógica y estructuralmente

### Decisión final
Mantener una sola reauditoría automática por `parent_audit_run_id + origin_type`, con validación lógica en la RPC y refuerzo estructural en DB cuando se implemente.

### Impacto esperado
- evita duplicidad operativa
- simplifica trazabilidad
- mejora la calidad del panel de reauditorías

---

## Decisión 6

### Fecha
2026-03-10

### Decisión
Una corrective action derivada del submit debe ser única por pregunta fallida del run.

### Contexto
Las corrective actions representan hallazgos accionables. Duplicarlas distorsiona trabajo pendiente y bloqueo de reauditoría.

### Alternativas consideradas
- permitir duplicados y filtrarlos en UI
- confiar solo en “no volver a insertar” desde código
- definir unicidad lógica y estructural

### Decisión final
Considerar como unidad natural una sola corrective action por `audit_run_id + question_id`.

### Impacto esperado
- menos ruido operativo
- mejor consistencia en blockers y seguimiento
- menor complejidad en paneles de equipo

---

## Decisión 7

### Fecha
2026-03-10

### Decisión
El score final de una auditoría debe calcularse exclusivamente en backend.

### Contexto
Hoy el score se calcula en cliente. Eso crea riesgo de divergencia entre UI y persistencia final, y deja una regla crítica fuera del server.

### Alternativas consideradas
- mantener score en cliente
- calcularlo en cliente y revalidarlo en servidor
- mover la fuente de verdad del score al backend

### Decisión final
La fuente de verdad del score final será backend/server-side.

### Impacto esperado
- consistencia entre resultado mostrado y resultado persistido

---

## Decisión 8

### Fecha
2026-03-16

### Decisión
Cerrar primero seguridad de rutas y lecturas cliente con una combinación de auth server-side en App Router + RLS versionada.

### Contexto
El repo dependía de `requireRoleOrRedirect` y de chequeos cliente para impedir acceso por URL a módulos sensibles. Además, muchas pantallas consultan Supabase directo desde `supabaseClient`, por lo que bloquear solo la UI no era suficiente.

### Alternativas consideradas
- mantener validaciones cliente y endurecer solo botones
- mover de golpe todas las consultas a APIs dedicadas
- introducir una capa compartida de permisos server-side y respaldarla con RLS para las tablas expuestas

### Decisión final
Adoptar:

- `lib/auth/server.ts` como capa común server-side para páginas y endpoints
- layouts server-side por módulo/segmento para bloquear acceso por URL
- sincronización mínima de sesión y hotel scope a cookies para que App Router pueda autorizar
- migración RLS versionada para tablas usadas por `areas`, `reports`, `admin`, `builder`, `users`, `team` y `members`

### Impacto esperado
- la URL deja de ser un bypass de seguridad
- frontend y backend comparten la misma matriz de roles base
- las consultas cliente restantes quedan limitadas por RLS tenant-scoped y por rol

---

## Decisión 8

### Fecha
2026-03-11

### Decisión
En el dashboard e historial de área, tratar la clasificación efectiva del estándar como `audit_questions.classification` con fallback a `audit_sections.name`.

### Contexto
El área dashboard necesitaba rankear FAIL por clasificación, pero el flujo real de builder/importación usa `CLASSIFICATION` para mapear secciones y no persiste ese valor en `audit_questions.classification` de forma confiable. Eso dejaba paneles agregados incompletos cuando la columna de pregunta venía nula.

### Alternativas consideradas
- seguir leyendo solo `audit_questions.classification`
- migrar inmediatamente todo el sistema para persistir clasificación explícita en preguntas
- usar una clasificación efectiva compatible con el modelo actual

### Decisión final

Usar una clasificación efectiva: tomar `audit_questions.classification` y, si está nula, hacer fallback a `audit_sections.name`.

### Impacto esperado
- evita paneles vacíos o incompletos
- alinea dashboard/reporting con el modelo efectivo actual del builder
- reduce dependencia de columnas opcionales inconsistentes

---

## Decisión 9

### Fecha
2026-03-11

### Decisión
Blindar el submit de auditoría contra carreras entre autosave y submit explícito.

### Contexto
El flujo de auditoría usa autosave cliente para persistir respuestas en `audit_answers`. Durante pruebas reales, el auditor podía marcar `FAIL` y enviar inmediatamente. En ese escenario, una acción de autosave ya iniciada podía salir de la cola antes de completar su `upsert`, mientras `submitRun()` asumía que `flushAll()` ya había dejado la DB sincronizada. El RPC `submit_audit_run` terminaba calculando score sobre valores viejos.

### Alternativas consideradas
- confiar solo en `flushAll()` y ajustar timings del autosave
- mover inmediatamente todo el submit a un flujo puramente server-side sin dependencia de estado local
- blindar el submit actual con espera de saves en vuelo y sincronización final explícita

### Decisión final
Mantener el flujo actual, pero con dos defensas explícitas:

- `flushAll()` debe esperar también acciones ya iniciadas
- antes de llamar al endpoint de submit, la UI debe hacer un `upsert` final de `answersByQ` para que `submit_audit_run` calcule score sobre el estado local más reciente

### Impacto esperado
- elimina el caso observado de score `100%` por lecturas viejas
- reduce el riesgo de discrepancia entre UI local y DB en el momento del submit
- mantiene el cambio pequeño mientras la arquitectura de submit sigue migrando a server-side
Para reporting de área, resolver clasificación con esta prioridad:

- `audit_questions.classification` si viene poblada
- `audit_sections.name` como fallback operativo

### Impacto esperado
- ranking de FAIL por clasificación consistente con el builder y la importación actuales
- filtros de historial coherentes al navegar desde el dashboard
- menor riesgo de paneles vacíos mientras no exista una migración formal del modelo
- menor superficie de errores de negocio
- base más sólida para reporting y reauditorías

---

## Decisión 8

### Fecha
2026-03-10

### Decisión
Mantener el cliente como capa de validación UX, pero no como autoridad de negocio.

### Contexto
La UI necesita feedback rápido para una buena experiencia, pero no debe ser la autoridad final de validación.

### Alternativas consideradas
- quitar todas las validaciones cliente
- seguir validando solo en cliente
- validar en cliente para UX y en backend para garantía real

### Decisión final
Conservar validaciones cliente como ayuda visual, duplicadas en backend como enforcement real.

### Impacto esperado
- buena UX
- integridad operativa real
- menor dependencia del cliente

---

## Nota de mantenimiento

Cada vez que se tome una decisión de arquitectura o dominio importante, registrar una nueva entrada aquí.

No sobrescribir decisiones anteriores.
Si una decisión cambia, añadir una nueva entrada que la reemplace explícitamente.

---

## Decisión 9

### Fecha
2026-03-11

### Decisión
Separar `/team` en rutas independientes por módulo en lugar de mantener un workspace único con tabs internos pesados.

### Contexto
El workspace de equipo concentraba en una sola página los flujos de progreso, formaciones, recuperación y manager area workspace. Aunque parte de la carga ya se había diferido por tab, el entrypoint seguía acumulando estado, imports y coordinación de módulos distintos, con peor sensación de respuesta que `/analytics`.

### Alternativas consideradas
- mantener un único `page.tsx` con tabs internos
- profundizar más el lazy-load dentro de la misma página
- dividir por rutas reales y reutilizar un shell común de navegación

### Decisión final
Crear páginas separadas para:
- `/team/progreso`
- `/team/formaciones`
- `/team/recuperacion`
- `/team/general`
- `/team/historial`

Y dejar `/team` como redirect compatible según rol/tab legacy.

### Impacto esperado
- menor bundle inicial por módulo
- menos estado compartido en un único entrypoint
- navegación más rápida y predecible entre módulos pesados
- estructura más parecida a `/analytics`, que ya reacciona mejor

---

## Decisión 10

### Fecha
2026-03-12

### Decisión
Completar la migración de `/team` a navegación basada en rutas reales y mantener `/team` solo como entrypoint de compatibilidad.

### Contexto
La primera fase del split separó los módulos pesados de Team en páginas reales, pero aún quedaban puntos internos que generaban navegación legacy con `?tab=...`. Eso mantenía ambigüedad en enlaces internos y en accesos desde header/acciones operativas.

### Alternativas consideradas
- seguir permitiendo que la navegación interna use `?tab=...`
- eliminar completamente `/team` como entrypoint legacy
- usar rutas reales para la navegación nueva y conservar `/team` solo como redirect compatible

### Decisión final
Completar la migración con estas reglas:

- navegación interna nueva ya no genera `/team?tab=...`
- `/team/page.tsx` se mantiene como compatibilidad para redirects legacy
- se añade `/team/templates` como ruta real para managers
- en flujos manager se preserva `area=...` vía query string de forma intencional

### Impacto esperado
- navegación interna más consistente
- menos dependencia de compatibilidad implícita por query string
- menor riesgo de enlaces viejos regenerados por componentes nuevos
- mejor separación de responsabilidades por ruta

### Verificación
- `npm run lint` pasó tras la migración
- solo quedaron warnings preexistentes no relacionados

---

## Decisión 11

### Fecha
2026-03-15

### Decisión
Implementar la primera fase de historial de cambios con una tabla `audit_logs`, escritura best-effort vía route handlers y visualización bajo demanda en modal.

### Contexto
Se necesitaba trazabilidad inicial para cambios críticos de operación sin ensuciar la UI con paneles permanentes ni depender de escritura directa desde cliente sobre una tabla sensible.

### Alternativas consideradas
- renderizar un historial fijo dentro de las pantallas Team/Admin
- escribir logs directamente desde cliente con RLS
- posponer el historial hasta tener un backend transaccional completo

### Decisión final
- crear `public.audit_logs` con payloads JSONB de antes/después
- escribir logs desde `/api/audit-logs` usando `supabaseAdmin`
- mantener logging best-effort para no bloquear los flujos principales
- abrir el historial solo desde botones `Historial` que montan un modal reusable

### Impacto esperado
- trazabilidad inicial para objetivos y asignaciones
- menor riesgo de romper flujos existentes por fallos de logging
- UI más limpia al mantener el historial fuera del layout principal

---

## Decisión 12

### Fecha
2026-03-16

### Decisión
Cerrar las brechas pendientes de permisos manteniendo la seguridad real en API + RLS y dejando al cliente solo como capa UX.

### Contexto
La primera reparación ya había movido el acceso por URL a layouts server-side y había versionado RLS, pero seguían abiertos vectores concretos: creación/promoción a `superadmin`, lectura excesiva de `profiles`, mutación global de templates, mutación directa de `team_members` por managers y lectura hotel-wide de `audit_logs`.

### Decisión final
- definir una matriz única de roles asignables por actor en `lib/auth/permissions.tsx`
- mover la edición sensible de usuarios a `/api/admin/users/[id]`
- endurecer RLS de `profiles`, `audit_templates`, `audit_sections`, `audit_questions`, `team_members` y `team_member_areas`
- introducir `/api/profiles/names` para resolver nombres operativos sin reabrir lectura completa de `profiles`
- reutilizar `lib/auth/server.ts` desde `members` y `audit-logs` para hotel scope y area scope

### Impacto esperado
- un `admin` ya no puede crear ni promover `superadmin`
- un `auditor` ya no puede enumerar `profiles` same-hotel
- un `admin` tenant-scoped ya no puede mutar templates globales
- un `manager` ya no puede mutar miembros fuera de sus áreas ni leer logs hotel-wide omitiendo `area_id`

---

## Decisión 13

### Fecha
2026-03-16

### Decisión
Endurecer superficies secundarias con el mismo patrón que los módulos prioritarios: guard server-side en árbol, endpoints centrales por dominio y RLS explícita para assets globales/standards/tasks.

### Contexto
Tras cerrar `REPAIR 1.1`, seguían repitiéndose patrones equivalentes fuera de los módulos priorizados: árbol `superadmin` protegido solo en cliente, `standards` con mutaciones cliente directas, `trainings` con QR público demasiado abierto, rutas secundarias sin auth server-side y endpoints legacy aún vivos.

### Decisión final
- mover el registro público de trainings a un flujo de token firmado + consumible una sola vez respaldado por `training_registration_tokens`
- centralizar hotel scope y area scope de trainings en `lib/trainings/server.ts`
- cerrar `/superadmin`, `/standards`, `/audits`, `/analytics`, `/task`, `/my` y `/formaciones` con layouts server-side
- encapsular mutaciones sensibles de `standards` en `/api/standards/actions`
- delegar `user-management/*` a la capa admin nueva
- versionar RLS para `global_audit_*`, `standard_*`, `tasks` y `task_assignments`

### Impacto esperado
- los módulos secundarios ya no dependen de `requireRoleOrRedirect` como barrera principal
- `trainings` deja de aceptar registros arbitrarios y managers quedan limitados a sus áreas
- `standards` y `superadmin` quedan cerrados por URL antes de renderizar
- la superficie legacy se reduce a una sola fuente viva
