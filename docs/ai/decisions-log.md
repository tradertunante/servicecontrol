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
