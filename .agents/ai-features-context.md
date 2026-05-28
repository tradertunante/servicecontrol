# Contexto AI Features — Para continuar en nuevo chat
*Última actualización: 2026-05-25*

## Estado actual
- Estrategia completa refinada → `.agents/ai-features-strategy.md`
- Plan de implementación definido → en la conversación (pendiente de guardar como doc)
- Mockup visual del email → `.agents/email-mockup-weekly.html`
- Integración AI: Anthropic API, sin suscripción, pago por token. Pendiente de activar (cuenta + API key como variable de entorno en Vercel).

## Lo que se quiere trabajar ahora: Feature 3 — Generador de formaciones

### Flujo acordado
1. Cron semanal detecta recurrencia de fallos por área (ratio, no frecuencia absoluta)
2. AI interpreta los datos del período vs. histórico y decide qué merece formación
3. Sistema crea una `ai_training_suggestions` con estado `pending`
4. **Manager de área** recibe notificación → revisa el contenido generado → aprueba
5. Al aprobar → se crea un `training_topic` real → **QM es notificado**
6. QM ve panel con estados: pendiente / aprobada / realizada (accountability, no control)
7. Manager marca como realizada cuando se hace con el equipo

### Infraestructura existente relevante
- `training_topics` — tabla con title, description, area_id, hotel_id, qr_token
- `training_sessions` — sesiones de una formación
- `training_attendances` — asistencia a sesiones
- API routes: `app/api/trainings/topics/route.ts`, sessions, attendances, history
- Roles con acceso a trainings: admin, quality, manager, general_manager
- Helper: `getTrainingsCaller()` y `getTrainingsVisibleAreaIds()` en `lib/trainings/server`

### Tablas nuevas a crear (migraciones pendientes)
**`ai_training_suggestions`**
- hotel_id, area_id, question_id, question_text
- trigger_ratio (float), trigger_count (int), trigger_period_days (int)
- ai_content (jsonb): { objective, procedure[], checklist[], questions[] }
- review_status: 'pending' | 'approved' | 'realized'
- reviewed_at, approved_at, realized_at
- topic_id (FK → training_topics, nullable — se rellena al aprobar)
- created_at

### Punto importante sobre el trigger
- NO es un umbral SQL hardcodeado
- El AI recibe datos del período + histórico y decide qué patrones son relevantes
- El SQL solo agrega y sirve datos; el AI toma las decisiones

### Nota sobre reportes (Features 1 y 2) — en stand by
- Requieren cuenta Anthropic + variable de entorno en Vercel
- Arquitectura definida: narrativa generada en cron, guardada en `report_narratives`, incluida en email y dashboard
- Mockup visual aprobado