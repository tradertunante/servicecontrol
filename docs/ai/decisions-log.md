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

## Decisión 8

### Fecha
2026-03-18

### Decisión
Modelar el departamento responsable a nivel de `audit_questions` como metadato del standard dentro del template.

### Contexto
Cada standard del template necesita declarar qué equipo operativo es responsable para poder reutilizar esa señal en dashboards y flujos posteriores, sin inferencias frágiles por nombre de área o por lógica duplicada en cliente.

### Alternativas consideradas
- calcular responsabilidad por mapeos externos de áreas
- guardar responsabilidad en otra tabla paralela
- persistir el metadato directamente en `audit_questions`

### Decisión final
Añadir `responsible_department` en `audit_questions` y editarlo inline desde el builder junto al resto de atributos del standard.

### Impacto esperado
- base consistente para dashboards por equipo
- menos lógica derivada o heurística en cliente
- compatibilidad con autosave y editor actual sin reescritura

---

## Decisión 9

### Fecha
2026-03-18

### Decisión
Resolver `responsible_department` desde las áreas reales configuradas por hotel, no desde una taxonomía fija global.

### Contexto
La operación trabaja a nivel de departamentos/áreas reales como `Housekeeping`, `Front Office`, `IRD`, `IT` o `Mantenimiento`. Una lista fija con macro-divisiones como `F&B` no representa bien ese nivel operativo y vuelve ambiguo el responsable real del standard.

### Alternativas consideradas
- mantener un enum fijo global
- mezclar enum fijo con etiquetas visibles del hotel
- usar como fuente de verdad las `areas` reales del hotel

### Decisión final
Construir el selector desde `areas` del hotel dueño del template, manteniendo solo normalizaciones puntuales para compatibilidad operativa (`IT` y `Mantenimiento`).

### Impacto esperado
- selector alineado con la operación real del hotel
- menos confusión visual en builder
- base más útil para dashboards y asignación operativa posterior

---

## Decisión 10

### Fecha
2026-03-19

### Decisión
Separar ownership operativo general y routing correctivo no operativo en campos distintos de `audit_questions`.

### Contexto
`responsible_department` ya estaba acoplado a la lógica correctiva no operativa mediante constraints y la RPC de submit. Reutilizarlo desde el builder como dueño general del standard rompía combinaciones válidas cuando la pregunta seguía en `training_only`.

### Alternativas consideradas
- relajar el constraint actual
- seguir reutilizando `responsible_department` y completar más campos desde frontend
- crear un campo separado para ownership operativo

### Decisión final
Mantener `responsible_department` para corrective logic no operativa y crear `owner_department` para ownership operativo general y dashboards.

### Impacto esperado
- se preserva la integridad de corrective actions y reauditorías
- el builder puede asignar dueño operativo sin violar constraints existentes
- el dashboard futuro tiene una fuente de verdad separada y coherente

---

## Decisión 11

### Fecha
2026-03-19

### Decisión
Separar las vistas `/it` y `/engineering` del modelo `audit_corrective_actions` y alimentarlas con backlog operativo derivado de FAILs submitidos por `owner_department`.

### Contexto
Los FAILs con `owner_department = it|engineering` no generan `audit_corrective_actions` cuando la pregunta sigue en `training_only`, porque `audit_corrective_actions` pertenece a la lógica correctiva no operativa basada en `corrective_flow` y `responsible_department`.

### Alternativas consideradas
- generar `audit_corrective_actions` nuevos para cualquier FAIL con `owner_department`
- seguir reutilizando las pantallas departamentales sobre corrective actions
- construir un backlog operativo separado a partir de `audit_runs`, `audit_answers` y `audit_questions.owner_department`

### Decisión final
Mantener `audit_corrective_actions` exclusivamente para corrective logic y reauditorías, y mover `/it` y `/engineering` a una fuente nueva de backlog operativo derivada directamente de FAILs submitidos.

### Impacto esperado
- consistencia semántica entre ownership operativo y lógica correctiva
- mejor trazabilidad de FAILs por departamento sin contaminar corrective actions
- base limpia para evolucionar después un workflow operativo propio para IT y Mantenimiento

---

## Decisión 12

### Fecha
2026-03-19

### Decisión
Hacer obligatorios `room_number` y `team_member_id` por configuración de template, no como regla global.

### Contexto
Algunos templates operativos, como Guest Room, pierden utilidad si la auditoría se envía sin habitación o sin colaborador auditado. Esa obligatoriedad depende del tipo de template y no debe imponerse al resto del producto.

### Alternativas consideradas
- hacer ambos campos obligatorios globalmente
- mantenerlos opcionales y resolverlo solo en reporting
- modelar flags de submit por `audit_template`

### Decisión final
Añadir `require_room_number` y `require_audited_employee` en `audit_templates`, exponerlos en builder y validarlos al enviar en la RPC `submit_audit_run`, con espejo UX mínimo en cliente.

### Impacto esperado
- los templates que lo necesiten exigirán cabecera completa al submit
- los templates existentes mantienen comportamiento actual por default `false`
- la regla queda modelada donde corresponde: en la configuración del template y en el submit server-side

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
2026-03-17

### Decisión
Mover analytics y reportes a una arquitectura server-first con módulos `server-only` como vía principal.

### Contexto
`analytics` construía KPIs desde hooks cliente cargando `audit_runs`, `audit_answers`, `audit_questions`, `audit_templates` y `team_members` para luego agregar en React. Los reportes semanal, mensual y por auditoría llamaban builders con `supabaseClient` desde componentes `use client`.

### Alternativas consideradas
- mantener la agregación en cliente y solo envolverla en más hooks
- crear rutas API para cada pantalla y seguir resolviendo parte del shape en frontend
- resolver el dataset agregado en server components y módulos `server-only`

### Decisión final
Adoptar una capa server-first compuesta por:

- `lib/analytics/server.ts` para boot, joins y agregaciones de analytics
- `lib/reports/*` endurecidos como módulos `server-only`
- páginas `app/(app)/reports/**/page.tsx` y `app/(app)/analytics/page.tsx` como borde server-side que entregan al cliente el shape final

### Impacto esperado
- elimina el fan-out principal en frontend para KPIs y reportes
- reduce dependencia de `supabaseClient` como fuente de verdad en reporting
- deja al cliente centrado en filtros, navegación y render

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

## Decisión 10

### Fecha
2026-03-17

### Decisión
Eliminar cualquier write cliente residual sobre `audit_answers` y metadatos editables de `audit_runs`.

### Contexto
Aunque `submit_audit_run` ya existía, el flujo seguía híbrido porque `useAuditSession` hacía:

- `upsert` directo a `audit_answers`
- `update` directo a `audit_runs` para `team_member_id` y `room_number`
- un sync final de answers desde browser antes del submit

Eso impedía considerar cerrado el core de auditorías con criterio binario real.

### Alternativas consideradas
- mantener autosave directo a Supabase con más checks en cliente
- mover solo el submit final y tolerar drafts híbridos
- sacar todos los writes críticos a routes server-side dedicadas

### Decisión final
Usar routes server-side específicas para:

- draft answers
- patch de metadata editable del run
- seed inicial de respuestas al crear la auditoría

El cliente queda limitado a estado local, lectura y llamadas HTTP autorizadas.

### Impacto esperado
- cierre real del flujo híbrido
- validaciones uniformes de hotel, área, ownership y estado
- eliminación de dependencia en un sync final del navegador antes del submit

---

## Decisión 11

### Fecha
2026-03-17

### Decisión
Resolver el hotel activo exclusivamente desde una abstracción server-side canónica y propagar ese resultado a las superficies cliente.

### Contexto
El repo venía conviviendo con dos caminos reales:

- non-superadmin usando `profiles.hotel_id`
- `superadmin` usando `sc_hotel_id` / cookie de hotel seleccionado

Además, varias páginas y hooks reconstruían ese scope en frontend de forma ad hoc.

### Alternativas consideradas
- mantener helpers separados por rol y tolerar reconciliación en cliente
- crear un contexto cliente global como autoridad
- centralizar la resolución en servidor y tratar al frontend solo como consumidor del resultado

### Decisión final
Usar `lib/auth/server.ts` como única capa canónica para resolver hotel activo y exigir que páginas/rutas relevantes entren por helpers server-side que ya devuelven `hotelId` scoped.

### Impacto esperado
- una sola fuente de verdad operativa para hotel activo
- mismo contrato para `superadmin` y usuarios normales
- menos filtros y permisos ad hoc en frontend
- menor riesgo de scope incorrecto por superficie

## Decisión 8

### Fecha
2026-03-16

### Decisión
Mover mutaciones globales sensibles de `superadmin` detrás de endpoints explícitos en `app/api/superadmin/**`.

### Contexto
Aunque las páginas `superadmin` ya estaban cerradas server-side, seguían existiendo escrituras directas desde cliente sobre recursos globales como templates, packs y hoteles.

Eso dejaba una frontera poco explícita para operaciones de alto impacto administrativo y concentraba validación visible en UI + RLS.

### Alternativas consideradas
- mantener mutaciones en cliente y depender de RLS
- mover solo una parte pequeña de las escrituras más usadas
- cerrar todas las mutaciones globales activas de `superadmin` detrás de route handlers dedicados

### Decisión final
Cerrar las mutaciones globales activas y sensibles del módulo en route handlers dedicados con validación de autenticación, rol `superadmin`, recurso objetivo y payload permitido.

### Impacto esperado
- menor dependencia del cliente como autoridad para datos globales
- permisos más claros y reutilizables en servidor
- base más segura para seguir endureciendo `superadmin` sin refactor masivo

---

## Decisión 9

### Fecha
2026-03-16

### Decisión
Eliminar residuos de auth client-side a nivel página cuando el segmento ya está blindado por layouts y helpers server-side.

### Contexto
Después de cerrar segmentos principales, todavía había páginas sueltas con `requireRoleOrRedirect(...)` o gating equivalente en cliente.

Eso duplicaba reglas, generaba inconsistencias y en al menos un caso (`audits/[id]/view`) restringía más que la política real del servidor.

### Alternativas consideradas
- mantener los checks cliente como “segunda capa”
- reemplazarlos por nuevos wrappers cliente
- eliminar los residuos y confiar solo en la frontera server-side ya existente

### Decisión final
Eliminar los checks de acceso en cliente a nivel página y dejar como autoridad única:

- layout server-side del segmento
- helpers `requireRole(...)`, `requireModuleAccess(...)` y `requireAuditRunScope(...)`

### Impacto esperado
- política de acceso coherente en toda la app
- cero renderizado dependiente de auth cliente en esas páginas
- menos riesgo de divergencia entre permisos reales y permisos aparentes

---

## Decisión 8

### Fecha
2026-03-16

### Decisión
Resolver autorización de páginas protegidas en App Router desde layouts/páginas server con un helper compuesto, en vez de depender de checks cliente por pantalla.

### Contexto
El repo ya contaba con `requireRole`, `requireModuleAccess`, `requireHotelScope` y `requireAreaScope`, pero todavía quedaban zonas donde:

- la ruta se protegía solo en cliente
- el rol se validaba en servidor sin exigir hotel activo
- la redirección principal del segmento se hacía en `useEffect`

Eso dejaba huecos de acceso directo por URL y hacía inconsistente el blindaje entre segmentos.

### Alternativas consideradas
- reescribir cada página cliente como server component con bootstrap completo
- mantener los checks cliente y confiar en RLS
- cerrar acceso en el borde App Router con un helper pequeño reutilizable

### Decisión final
Usar `requirePageAccess(...)` para combinar:

- rol o módulo autorizado
- `hotel scope` server-side cuando la zona depende de hotel activo
- `redirect()` antes de renderizar

Mantener los checks cliente existentes solo como capa de UX o compatibilidad incremental.

### Impacto esperado
- acceso directo por URL bloqueado antes del primer render en zonas protegidas
- menor dependencia de `requireRoleOrRedirect(...)` como pseudo-seguridad
- cambios mínimos y dirigidos, sin refactor masivo de pantallas cliente

---

## Decisión 9

### Fecha
2026-03-16

### Decisión
Separar explícitamente `auth cliente para UI` de `auth real server-side` en segmentos ya protegidos por App Router.

### Contexto
Después del blindaje server-side, seguían quedando páginas cliente con dos patrones mezclados:

- `requireRoleOrRedirect(...)` usado como reliquia del control viejo
- cargas de perfil necesarias para render, hotel activo o decisiones menores de interfaz

Mantener ambos como si fueran equivalentes dificulta entender dónde vive la seguridad real.

### Alternativas consideradas
- dejar los checks cliente por “defensa en profundidad”
- reescribir todas las páginas afectadas como server components
- mantener solo bootstrap cliente neutral donde haga falta y retirar el gating redundante

### Decisión final
En segmentos ya cerrados por layout server-side:

- quitar `requireRoleOrRedirect(...)`
- conservar únicamente `getClientProfile()` o estados cliente equivalentes cuando se necesitan para UI, hotel activo o carga de datos
- no volver a tratar el cliente como autoridad de acceso

### Impacto esperado
- código más coherente con la arquitectura de seguridad real
- menor confusión futura para agentes y desarrolladores
- reducción clara de deuda híbrida sin refactor masivo

---

## Decisión 10

### Fecha
2026-03-16

### Decisión
Endurecer primero los endpoints privilegiados donde el recurso objetivo no coincide necesariamente con el actor autenticado.

### Contexto
En la capa API, los mayores riesgos no estaban en los endpoints que ya resolvían `hotel scope`, sino en los que además operaban sobre:

- otro usuario
- accesos por área de otro usuario
- un `audit_run` referenciado por UUID desde cliente

Ahí el hotel activo por sí solo no basta; también hace falta validar el target y su contexto operativo real.

### Alternativas consideradas
- confiar en la RPC o en checks previos del frontend
- revisar todos los endpoints y reescribir toda la capa API
- cerrar primero los endpoints con mayor riesgo de escalación lateral o mutación sensible

### Decisión final
Aplicar endurecimiento incremental sobre:

- `admin/delete-user`
- `admin/user-area-access/get`
- `admin/user-area-access/set`
- `audits/submit`

usando helpers reutilizables para target user access y validación de `run` + `area scope`.

### Impacto esperado
- menor riesgo de escalación lateral entre usuarios del mismo hotel
- menor riesgo de submit sobre runs fuera del alcance real del actor
- mejora material de seguridad sin refactor masivo de toda la capa API

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

---

## Decisión 14

### Fecha
2026-03-17

### Decisión
Terminar `REPAIR 1` quitando el gating cliente residual en rutas reales de `areas`, `reports`, `standards` e `history`.

### Contexto
Aunque los layouts server-side ya cerraban el acceso principal, varias rutas reales seguían:

- leyendo `profile` o `session` en cliente para decidir si continuar
- resolviendo `hotel_id` desde navegador para arrancar pantallas protegidas
- mezclando wrappers server-side con pages cliente que todavía actuaban como pseudo-barrera

Eso mantenía un modelo híbrido y hacía ambiguo dónde vivía la autoridad real.

### Decisión final
- convertir las pages reales pendientes en wrappers server-side que inyectan `profile`, `hotelId`, `areaId` o `runId`
- dejar los `*PageClient` y hooks solo con UI, lectura de datos permitidos y `fetch` autenticado para mutaciones
- eliminar guards por rol/sesión en navegador en `standards`, `areas`, `reports` y `history`

### Impacto esperado
- autoridad de acceso concentrada en `layout.tsx`, `page.tsx` server-side y helpers `require*`
- menos ambigüedad entre UX cliente y seguridad real
- cierre binario real de `REPAIR 1`

---

## Decisión 15

### Fecha
2026-03-17

### Decisión
Reducir hotspots cliente de mantenimiento usando superficies compartidas por dominio en lugar de seguir clonando lógica y render.

### Contexto
Tras cerrar los repairs funcionales, quedaban deudas estructurales claras:

- `WeeklyAreaReportPageClient.tsx` y `MonthlyAreaReportPageClient.tsx` repetían casi la misma vista imprimible
- `AreaHistoryPageClient.tsx` y `useAreaData.ts` mantenían fan-out y transforms muy parecidos para área, templates, runs y agregados por sección
- `useAuditSession.ts` acumulaba tipos, carga, normalización, autosave y mutaciones en un solo archivo

Eso elevaba el coste de cambio y hacía más fácil reintroducir divergencias.

### Decisión final
- extraer una vista compartida `AreaPeriodReportPage` como superficie canónica para reportes weekly/monthly
- centralizar la carga base de área/historial en `loadAreaOverviewData(...)`
- partir `useAuditSession` en tipos, loader y helpers, dejando el hook principal enfocado en estado y eventos de UI

### Impacto esperado
- menos paralelismos vivos entre módulos equivalentes
- menor tamaño de hotspots reales y menos `any` en tramos críticos
- mantenimiento más predecible sin cambiar el contrato funcional ya cerrado en repairs 1-5

---

## Decisión 16

### Fecha
2026-03-17

### Decisión
La importación histórica de auditorías vive solo en una herramienta centralizada de `superadmin`, selecciona explícitamente hotel + template operativo y escribe sobre templates del hotel.

### Contexto
La herramienta primero se planteó colgada de un template global en `superadmin`, pero el flujo real de negocio requiere elegir explícitamente el hotel destino y el template operativo concreto sobre el que se crearán `audit_runs` y `audit_answers`.

Además, una importación histórica toca varias tablas (`audit_runs` y `audit_answers`) y no debía depender de inserts cliente ni de ocultamiento por UI.

### Alternativas consideradas
- colgar la herramienta dentro del detalle de cada template
- insertar `audit_runs` apuntando al template global
- mantener una UX de copiar/pegar con textarea

### Decisión final
- exponer una única herramienta en `/superadmin/historical-import`
- exigir selección explícita de hotel y template antes de permitir descargar o importar
- proteger página y endpoints con guards server-side exclusivos de `superadmin`
- generar plantilla Excel dinámica por template seleccionado
- persistir cada fila con una RPC transaccional dedicada

### Impacto esperado
- mantiene coherencia con el flujo operativo real del producto
- evita mezclar datos entre hoteles
- evita `audit_runs` referenciando assets globales no operativos
- permite importación parcial por filas sin sacrificar atomicidad por auditoría
