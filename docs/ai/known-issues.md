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
Pendiente.

Solución planificada:
migrar el submit a un flujo server-side transaccional usando:

- route handler de Next.js
- RPC SQL `submit_audit_run(...)`

### Cómo evitarlo en el futuro
- no implementar operaciones críticas multi-tabla en cliente
- usar una única unidad transaccional para cambios de estado operativos
- tratar el frontend solo como capa de UX y no de autoridad final

### Archivos relacionados
- `app/(app)/audits/[id]/page.tsx`
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
Pendiente.

Actualmente es comportamiento conocido del sistema.

### Cómo evitarlo en el futuro
- no ampliar esta mezcla sin una decisión explícita
- si se toca contexto de hotel, documentar la fuente de verdad por caso de uso
- tender a una resolución server-side o a una capa de contexto centralizada

### Archivos relacionados
- `app/(app)/home/page.tsx`
- `app/components/HotelHeader.tsx`
- `app/(app)/dashboard/_hooks/useDashboardData.ts`
- `app/(app)/admin/_components/AdminShell.tsx`

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
