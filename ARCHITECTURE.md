 # ServiceControl Architecture

## 1. System Overview

ServiceControl es un SaaS de auditorías operativas para hoteles.

El sistema permite:

- definir áreas operativas por hotel
- construir plantillas de auditoría con secciones y preguntas
- asignar objetivos y auditorías por área y usuario
- ejecutar auditorías con evidencia y comentarios
- calcular score final por auditoría
- generar acciones correctivas para hallazgos no operativos
- crear reauditorías automáticas según reglas del hotel
- visualizar dashboards, analytics e informes por área, auditoría y equipo

La arquitectura actual es una aplicación `Next.js App Router` muy apoyada en Supabase como backend operativo. La mayor parte del producto vive en componentes cliente y hooks que consultan tablas de Supabase directamente. Las operaciones privilegiadas o administrativas usan route handlers server-side y, en algunos casos, una Edge Function de Supabase.

La prioridad arquitectónica vigente es terminar de endurecer y simplificar el flujo de auditoría: el submit principal ya corre por route handler + RPC transaccional, y el trabajo restante está más en cleanup, tipado y consistencia de superficies cliente.

---

## 2. Technology Stack

- `Next.js 13 App Router`
  - estructura basada en `app/`
  - layouts y route groups
  - pages mayormente client-side
- `React`
  - fuerte uso de client components (`"use client"`)
  - hooks por módulo de producto
- `TypeScript`
  - tipado manual por pantalla/hook
  - todavía sin una capa única de tipos generados desde Supabase
- `Supabase`
  - `Auth` para identidad y sesión
  - `Postgres` como backend operacional
  - `RLS` como mecanismo clave de seguridad
  - `Storage` para evidencia fotográfica de auditorías
- `Tailwind CSS`
  - presente en dependencias y estilos globales
  - mezclado con estilos inline y `style jsx`
- `Next.js route handlers`
  - para operaciones privilegiadas de administración
- `Supabase Edge Functions`
  - presente al menos en `supabase/functions/create-user/index.ts`
- `Vercel deployment target`
  - el repo nace desde plantilla típica de Next.js/Vercel y está estructurado para despliegue web estándar de Next.js

---

## 3. Project Structure

## `app/`

Contiene la aplicación principal construida con App Router.

Subáreas principales:

- `app/layout.tsx`
  - layout raíz global
- `app/(app)/`
  - shell autenticado principal del producto
- `app/(app)/audits/`
  - creación, ejecución y visualización de auditorías
- `app/(app)/areas/`
  - navegación por áreas, dashboard de área e historial
- `app/(app)/team/`
  - seguimiento operativo del equipo, objetivos, corrective actions y reauditorías
- `app/(app)/admin/`
  - módulos administrativos por hotel
- `app/(app)/builder/`
  - editor de plantillas, secciones y preguntas
- `app/(app)/reports/`
  - páginas de reportes por auditoría o por área
- `app/(app)/analytics/`
  - métricas y tendencias analíticas
- `app/superadmin/`
  - vistas globales cross-hotel
- `app/api/`
  - route handlers server-side para tareas privilegiadas
- `app/components/`
  - componentes compartidos de UI como header, charts y utilidades visuales

## `lib/`

Contiene utilidades de infraestructura y dominio reutilizable.

Responsabilidades detectadas:

- clientes de Supabase
- helpers de auth y permisos
- builders de reportes
- utilidades auxiliares de auditoría
- tipos compartidos básicos

Archivos clave:

- `lib/supabaseClient.ts`
- `lib/supabaseServer.ts`
- `lib/supabaseAdmin.ts`
- `lib/auth/RequireRole.ts`
- `lib/auth/permissions.tsx`
- `lib/reports/*`

## `components/`

En este repo los componentes compartidos viven bajo `app/components/`, no en una carpeta raíz `components/`.

Su rol es:

- navegación común
- gráficos reutilizables
- selectores y shells visuales

## `supabase/`

Contiene assets o funciones específicas de Supabase.

Hoy se detecta:

- `supabase/functions/create-user/index.ts`

No se detectan migraciones SQL versionadas en el repo actual.

## `docs/`

Documentación operativa para agentes y evolución arquitectónica.

Hoy contiene:

- `docs/ai/known-issues.md`
- `docs/ai/decisions-log.md`

Además, en raíz existen documentos operativos:

- `AGENTS.md`
- `PLANS.md`
- `SERVICECONTROL_RULES.md`

---

## 4. Frontend Architecture

## Uso de Next.js App Router

La app usa App Router con layout raíz y un route group autenticado:

- `app/layout.tsx`
- `app/(app)/layout.tsx`

El route group `(app)` monta el shell principal con `HotelHeader`, que funciona como navegación común y como punto visible del contexto de hotel.

## Páginas vs componentes

Patrón predominante:

- las `page.tsx` actúan como contenedores de lógica y composición
- los componentes en `_components/` son piezas de UI o paneles especializados
- los hooks en `_hooks/` concentran carga de datos, estado derivado y transforms locales

Ejemplos:

- `app/(app)/dashboard/page.tsx`
  - compone el dashboard usando `useDashboardData`
- `app/(app)/areas/[areaId]/page.tsx`
  - depende de `useAreaData`
- `app/(app)/team/page.tsx`
  - compone módulos de objetivos, corrective actions y reauditorías
- `app/(app)/audits/[id]/page.tsx`
  - combina carga de run, preguntas, respuestas y submit

## Estructura de hooks

Cada módulo importante tiende a tener:

- `_hooks/` para fetch y estado de negocio
- `_components/` para UI
- `_lib/` para tipos y utilidades específicas del módulo

Ejemplos claros:

- `dashboard/_hooks/useDashboardData.ts`
- `team/_hooks/useTeamData.ts`
- `team/_hooks/useReauditsData.ts`
- `analytics/_hooks/useAnalyticsData.ts`
- `areas/[areaId]/_hooks/useAreaData.ts`

## Patrones de data fetching

Patrón dominante actual:

- client components
- `useEffect`
- consultas directas a Supabase desde el navegador
- joins parciales resueltos en frontend
- aggregations hechas en hooks locales

Esto implica que mucha lógica de acceso a datos está distribuida en:

- páginas
- hooks de módulo
- helpers de reportes

No existe todavía una capa de dominio centralizada para queries.

## Composición de UI

La UI está compuesta de forma modular pero heterogénea:

- algunos módulos usan componentes reutilizables y hooks limpios
- otros concentran mucha lógica directamente en la página
- se mezcla Tailwind con estilos inline y `style jsx`

El ejemplo más sensible es `app/(app)/audits/[id]/page.tsx`, que hoy mezcla:

- rendering
- validaciones
- persistencia incremental
- cálculo de score
- side effects derivados del submit

---

## 5. Backend / Data Layer

## Supabase integration

La integración con Supabase tiene tres capas principales:

### `lib/supabaseClient.ts`

Cliente browser-side basado en:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Configura:

- `persistSession`
- `autoRefreshToken`
- `detectSessionInUrl`
- `localStorage` como storage de sesión

Es la vía principal usada por casi toda la app.

### `lib/supabaseServer.ts`

Expone `supabaseWithToken(token)` para crear un cliente server-side con el bearer token del usuario.

Su objetivo es:

- validar identidad del caller
- respetar RLS
- permitir que route handlers lean datos como el usuario autenticado

### `lib/supabaseAdmin.ts`

Expone un cliente con `SUPABASE_SERVICE_ROLE_KEY`.

Se usa para:

- operaciones privilegiadas
- creación de usuarios
- administración que no debe depender de RLS del usuario final

## Authentication flow

El flujo real detectado es:

1. el usuario inicia sesión con Supabase Auth
2. el frontend consulta `supabase.auth.getUser()`
3. se carga el `profile` en la tabla `profiles`
4. se determina rol y hotel
5. la app redirige según rol desde `app/(app)/home/page.tsx`

Roles observados en código:

- `superadmin`
- `admin`
- `manager`
- `auditor`
- `quality`
- `engineering`
- `systems`

Aunque la petición de negocio principal suele hablar de `admin`, `manager`, `auditor` y `quality`, el sistema también contempla roles técnicos/no operativos para corrective actions.

## RLS interaction

La seguridad del sistema depende fuertemente de RLS, porque la mayoría de lecturas y escrituras ocurren desde cliente.

Implicaciones:

- el frontend no debe considerarse autoridad real
- las tablas sensibles deben tener políticas RLS correctas
- las operaciones multi-tabla críticas no deberían seguir dispersas en cliente

## Backend boundaries actuales

Los límites backend reales hoy son:

- Supabase DB + RLS
- route handlers de Next.js en `app/api/*`
- Edge Function `supabase/functions/create-user/index.ts`

Ejemplos de backend server-side actual:

- `app/api/admin/create-user/route.ts`
- `app/api/admin/user-area-access/set/route.ts`

---

## 6. Domain Model

Este modelo se infiere del código actual y de las consultas observadas.

## `profiles`

Representa usuarios autenticados del sistema.

Campos conceptuales usados:

- `id`
- `full_name`
- `email`
- `role`
- `hotel_id`
- `active`

Relación conceptual:

- un `profile` pertenece a un hotel o es `superadmin`
- un `profile` puede ejecutar auditorías
- un `profile` puede administrar usuarios/accesos según rol

## `hotels`

Entidad raíz de segmentación multi-tenant.

Relación conceptual:

- un hotel tiene muchas áreas
- un hotel tiene muchas reglas, usuarios, runs, templates y corrective actions

## `areas`

Representa áreas operativas auditables del hotel.

Relaciones:

- pertenece a `hotel`
- puede tener muchos templates
- puede tener muchos runs
- puede tener miembros de equipo asociados

## `audit_templates`

Plantilla de auditoría.

Relaciones:

- puede pertenecer a un hotel
- puede estar ligada a un área
- tiene muchas secciones
- se usa para crear `audit_runs`

## `audit_sections`

Agrupa preguntas dentro de una plantilla.

Relaciones:

- pertenece a `audit_template`
- tiene muchas `audit_questions`

## `audit_questions`

Preguntas auditables.

Campos conceptuales relevantes:

- `text`
- `tag`
- `classification`
- `order`
- `weight`
- `comment_requirement`
- `photo_requirement`
- `signature_requirement`
- `corrective_flow`
- `responsible_department`
- `blocks_reaudit_until_resolved`

Relaciones:

- pertenece a `audit_section`
- participa en `audit_answers`
- define si un FAIL genera corrective action y/o bloquea reauditoría

## `audit_runs`

Instancia ejecutada de una auditoría.

Campos conceptuales relevantes detectados:

- `hotel_id`
- `area_id`
- `audit_template_id`
- `status`
- `score`
- `notes`
- `executed_at`
- `executed_by`
- `team_member_id`
- `assigned_auditor_id`
- `is_reaudit`
- `parent_audit_run_id`
- `origin_type`
- `scheduled_for`
- `requires_training`
- `training_confirmed`
- `ready_for_reaudit`
- `blocking_issue_count`
- `audit_channel`

Relaciones:

- pertenece a hotel, área y template
- tiene muchas respuestas
- puede tener muchas corrective actions derivadas
- puede ser hijo de otro run si es reauditoría

## `audit_answers`

Respuestas por pregunta dentro de un run.

Campos conceptuales:

- `audit_run_id`
- `question_id`
- `answer`
- `result`
- `comment`
- `photo_path`

Relaciones:

- pertenece a `audit_run`
- referencia una `audit_question`

## `audit_corrective_actions`

Acciones correctivas derivadas de preguntas fallidas no operativas o mixtas.

Campos conceptuales:

- `hotel_id`
- `area_id`
- `audit_run_id`
- `reaudit_run_id`
- `question_id`
- `team_member_id`
- `assigned_department`
- `status`
- `title`
- `description`
- `evidence_note`
- `evidence_photo_path`
- `blocks_reaudit`
- `opened_at`
- `resolved_at`
- `resolved_by`

Relaciones:

- derivan de un `audit_run`
- pueden estar ligadas a una `reaudit_run_id`
- afectan el estado de reauditoría

## Reaudits

No parece existir una tabla separada de reauditorías.

Las reauditorías son `audit_runs` con:

- `is_reaudit = true`
- `parent_audit_run_id`
- `origin_type`
- estado derivado por blockers y training

## `hotel_audit_rules`

Reglas de negocio por hotel para reauditorías automáticas.

Campos usados:

- `auto_reaudit_enabled`
- `auto_reaudit_threshold`
- `auto_reaudit_delay_days`
- `require_training_before_reaudit`

## `team_members`

Colaboradores auditados u observados por área.

## `team_member_areas`

Vincula miembros del equipo con áreas.

Se usa al seleccionar el colaborador auditado en un `audit_run`.

## `area_template_targets`

Configura objetivos o disponibilidad de templates por área/hotel.

## `area_template_target_assignments`

Distribuye objetivos/asignaciones por usuario y template.

Se usa para resolver qué auditoría puede iniciar un usuario.

## `user_area_access`

Define qué áreas puede ver/operar un usuario en un hotel.

Es importante para:

- permisos operativos
- selección de hotel/área
- opciones de auditor reasignable en reauditorías

## `reaudit_training_logs`

Registro de confirmación de training previo a reauditoría.

## `reaudit_assignment_logs`

Registro de reasignación de auditor para una reauditoría.

---

## 7. Audit Flow

El flujo real de auditoría, según el código actual, es el siguiente.

## 1. Definición de template

Las plantillas se gestionan en:

- `app/(app)/builder/*`
- `app/superadmin/templates/*`

Un template tiene:

- secciones
- preguntas
- metadatos de validación
- metadatos para corrective actions y reauditorías

## 2. Resolución de auditoría a iniciar

En `app/(app)/audits/new/page.tsx`, el sistema:

1. obtiene usuario autenticado
2. carga `profiles`
3. resuelve hotel actual
4. busca asignaciones en `area_template_target_assignments`
5. si no encuentra, hace fallback a `area_template_targets`
6. carga template y área
7. inserta un `audit_runs` con `status = draft`

## 3. Ejecución del run

En `app/(app)/audits/[id]/page.tsx`, el sistema:

1. carga el `audit_run`
2. carga template y área
3. carga miembros de equipo del área
4. carga secciones activas
5. carga preguntas activas
6. carga `audit_answers` existentes
7. hace seed de respuestas faltantes con `PASS`

Durante la ejecución, el usuario puede:

- asignar colaborador auditado (`team_member_id`)
- responder `PASS` / `FAIL` / `NA`
- agregar comentario
- subir foto a Supabase Storage

## 4. Validación previa a submit

Antes de enviar, la página actual valida:

- comentarios obligatorios
- fotos obligatorias
- completitud lógica del set de respuestas

## 5. Cálculo de score

La lógica actual en cliente calcula:

- `total`
- `fail`
- `na`
- `denom = total - na`
- `pass = denom - fail`
- `score = pass / denom * 100`

Redondeado a 2 decimales.

## 6. Corrective actions

Durante submit, para cada pregunta fallida:

- si `corrective_flow` es `non_operational` o `mixed`
- y `responsible_department` es `engineering` o `systems`

se genera una `audit_corrective_action`.

Además:

- `blocks_reaudit` depende de `blocks_reaudit_until_resolved`

## 7. Reauditoría automática

Durante submit, si existen `hotel_audit_rules` y se cumple:

- `auto_reaudit_enabled = true`
- `score < auto_reaudit_threshold`
- el run no es ya reauditoría

entonces se crea un nuevo `audit_run` con:

- `is_reaudit = true`
- `parent_audit_run_id = originalRun.id`
- `origin_type = auto_below_threshold`
- `scheduled_for`
- `requires_training`
- `ready_for_reaudit`
- `blocking_issue_count`
- estado derivado:
  - `blocked_by_non_operational`
  - `pending_training`
  - o `draft`

## 8. Cierre del run original

Finalmente, el run original se actualiza a:

- `status = submitted`
- `score = ...`

y el usuario es redirigido a la vista de resultado.

## Observación crítica

Hoy esta lógica está mayormente implementada en cliente.

Ese es el principal punto arquitectónico en revisión.

---

## 8. Reaudit System

El sistema de reauditorías vive principalmente en:

- `app/(app)/audits/[id]/page.tsx`
- `app/(app)/team/_hooks/useReauditsData.ts`
- `app/(app)/team/_hooks/useReauditActions.ts`
- `app/(app)/team/_components/ReauditsPanel.tsx`
- `app/(app)/team/_components/CorrectiveActionsPanel.tsx`

## Cómo funciona

1. una auditoría original puede crear una reauditoría automática
2. la reauditoría es un nuevo `audit_run`
3. su estado depende de:
   - blockers no operativos
   - necesidad de training
   - training confirmado o no
4. el panel de equipo carga runs con `is_reaudit = true`
5. el equipo puede:
   - confirmar training
   - reasignar auditor
   - seguir timeline de cambios

## Datos complementarios

El sistema enriquece cada reauditoría con:

- nombre de área
- nombre de template
- colaborador
- auditor asignado
- último training log
- último assignment log
- timeline consolidado

## Estados derivados

Los estados observados incluyen:

- `draft`
- `pending_training`
- `blocked_by_non_operational`
- `submitted`

La transición de una reauditoría a `ready_for_reaudit` depende de:

- `blocking_issue_count === 0`
- y de `training_confirmed` si `requires_training = true`

---

## 9. Corrective Actions

Las corrective actions son un subdominio clave del sistema.

## Origen

Se crean a partir de fallos en preguntas cuya metadata indica flujo no operativo o mixto.

La información base sale de:

- `audit_questions.corrective_flow`
- `audit_questions.responsible_department`
- `audit_questions.blocks_reaudit_until_resolved`
- `audit_answers.comment`
- `audit_answers.photo_path`

## Destino

Se insertan en `audit_corrective_actions` con:

- departamento responsable (`engineering` o `systems`)
- evidencia
- texto de pregunta como título
- flag `blocks_reaudit`

## Gestión

El panel principal de seguimiento es:

- `app/(app)/team/_components/CorrectiveActionsPanel.tsx`

Este panel:

- lista acciones
- filtra por departamento y estado
- permite actualizar estado
- recalcula el estado de reauditoría enlazada

## Efecto sobre reauditorías

Si una corrective action bloqueante sigue abierta:

- la reauditoría asociada no puede quedar lista
- el estado puede pasar a `blocked_by_non_operational`

Cuando se resuelven blockers:

- se recalcula `blocking_issue_count`
- se recalcula `ready_for_reaudit`
- el run puede volver a `draft` si además no falta training

---

## 10. Multi-Hotel Architecture

ServiceControl es multi-hotel, pero el contexto de hotel actual tiene una implementación mixta.

## Fuente 1: `profiles.hotel_id`

Para usuarios normales, el hotel principal se obtiene desde `profiles.hotel_id`.

Esto se usa como referencia por defecto en:

- dashboard
- áreas
- permisos
- administración

## Fuente 2: `localStorage["sc_hotel_id"]`

Para `superadmin`, el hotel activo suele resolverse vía:

- `localStorage["sc_hotel_id"]`

También se usa como fallback en varios flujos del frontend.

## Consecuencia

El contexto de hotel no está totalmente centralizado.

Esto impacta:

- navegación
- dashboards
- inicio de auditorías
- módulos de administración

## Access control

El control de acceso por hotel/área usa varias capas:

- `profiles.role`
- `profiles.hotel_id`
- `user_area_access`
- filtros por `hotel_id` en queries
- RLS en Supabase

Los módulos administrativos y operativos deben respetar siempre `hotel_id`.

---

## 11. Security Model

## Supabase Auth

La autenticación depende de Supabase Auth.

El frontend usa:

- `supabase.auth.getUser()`
- `supabase.auth.getSession()`

El perfil del usuario se resuelve en la tabla `profiles`.

## Autorización por rol

La autorización de UI usa helpers como:

- `lib/auth/RequireRole.ts`
- `lib/auth/permissions.tsx`

Esto controla:

- redirecciones
- acceso a pantallas
- capacidades visibles

Pero no debe considerarse seguridad suficiente por sí sola.

## RLS

RLS es la capa clave de seguridad real porque la mayor parte de operaciones van directo desde cliente a Supabase.

Eso significa que cualquier suposición de seguridad debe validarse contra:

- políticas RLS
- filtros por hotel
- roles y pertenencia del usuario

## Responsabilidades cliente vs servidor

### Cliente

Responsabilidades actuales:

- UX
- rendering
- validaciones preventivas
- carga de datos operativos
- parte de lógica de negocio histórica

### Servidor

Responsabilidades actuales:

- operaciones administrativas privilegiadas
- validación de caller en routes críticas
- uso de service role para tareas de gestión

### Dirección deseada

Mover operaciones críticas multi-tabla al servidor o a SQL transaccional.

---

## 12. Known Architectural Risks

Los principales riesgos detectados en el código actual son:

1. `submitAudit` depende del cliente para reglas críticas.
2. No hay atomicidad real en el submit de auditorías.
3. Existe riesgo de reauditorías automáticas duplicadas.
4. Existe riesgo de corrective actions duplicadas.
5. El contexto multi-hotel está distribuido entre `profiles.hotel_id` y `sc_hotel_id`.
6. El acceso a datos está muy disperso en hooks y páginas.
7. Los tipos de dominio y tablas están duplicados.
8. El histórico de auditorías depende todavía del estado actual del template, porque no se detecta snapshot/versionado persistido del template al ejecutar un run.
9. La evidencia fotográfica usa URLs públicas, lo que podría ser insuficiente según el nivel de sensibilidad operativa esperado.

Estos riesgos están alineados con:

- `docs/ai/known-issues.md`
- `docs/ai/decisions-log.md`
- `PLANS.md`

---

## 13. Current Architecture Direction

La prioridad arquitectónica actual del repo es:

**migrar `submitAudit` a un flujo server-side transaccional**

La dirección aprobada es:

- `Next.js route handler`
  - como borde HTTP
  - autenticación/autorización del caller
  - normalización de errores

- `SQL RPC submit_audit_run`
  - como unidad transaccional real
  - cálculo de score en backend
  - validaciones finales de evidencia
  - creación/reuso de corrective actions
  - creación/reuso de reauditoría
  - update final de `audit_runs`
  - idempotencia
  - locking con `FOR UPDATE`

Principios asociados ya documentados:

- `submitAudit` debe tratarse como operación crítica de arquitectura
- la fuente de verdad del score debe pasar al backend
- el submit debe ser idempotente por `audit_run`
- debe evitarse la duplicación de side effects
- la validación del cliente debe quedar solo como UX, no como enforcement real

## Cómo deben usar este documento futuros agentes

Un agente nuevo no debería empezar re-analizando todo el repo desde cero.

Debe usar este archivo como mapa base para:

- entender la arquitectura real actual
- ubicar módulos por responsabilidad
- identificar las tablas clave
- entender el flujo de auditoría y reauditoría
- detectar rápidamente los riesgos arquitectónicos conocidos
- alinearse con la dirección técnica vigente antes de proponer cambios

Este documento no reemplaza la lectura del código cuando un cambio es profundo, pero sí evita empezar sin contexto.
