-- Crear área "Otros" para todos los hoteles que no la tienen
insert into public.areas (hotel_id, name, type, active)
select h.id, 'Otros', 'otros', true
from public.hotels h
where not exists (
  select 1 from public.areas a
  where a.hotel_id = h.id and lower(a.name) = 'otros'
);

-- Limpiar default_area_name de ServiceControl Standards (esa lógica era incorrecta)
update public.global_audit_packs
set default_area_name = null
where name = 'ServiceControl Standards';