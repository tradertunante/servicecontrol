-- Revierte 20260605110000: el bucket audit-photos era público y cualquier URL
-- filtrada (email reenviado, reporte compartido, logs) exponía evidencia
-- fotográfica del hotel para siempre y sin revocación.
--
-- Nuevo modelo: bucket privado. La app guarda `/api/photos/<fileName>` en
-- photo_paths y el endpoint app/api/photos/[fileName] valida sesión + hotel
-- (el fileName lleva el runId como prefijo) y redirige a una signed URL de
-- 5 minutos generada con service role.

-- 1. Bucket privado
update storage.buckets
  set public = false
  where id = 'audit-photos';

-- 2. Policies de storage versionadas (subida y borrado se hacen desde el
--    cliente de navegador; la lectura va siempre vía service role en el
--    endpoint, así que no hay policy de SELECT para authenticated).
drop policy if exists "audit_photos_insert_authenticated" on storage.objects;
create policy "audit_photos_insert_authenticated" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'audit-photos');

drop policy if exists "audit_photos_delete_authenticated" on storage.objects;
create policy "audit_photos_delete_authenticated" on storage.objects
  for delete to authenticated
  using (bucket_id = 'audit-photos');

-- 3. Reescribir las URLs públicas ya guardadas → ruta del endpoint.
--    photo_paths guardaba el publicUrl completo
--    (https://<proj>.supabase.co/storage/v1/object/public/audit-photos/<file>).
update public.audit_answers
set photo_paths = (
  select coalesce(
    array_agg(
      case
        when u.p like 'http%' then '/api/photos/' || regexp_replace(u.p, '^.*/', '')
        else u.p
      end
      order by u.ord
    ),
    '{}'
  )
  from unnest(photo_paths) with ordinality as u(p, ord)
)
where photo_paths is not null
  and exists (select 1 from unnest(photo_paths) as p where p like 'http%');

update public.audit_answers
set photo_path = '/api/photos/' || regexp_replace(photo_path, '^.*/', '')
where photo_path like 'http%';

-- Campo legacy sin escritores en la app, por si conserva URLs públicas
update public.audit_corrective_actions
set evidence_photo_path = '/api/photos/' || regexp_replace(evidence_photo_path, '^.*/', '')
where evidence_photo_path like 'http%';