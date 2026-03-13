alter table public.training_topics
add column if not exists area_id uuid references public.areas(id) on delete restrict;

create index if not exists training_topics_area_id_idx
on public.training_topics (area_id);

with creator_area_candidates as (
  select
    tt.id as topic_id,
    array_agg(distinct uaa.area_id) filter (where uaa.area_id is not null) as resolved_area_ids,
    count(distinct uaa.area_id)::int as area_count
  from public.training_topics tt
  join public.user_area_access uaa
    on uaa.user_id = tt.created_by
   and uaa.hotel_id = tt.hotel_id
  where tt.area_id is null
  group by tt.id
)
update public.training_topics tt
set area_id = cac.resolved_area_ids[1]
from creator_area_candidates cac
where tt.id = cac.topic_id
  and cac.area_count = 1
  and tt.area_id is null;
