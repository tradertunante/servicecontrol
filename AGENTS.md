# ServiceControl - AGENTS.md

## Descripción del proyecto

ServiceControl es un SaaS de auditorías operativas para hoteles.

Su propósito es permitir que equipos hoteleros definan estándares operativos, ejecuten auditorías por área, registren evidencia, generen acciones correctivas y gestionen reauditorías automáticas o manuales según reglas del hotel.

El dominio principal del sistema es:

- hoteles
- áreas
- plantillas de auditoría
- secciones y preguntas
- auditorías ejecutadas (`audit_runs`)
- respuestas (`audit_answers`)
- acciones correctivas (`audit_corrective_actions`)
- reauditorías
- training logs y assignment logs de reauditoría

Stack principal:

- Next.js App Router
- TypeScript
- Supabase
  - Auth
  - Postgres
  - RLS
  - Storage

---

## Arquitectura general

### Frontend

La app está construida sobre `Next.js App Router`.

Organización principal:

- `app/(app)`:
  shell autenticado principal
- `app/(app)/audits/*`:
  flujo operativo de auditorías
- `app/(app)/areas/*`:
  navegación por áreas e historial
- `app/(app)/team/*`:
  seguimiento operativo, corrective actions y reauditorías
- `app/(app)/admin/*`:
  administración por hotel
- `app/(app)/builder/*`:
  edición de plantillas y preguntas
- `app/superadmin/*`:
  gestión global
- `lib/*`:
  auth helpers, Supabase clients, report builders, utilidades

### Backend

No hay backend tradicional separado.

Los límites backend actuales son:

- Supabase como backend operativo principal
- route handlers de Next.js para operaciones privilegiadas
- Edge Functions de Supabase en algunos casos
- RLS como capa clave de seguridad

### Integración con Supabase

Hay tres formas de acceso:

1. `lib/supabaseClient.ts`
   Cliente browser-side con anon key y sesión persistida.

2. `lib/supabaseServer.ts`
   Cliente server-side con token del usuario para respetar RLS.

3. `lib/supabaseAdmin.ts`
   Cliente server-side con service role para operaciones privilegiadas.

### Modelo de dominio inferido

Tablas principales detectadas en el repo:

- `profiles`
- `hotels`
- `areas`
- `audit_templates`
- `audit_sections`
- `audit_questions`
- `audit_runs`
- `audit_answers`
- `team_members`
- `team_member_areas`
- `area_template_targets`
- `area_template_target_assignments`
- `user_area_access`
- `hotel_audit_rules`
- `audit_corrective_actions`
- `reaudit_training_logs`
- `reaudit_assignment_logs`

---

## Reglas de arquitectura

### 1. El dominio crítico no debe vivir en cliente

Toda lógica crítica de negocio debe tender a moverse fuera de páginas cliente.

Esto aplica especialmente a:

- submit de auditoría
- cálculo final de score
- creación de corrective actions
- creación de reauditorías
- validación final de evidencia obligatoria
- cambios de estado críticos de `audit_runs`

### 2. La seguridad real no depende del cliente

Los checks en frontend son UX, no seguridad.

La seguridad real debe residir en:

- RLS
- route handlers server-side
- RPC / SQL transaccional
- validaciones server-side

### 3. Multi-hotel es una regla dura

Nunca mezclar datos entre hoteles.

Cualquier operación sensible debe respetar `hotel_id`.

El contexto de hotel actual existe hoy parcialmente en:

- `profiles.hotel_id`
- `localStorage["sc_hotel_id"]`

Los agentes no deben ampliar esta ambigüedad. Si tocan contexto multi-hotel, deben explicitar claramente la fuente de verdad.

### 4. El histórico de auditorías debe ser consistente

Nunca introducir cambios que permitan:

- doble submit del mismo run
- corrective actions duplicadas
- reauditorías automáticas duplicadas
- divergencia entre score mostrado y score persistido

### 5. Las operaciones multi-tabla deben ser atómicas

Si una operación toca varias tablas del flujo operativo, la solución preferida es:

- RPC / SQL transaccional
- o server-side con atomicidad real

No implementar flujos críticos como una serie de queries cliente sin protección.

---

## Reglas de coding

### Generales

- Mantener cambios mínimos y dirigidos.
- No refactorizar áreas no relacionadas sin necesidad clara.
- Preferir TypeScript estricto y tipos explícitos.
- No duplicar lógica si ya existe una utilidad o helper reutilizable.
- Mantener el estilo actual del repo salvo que haya una decisión explícita de mejora estructural.

### Organización recomendada

- Hooks en `_hooks/*`
- tipos en `types.ts` o `_lib/*Types.ts`
- utilidades y transforms en `_lib/*`
- componentes UI en `_components/*`

### Queries y acceso a datos

- Evitar dispersar SQL/lógica de acceso en demasiados componentes.
- Si una query empieza a repetirse o concentra reglas de negocio, moverla a una capa de dominio o helper dedicado.
- Para operaciones críticas, preferir server-side sobre cliente.

### Tipos

- No inventar tipos inconsistentes para las mismas tablas.
- Si una tabla ya aparece en varios módulos, buscar consolidación o al menos compatibilidad semántica.
- Cuando se implementen tipos generados desde Supabase, usarlos como source of truth.

### Estados y enums

- No introducir nuevos strings de estado de forma informal.
- Si se toca `audit_runs.status`, documentar explícitamente:
  - estados válidos
  - transiciones válidas
  - quién puede ejecutar cada transición

---

## Reglas para agentes de IA que modifiquen el repo

### 1. Antes de cambiar código, analizar el flujo completo

Si el cambio toca lógica operativa, el agente debe revisar primero:

- dónde se carga el dato
- dónde se transforma
- dónde se persiste
- qué pantallas dependen de ese comportamiento

### 2. No asumir que el cliente es la fuente de verdad

Si una regla vive hoy en cliente, eso no significa que deba quedarse ahí.

Los agentes deben evaluar si la regla pertenece realmente a:

- frontend
- route handler
- SQL/RPC
- política RLS

### 3. Proteger integridad antes que conveniencia

En este repo, es preferible una implementación menos “rápida” pero más segura si toca:

- auditorías
- corrective actions
- reauditorías
- permisos
- multi-hotel

### 4. No duplicar una segunda arquitectura

No introducir una nueva capa completa si basta con un ajuste incremental.

Ejemplos:
- no crear un “backend paralelo” si una RPC resuelve el caso crítico
- no reescribir todos los hooks si solo hace falta blindar una operación crítica

### 5. Documentar decisiones importantes

Si un cambio modifica comportamiento de arquitectura o dominio, el agente debe actualizar:

- `PLANS.md`
- `docs/ai/known-issues.md` si resolvió un bug
- `docs/ai/decisions-log.md` si tomó una decisión relevante

---

## Cómo deben proponer cambios

Los cambios deben proponerse en este orden:

### 1. Análisis

Explicar:

- qué hace hoy el sistema
- dónde está el problema
- por qué es un problema
- qué módulos están implicados

### 2. Plan

Proponer:

- pasos pequeños
- riesgos por paso
- verificación por paso
- impacto esperado

### 3. Implementación

Solo después del análisis y plan.

La implementación debe:

- minimizar superficie de cambio
- mantener compatibilidad razonable
- incluir verificación técnica real

### 4. Cierre

Después de implementar, el agente debe dejar claro:

- qué cambió
- qué no cambió
- qué riesgos quedan
- cómo se verificó

---

## Advertencias sobre lógica crítica

### submitAudit

`submitAudit` es actualmente una de las zonas más sensibles del sistema.

Riesgos conocidos:

- lógica crítica ejecutada en cliente
- múltiples escrituras separadas
- riesgo de estados parciales
- riesgo de doble submit
- riesgo de divergencia entre UI y DB

Cualquier cambio aquí debe tratarse como cambio de arquitectura, no solo como ajuste de UI.

### Reauditorías

Las reauditorías dependen de:

- score final
- `hotel_audit_rules`
- fallas de training
- blockers no operativos
- estado derivado (`ready_for_reaudit`, `blocking_issue_count`, etc.)

No cambiar esta lógica sin revisar también:

- `app/(app)/audits/[id]/page.tsx`
- `app/(app)/team/_hooks/useReauditsData.ts`
- `app/(app)/team/_hooks/useReauditActions.ts`
- `app/(app)/team/_components/CorrectiveActionsPanel.tsx`

### Corrective actions

Las corrective actions se crean a partir de preguntas con metadatos específicos.

No deben duplicarse.

Cualquier cambio debe revisar:

- reglas de generación
- relación con `reaudit_run_id`
- estado de bloqueo de reauditoría
- recalculo de `ready_for_reaudit`

### Evidencia fotográfica

Hoy la evidencia usa Supabase Storage y `photo_path` público.

No asumir que esto es definitivo.

Si se toca evidencia:
- revisar seguridad
- revisar bucket policy
- evaluar si hace falta migrar a signed URLs

---

## Estado actual del trabajo de arquitectura

La prioridad vigente del repo es migrar `submitAudit` a un flujo server-side transaccional.

Dirección aprobada:

- route handler de Next.js como borde HTTP y authz
- RPC SQL transaccional como fuente de verdad del submit
- frontend reducido a consumidor del resultado

Cualquier agente que toque auditorías debe respetar esa dirección salvo nueva decisión documentada.
