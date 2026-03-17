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

### Hecho el 2026-03-16

- capa compartida de autorización en `lib/auth/permissions.tsx` y `lib/auth/server.ts`
- sincronización mínima de sesión y hotel scope a cookies para habilitar auth server-side en App Router
- layouts server-side para cerrar acceso por URL en `areas`, `reports`, `admin`, `builder`, `users`, `team` y `members`
- alineación inicial del módulo `users` con hotel scope explícito para `superadmin`
- versionado de RLS para tablas expuestas por los módulos priorizados en `supabase/migrations/20260316140000_harden_prioritized_module_rls.sql`
- endurecimiento adicional de acceso App Router con `requirePageAccess(...)` para combinar rol/módulo + hotel scope server-side
- cierre server-side de `dashboard` y de subzonas operativas de `team`, eliminando redirecciones críticas que dependían solo del cliente
- limpieza residual de auth cliente en `superadmin`, `standards`, `users` y `builder`, eliminando `requireRoleOrRedirect(...)` de segmentos ya blindados por layout server-side
- endurecimiento de APIs privilegiadas en `admin/user-area-access`, `admin/delete-user` y `audits/submit`, cerrando validación de target role y scope real de run/área en servidor
- migración de mutaciones globales sensibles de `superadmin` a `app/api/superadmin/**`, cubriendo creación/edición de plantillas globales, import de templates, creación/edición de packs globales, asociación pack-template y alta/estado de hoteles
- cierre de residuos finales de auth client-side a nivel página en `audits/[id]/view`, `members`, `task`, `my` y `formaciones`, dejando la autoridad real en layouts y helpers server-side ya existentes

### Hecho el 2026-03-17

- `POST /api/audits/start` ahora crea el `audit_run` y siembra las filas iniciales de `audit_answers` desde servidor
- nuevas rutas `POST /api/audits/[id]/draft` y `PATCH /api/audits/[id]/metadata` para sacar del cliente los writes directos sobre `audit_answers` y `audit_runs`
- validación server-side compartida para hotel scope, área, ownership del auditor y bloqueo de edición cuando el run ya está `submitted`
- eliminación del sync final browser-side antes de `POST /api/audits/submit`; el submit ahora depende solo de drafts ya persistidos server-side
- cierre de `REPAIR 1` en `areas`, `reports`, `standards` e `history`, reemplazando pages cliente con wrappers server-side y quitando gating de sesión/perfil en navegador
- cierre estructural de `REPAIR 2` para hotel context con una sola resolución canónica en `lib/auth/server.ts`
- páginas server-side de `admin`, `members`, `my`, `team/*`, `analytics`, `areas`, `builder`, `users`, `audits/new` y `areas/[areaId]` ya reciben `hotelId` resuelto desde servidor y lo propagan al cliente
- hooks y módulos cliente de `team`, `members`, `my`, historial de áreas y `admin` dejaron de resolver hotel con mezcla ad hoc de `profile.hotel_id` y `fetchActiveHotel()`

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
- cierre de reparaciones prioritarias restantes y verificación binaria final

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

---

## Repair 1.1 cierre de brechas

### Estado
- [x] `create-user` ya valida matriz explícita de roles asignables por actor
- [x] edición sensible de usuarios movida a API server-side
- [x] `profiles` cerrada para auditores y flujos operativos limitados por endpoint de nombres
- [x] assets globales de builder mutables solo por `superadmin` en RLS
- [x] `team_members` y `team_member_areas` ya no aceptan mutación directa de manager por hotel completo
- [x] `audit-logs` ya rechaza consultas manager sin `area_id`
- [x] reglas cliente alineadas con layouts server-side en rutas priorizadas
- [x] `members` y `audit-logs` consumen la capa común de auth server-side

### Riesgos residuales
- falta aplicar y probar en la instancia real la migración `20260316170000_close_remaining_security_gaps.sql`
- algunos componentes Team siguen leyendo `profiles` same-hotel para uso operativo de manager/quality; eso quedó permitido de forma explícita en RLS y no para auditores

### Verificación
- [x] `npx tsc --noEmit` pasó
- [x] `npm run lint` pasó con warnings previos no relacionados

---

## Repair 1.2 hardening preventivo fuera de módulos priorizados

### Estado
- [x] `trainings/attendances` ya no acepta registros públicos sin token firmado y consumible una sola vez
- [x] `trainings/topics`, `trainings/sessions` y `trainings/history` ya aplican hotel scope y area scope real para `manager`
- [x] árbol `/superadmin` cerrado con layout server-side
- [x] árbol `/standards` cerrado con layout server-side y mutaciones sensibles movidas a API
- [x] rutas secundarias `audits`, `analytics`, `task`, `my` y `formaciones` ahora validan server-side antes de renderizar
- [x] endpoints legacy `user-management/*` delegan a la capa nueva
- [x] shell `app/(app)` exige autenticación server-side
- [x] migración nueva versiona RLS para superficies secundarias y tokens de registro de trainings

### Riesgos residuales
- falta aplicar y probar en la instancia real la migración `20260316190000_preventive_hardening_secondary_surfaces.sql`
- `training_*` y `audit_logs` siguen encapsulados por backend/service-role; su acceso directo cliente permanece bloqueado por RLS sin policies públicas

### Verificación
- [ ] ejecutar `npx tsc --noEmit`
- [ ] ejecutar `npm run lint`
- [ ] aplicar migración en Supabase
