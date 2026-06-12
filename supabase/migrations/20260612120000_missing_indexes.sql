-- Índices que faltaban (informe estratégico 2026-06-11, sección 1.4)
-- y constraint de unicidad en trial_leads.email (cerraba una carrera en el
-- alta de trials: dos requests simultáneas del mismo email pasaban el check).

-- Paneles de correctivas y backlog filtran por hotel + status constantemente
create index if not exists idx_corrective_actions_hotel_status
  on public.audit_corrective_actions (hotel_id, status);

-- departments/backlog consulta answers por question_id sobre la tabla más grande
create index if not exists idx_audit_answers_question_id
  on public.audit_answers (question_id);

-- generate-suggestions y reportes filtran hotel + status + rango temporal;
-- el índice existente (hotel_id, status) no cubre el orden por fecha
create index if not exists idx_audit_runs_hotel_executed_submitted
  on public.audit_runs (hotel_id, executed_at desc)
  where status = 'submitted';

-- Lookups de plantilla por hotel en decenas de rutas
create index if not exists idx_profiles_hotel_id
  on public.profiles (hotel_id);

-- Campana de notificaciones
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

-- Dedupe del cron de sugerencias IA
create index if not exists idx_ai_suggestions_hotel_status_created
  on public.ai_training_suggestions (hotel_id, review_status, created_at);

-- trial_leads.email único: primero dedupe conservando el registro más antiguo
delete from public.trial_leads t
using public.trial_leads older
where t.email = older.email
  and t.created_at > older.created_at;

create unique index if not exists trial_leads_email_unique_idx
  on public.trial_leads (email);