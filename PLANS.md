# ServiceControl - PLANS.md

## Plan vivo: migración de submitAudit a server-side transaccional

---

## Contexto del problema

Hoy el submit de auditoría está implementado principalmente en cliente, dentro de:

- `app/(app)/audits/[id]/page.tsx`

Actualmente el flujo hace varias operaciones separadas desde el frontend:

- valida evidencia obligatoria
- calcula score
- consulta `hotel_audit_rules`
- crea corrective actions
- crea reauditoría automática si aplica
- actualiza `audit_runs` a `submitted`

Esto tiene varios problemas:

- no hay atomicidad real
- existe riesgo de doble submit
- puede haber estados parciales si falla a mitad
- el cliente participa en decisiones críticas de negocio
- la idempotencia no está blindada
- se pueden duplicar reauditorías o corrective actions si hay retries o carreras

---

## Objetivo

Migrar `submitAudit` a una operación server-side transaccional y confiable.

Resultado esperado:

- el frontend ya no es la fuente de verdad del submit
- una sola unidad transaccional calcula y persiste el resultado
- no hay reauditorías duplicadas
- no hay corrective actions duplicadas
- el submit es idempotente
- la lógica crítica queda protegida por server-side + DB

Dirección técnica elegida:

- Next.js route handler como borde HTTP y authz
- RPC SQL transaccional `submit_audit_run(...)` como unidad de negocio

---

## Plan por fases

### Fase 1 - Blindaje del submit crítico

Objetivo:
mover `submitAudit` a una operación server-side transaccional y definir idempotencia, locking y no duplicación.

Incluye:

- diseño de contrato de la RPC
- diseño del route handler
- validaciones exactas
- estrategia de locking
- estrategia de idempotencia
- prevención de reaudits duplicadas
- prevención de corrective actions duplicadas

Estado:
en diseño detallado

### Fase 2 - Consolidación arquitectónica

Objetivo:
reducir lógica crítica dispersa y centralizar acceso a datos y reglas por dominio.

Incluye:

- extraer servicios/dominio de auditorías y reauditorías
- reducir duplicación de tipos
- consolidar permisos
- preparar tipado consistente desde Supabase

Estado:
pendiente

### Fase 3 - Escala, histórico y reporting robusto

Objetivo:
fortalecer trazabilidad histórica, reporting y operación multi-hotel a escala.

Incluye:

- versionado/snapshot de templates
- vistas agregadas o reporting optimizado
- trazabilidad administrativa
- endurecimiento de evidencias y observabilidad

Estado:
pendiente

---

## Estado actual

### Hecho

- análisis de arquitectura del repo
- análisis de integración con Supabase
- análisis del flujo de auditoría, corrective actions y reauditorías
- diagnóstico técnico del problema de `submitAudit`
- roadmap por fases
- diseño recomendado de migración server-side
- diseño técnico detallado de `submit_audit_run`
- plan de implementación por entregables pequeños
- corrección del ranking de FAIL por clasificación en dashboard de área usando clasificación efectiva por sección cuando `audit_questions.classification` no está poblado
- corrección de inconsistencia de score/hallazgos en detalle de auditoría causada por lectura mixta `answer/result` y carrera entre autosave y submit

### En curso

- documentación permanente para agentes de IA
- preparación del plan técnico de Fase 1

### No iniciado

- implementación de la RPC
- implementación del route handler
- integración de UI con backend transaccional
- constraints/índices de idempotencia y no duplicación

---

## Próximos pasos

### Paso 1 - cerrar contrato de submit

Entregable:

- firma exacta de `submit_audit_run`
- payload de entrada/salida
- códigos de error
- validaciones exactas
- permisos exactos
- decisión final de idempotencia

### Paso 2 - construir la operación transaccional en DB

Entregable:

- RPC SQL implementada
- locking correcto con `FOR UPDATE`
- cálculo final de score en SQL
- creación/reuso de corrective actions
- creación/reuso de reauditoría
- update final del run
- retorno JSON estable

### Paso 3 - exponer el submit server-side y conectar UI

Entregable:

- route handler `POST /api/audits/submit`
- mapeo de errores a HTTP
- reemplazo del submit cliente por llamada al endpoint
- validación UX en cliente como capa secundaria, no de seguridad

---

## Riesgos

### Riesgos funcionales

- romper el flujo actual de submit
- introducir diferencias entre cálculo viejo y cálculo nuevo
- dejar casos edge sin cobertura
- bloquear flujos reales de operación por una validación demasiado estricta

### Riesgos de datos

- reauditorías duplicadas
- corrective actions duplicadas
- run en estado `submitted` sin acciones esperadas
- run parcialmente procesado si la transacción no está bien diseñada

### Riesgos de seguridad

- dejar la RPC demasiado expuesta
- usar `security definer` sin restricciones suficientes
- permisos inconsistentes entre handler, SQL y RLS

### Riesgos operativos

- errores difíciles de depurar si toda la lógica crítica se mueve a SQL sin buen retorno estructurado
- falta de observabilidad en fallos del submit

---

## Checklist de verificación

### Diseño

- [ ] La RPC tiene firma cerrada y documentada
- [ ] El route handler tiene contrato HTTP claro
- [ ] Los roles permitidos para submit están definidos
- [ ] Las validaciones de evidencia están definidas
- [ ] La lógica de corrective actions está definida
- [ ] La lógica de reauditoría automática está definida

### Integridad

- [ ] El submit es idempotente
- [ ] Existe estrategia clara de locking
- [ ] No se pueden duplicar reauditorías automáticas
- [ ] No se pueden duplicar corrective actions
- [ ] El score final sale exclusivamente del backend

### Verificación funcional

- [ ] Caso feliz: submit válido
- [ ] Error por comentario faltante
- [ ] Error por foto faltante
- [ ] Score bajo threshold crea reauditoría
- [ ] Falla no operativa crea corrective actions
- [ ] Retry HTTP no duplica nada
- [ ] Doble click de usuario no duplica nada
- [ ] Re-run sobre auditoría ya enviada devuelve respuesta idempotente

### Integración UI

- [ ] El frontend consume el endpoint server-side
- [ ] La UI sigue redirigiendo correctamente a resultado
- [ ] Los paneles de equipo reflejan el estado final correcto
- [ ] Los reportes leen datos consistentes tras submit

---

## Módulos probablemente afectados

### Submit / auditoría

- `app/(app)/audits/[id]/page.tsx`
- `app/(app)/audits/new/page.tsx`

### Reauditorías / acciones correctivas

- `app/(app)/team/_hooks/useReauditsData.ts`
- `app/(app)/team/_hooks/useReauditActions.ts`
- `app/(app)/team/_components/CorrectiveActionsPanel.tsx`

### Supabase server-side

- `lib/supabaseServer.ts`
- `lib/supabaseAdmin.ts`

### Nuevos puntos probables

- `app/api/audits/submit/route.ts`
- migración SQL / RPC de `submit_audit_run`
- índices/constraints asociados a no duplicación

---

## Nota de trabajo

Este archivo es un plan vivo.

Cuando se implemente cada entregable, actualizar:

- estado actual
- próximos pasos
- riesgos residuales
- checklist de verificación

---

## Team routing split

### Estado
- [x] `/team` convertido en redirect por rol/tab legacy
- [x] Rutas separadas creadas para `progreso`, `formaciones`, `recuperacion`, `general`, `historial`, `templates`
- [x] Shell común extraído para navegación y contexto visual de equipo
- [x] Hook común extraído para perfil y áreas manager
- [x] Navegación interna actualizada para no generar `/team?tab=...`
- [x] Accesos manager del header migrados a rutas reales
- [x] `/team/page.tsx` mantenido como entrypoint de compatibilidad para redirects legacy

### Objetivo
Reducir la latencia percibida del módulo Team separando los flujos pesados en páginas distintas, en lugar de concentrarlos en un único workspace con tabs internos.

### Riesgos residuales
- persistencia del área seleccionada solo vía query string en rutas manager
- el coste de perfil/áreas manager sigue existiendo por ruta, aunque ya no comparte entrypoint con todos los paneles
- todavía hay que cerrar del todo la semántica del panel Team Progreso

### Verificación
- [x] `npm run lint` pasó tras la migración
- [x] solo quedaron warnings previos no relacionados

### Próximo trabajo recomendado
- [ ] cerrar la semántica final de KPIs en Team Progreso
- [ ] validar la lógica de completitud por rubro a nivel equipo
- [ ] continuar la investigación/fix del scoring de auditorías si vuelve a reproducirse alguna inconsistencia

---

## Audit Logs fase 1

### Estado
- [x] tabla `audit_logs` definida en migración
- [x] route handler para escritura/lectura de historial
- [x] logging best-effort integrado en Team assignments
- [x] logging best-effort integrado en Admin goals
- [x] modal reusable de historial bajo demanda

### Riesgos residuales
- el logging aún no es transaccional con la operación principal
- eventos viejos previos a la migración no aparecerán en el historial
- algunos dominios importantes todavía no publican eventos (`member_role`, `audit_run`)

### Verificación
- [ ] aplicar migración en Supabase
- [ ] verificar creación de logs al guardar asignaciones Team
- [ ] verificar creación de logs al guardar objetivos Admin
- [ ] validar filtros de modal por hotel/área/periodo
