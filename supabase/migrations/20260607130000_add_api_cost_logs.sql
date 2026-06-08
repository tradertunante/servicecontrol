create table api_cost_logs (
  id          uuid        primary key default gen_random_uuid(),
  hotel_id    uuid        references hotels(id) on delete set null,
  function_name text      not null,
  model       text        not null,
  input_tokens  integer   not null,
  output_tokens integer   not null,
  cost_usd    numeric(10, 8) not null,
  created_at  timestamptz not null default now()
);

create index api_cost_logs_hotel_created on api_cost_logs(hotel_id, created_at desc);
create index api_cost_logs_created       on api_cost_logs(created_at desc);

alter table api_cost_logs enable row level security;
-- Solo service role puede leer/escribir (no hay política pública)