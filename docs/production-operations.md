# ServiceControl — Operaciones de producción

> Última revisión: 2026-07-06. Documento de referencia para despliegue, CI/CD,
> monitorización, fiabilidad y escalado. Los artefactos ejecutables viven en
> `.github/workflows/`, `Dockerfile`, `docker-compose.yml` y `deploy/k8s/`.

## 1. Arquitectura de producción

Plataforma primaria: **Vercel (serverless) + Supabase (gestionado)**. No hay
servidores propios que operar; la fiabilidad se gestiona por configuración y
observabilidad, no por infraestructura.

```
                        ┌──────────────────────────────┐
   Usuario ──HTTPS──▶   │  Vercel Edge Network (CDN)   │
                        │  · estáticos + ISR cache     │
                        │  · middleware.ts (Edge):     │
                        │    CORS, rate limit, auth    │
                        └──────────┬───────────────────┘
                                   │
                        ┌──────────▼───────────────────┐     ┌─────────────────┐
                        │  Vercel Functions (Node)     │────▶│ Upstash Redis   │
                        │  · app/(app), app/api/*      │     │ (rate limiting  │
                        │  · crons (vercel.json)       │     │  distribuido)   │
                        └──┬────────┬─────────┬────────┘     └─────────────────┘
                           │        │         │
              ┌────────────▼──┐  ┌──▼──────┐  ├──▶ Stripe (billing + webhook)
              │ Supabase      │  │ Resend  │  ├──▶ Anthropic (narrativas informes)
              │ · Postgres+RLS│  │ (email) │  └──▶ Cal.com (demos + webhook)
              │ · Auth (GoTrue)│ └─────────┘
              │ · Storage fotos│      Observabilidad (salida):
              │ · Edge Functions│     Sentry (errores) · Better Stack (logs+uptime)
              └────────────────┘     PostHog (producto) · Vercel (métricas edge)
```

Puntos de entrada sin sesión: webhooks de Stripe y Cal.com, endpoints de trial,
crons (`Authorization: Bearer CRON_SECRET`) y `/api/health`. Todo lo demás pasa
por el guard de middleware + RLS en Postgres (revisión completa 2026-06-10).

## 2. Flujo de despliegue

```
feature branch ──PR──▶ GitHub
                        │  CI (ci.yml): lint · typecheck · unit tests · build
                        │  Vercel Preview Deployment (URL por PR)
                        ▼
                 merge a main
                        │
        ┌───────────────┼──────────────────────────────┐
        ▼               ▼                              ▼
  Vercel Production   migrations.yml                integration-tests.yml
  (deploy automático) (solo si cambia               (nightly 05:00 UTC,
                       supabase/migrations/;         detecta drift RLS)
                       requiere aprobación manual
                       en environment "production")
```

Reglas:

- **Orden BD ↔ código**: las migraciones deben ser compatibles con el código
  anterior Y el nuevo (patrón expand→migrate→contract). Nunca borrar/renombrar
  una columna en la misma release que deja de usarla: primero deploy del código
  que no la usa, después la migración que la elimina.
- **Rollback**: Vercel → "Instant Rollback" al deployment anterior (segundos,
  sin rebuild). BD → no hay rollback automático; escribir migración inversa o
  restaurar con PITR de Supabase. Por eso las migraciones se aprueban a mano.
- **Preview deployments**: cada PR obtiene URL propia contra la BD de
  producción (no hay entorno staging de BD). No probar operaciones destructivas
  desde previews; para eso usar un proyecto Supabase de staging (pendiente,
  ver §8).

## 3. CI/CD — workflows y secrets

| Workflow | Trigger | Qué hace |
|---|---|---|
| `ci.yml` | PR y push a main | `next lint`, `tsc --noEmit`, `vitest run`, `next build` |
| `integration-tests.yml` | nightly + manual | 76 tests contra Supabase real (RLS, RPC) |
| `migrations.yml` | push a main con cambios en `supabase/migrations/` | `supabase db push` con aprobación manual |
| `docker-image.yml` | manual | valida/publica la imagen de contingencia en GHCR |

Secrets a configurar en GitHub (Settings → Secrets and variables → Actions):

- Repo: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` (solo para integration tests).
- Environment `production` (crear con *required reviewers*):
  `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`.

Recomendado en GitHub: branch protection en `main` exigiendo el check `CI`
verde antes de merge, y en Vercel activar **"Require CI checks to pass"**
(Deployment Protection) para que un push directo roto no llegue a producción.

## 4. Monitorización y alertas

Ya instrumentado en el código:

- **Sentry** (`@sentry/nextjs`, client + server + edge; sourcemaps si
  `SENTRY_AUTH_TOKEN` está en Vercel).
- **Better Stack / Logtail** (`lib/logger.ts`): eventos estructurados JSON
  (`cors_violation`, `rate_limit_exceeded`, errores de negocio). Test manual:
  `POST /api/observability/better-stack`.
- **PostHog**: analítica de producto y funnel de landing.
- **`/api/health`** (nuevo): estado agregado + latencia a Supabase + commit
  desplegado. Público, sin datos internos. 200 sano / 503 degradado.

Alertas a configurar (una vez, en cada panel):

| Señal | Herramienta | Umbral sugerido |
|---|---|---|
| Uptime `GET /api/health` | Better Stack Monitors | check 60s, alerta a los 2 fallos |
| Nuevos errores / regresiones | Sentry Alerts | issue nuevo en producción → email/Slack |
| Tasa de errores 5xx | Vercel → Observability | >1% en 5 min |
| `rate_limit_exceeded` anómalo | Better Stack (query sobre logs) | >100/h |
| Webhook Stripe fallando | Stripe Dashboard → Webhooks | Stripe ya reintenta y avisa por email; verificar destinatario |
| Cron no ejecutado | Vercel → Cron Jobs (logs) + heartbeat | Better Stack Heartbeat opcional por cron |
| BD: CPU/conexiones/disco | Supabase → Reports + alertas | avisos por defecto del plan |

Regla operativa: **Sentry para "qué se rompió", Better Stack para "qué pasó",
PostHog para "qué hacen los usuarios", `/api/health` para "¿estamos vivos?"**.

## 5. Fiabilidad y reducción de riesgo de downtime

Ya cubierto por diseño (no tocar):

- Serverless: sin servidores que parcheer, autoscaling horizontal implícito.
- Deploys atómicos e inmutables en Vercel + Instant Rollback.
- Rate limiting distribuido (Upstash) en el edge, antes de tocar funciones.
- RLS en las 62 tablas + tests de integración que la verifican cada noche.
- Autosave con retry y submit transaccional vía RPC (sin estados a medias).
- Headers de seguridad + CSP estrictos en `next.config.js`.

Acciones de configuración (checklist §8):

- **Supabase PITR**: activar Point-in-Time Recovery (plan Pro) — el backup
  diario por defecto puede perder hasta 24 h de auditorías. RPO objetivo: ≤5 min.
- **Vercel Skew Protection**: activar para que clientes con bundle viejo sigan
  hablando con funciones de su misma versión durante los deploys.
- **Deployment Protection + branch protection**: main solo recibe código con CI verde.
- **Dominio y DNS**: TTL bajo (300 s) en el CNAME para poder mover tráfico rápido.

Riesgo residual principal: **dependencia de Supabase** (BD+Auth+Storage en un
solo proveedor, single region). Mitigación: PITR + export semanal opcional
(`supabase db dump` programable como workflow) + el plan de portabilidad de §7
solo cubre el runtime de la app, no la BD.

## 6. Escalado

- **App (Vercel)**: escala por invocación; nada que hacer hasta límites de
  plan. Vigilar duración de funciones pesadas (informes Excel con `xlsx`,
  narrativas con Anthropic) — si rozan el timeout, subir `maxDuration` por
  ruta con `export const maxDuration = 60`.
- **BD (Supabase)**: el cuello real. Orden de actuación cuando crezca la carga:
  1. Revisar Supabase → Query Performance (índices ya auditados 2026-06-12).
  2. Conexiones: las funciones serverless deben ir por el **pooler (pgBouncer,
     puerto 6543)** — supabase-js usa la API REST, así que hoy no es problema;
     lo será si se añade acceso directo a Postgres.
  3. Subir compute tier (vertical) — sin cambio de código.
  4. Read replicas para reporting/analytics (horizontal) — requiere separar
     lecturas pesadas.
- **Ya optimizado**: RPC `get_audit_run_full` (elimina waterfall de 8 queries),
  lazy-load de xlsx/joyride/posthog, `count_only` en backlog, resize de
  imágenes en cliente antes de subir a Storage.
- **Pendiente conocido** (memoria del proyecto): paginación server-side en
  listados grandes — primer síntoma esperable con hoteles de muchos miembros.

## 7. Plan de portabilidad (Docker / Kubernetes)

Vercel es la plataforma correcta hoy (crons, edge middleware, previews, cero
ops). Los artefactos de contingencia existen para eliminar el lock-in como
riesgo, y se validan con `docker-image.yml` (ejecutarlo trimestralmente):

- `Dockerfile` — multi-stage, Next standalone (`BUILD_STANDALONE=1`), non-root,
  `HEALTHCHECK` contra `/api/health`. Las `NEXT_PUBLIC_*` van como build-args
  (se inlinen en el bundle); los secretos de servidor solo en runtime.
- `docker-compose.yml` — prueba local de la imagen contra Supabase gestionado.
- `deploy/k8s/deployment.yaml` — Deployment (2 réplicas, rolling update sin
  downtime, probes liveness/readiness sobre `/api/health`) + Service + HPA
  (2–6 réplicas al 70 % CPU).
- `deploy/k8s/ingress.yaml` — TLS con cert-manager; `proxy-body-size: 15m`
  para las fotos de auditoría.
- `deploy/k8s/cronjobs.yaml` — réplica exacta de los crons de `vercel.json`
  (los crons de Vercel NO existen fuera de Vercel; esto es lo primero que se
  olvida en una migración).
- `deploy/k8s/secret.example.yaml` — plantilla del Secret de runtime.

Lo que NO cubre: la BD (Supabase seguiría gestionado o habría que autoalojar
supabase/postgres, fuera de alcance) y el rate limiting seguiría en Upstash.

## 8. Checklist de despliegue a producción

Setup único (verificar/activar una vez):

- [ ] GitHub: branch protection en `main` con check `CI` requerido
- [ ] GitHub: environment `production` con required reviewers + secrets de Supabase
- [ ] GitHub: secrets de repo para CI e integration tests
- [ ] Vercel: todas las env vars de `.env.example` en Production (y las públicas también en Preview)
- [ ] Vercel: `SENTRY_AUTH_TOKEN` para sourcemaps; `SALES_NOTIFICATION_EMAIL` (pendiente de la revisión 2026-07-04)
- [ ] Vercel: Skew Protection + Deployment Protection activados
- [ ] Vercel: verificar ejecución real de los 3 crons (logs del lunes 08:00)
- [ ] Supabase: PITR activado; alertas de recursos con destinatario correcto
- [ ] Stripe: webhook apuntando al dominio de producción, en modo live, con `STRIPE_WEBHOOK_SECRET` live
- [ ] Better Stack: monitor de uptime sobre `https://<dominio>/api/health`
- [ ] Sentry: alert rule "new issue in production" → email/Slack
- [ ] Probar `/api/health` en producción (200 y `commit` correcto)
- [ ] E2E de checkout en Stripe test (pendiente de la revisión 2026-07-04)

Por release (lo automatiza CI, verificar solo en cambios sensibles):

- [ ] CI verde (lint + types + tests + build)
- [ ] Si hay migración: ¿es compatible con el código actualmente desplegado?
- [ ] Si toca billing/webhooks: probar en preview con Stripe test antes de merge
- [ ] Tras deploy: `/api/health` OK, Sentry sin issues nuevos en 30 min

## 9. Runbook de incidentes

**La app no responde (uptime alert):**
1. `curl https://<dominio>/api/health` — si responde 503 con `supabase.ok: false`, el problema es Supabase → status.supabase.com y dashboard del proyecto.
2. Si no responde nada: Vercel status + panel de deployments. ¿Coincide con un deploy reciente? → **Instant Rollback**.
3. Revisar Sentry (errores nuevos) y Better Stack (últimos logs) para acotar.

**Error 5xx tras un deploy:** Instant Rollback primero, diagnóstico después.
El rollback no revierte migraciones: si el deploy incluía una, comprobar que el
código anterior sigue siendo compatible (debería, por la regla expand/contract).

**Webhook de Stripe fallando:** Stripe reintenta con backoff ~3 días. Ver
Stripe → Developers → Webhooks → intentos fallidos. Tras arreglar, reenviar los
eventos fallidos desde el propio dashboard. Verificar `STRIPE_WEBHOOK_SECRET`
si son errores de firma (cambió con la migración post-Basil, commit `1e242cf`).

**Cron no ejecutó (informes no llegaron):** Vercel → Cron Jobs → logs. Los
endpoints admiten invocación manual con `Authorization: Bearer CRON_SECRET`
(GET). Ejecutar a mano y revisar logs de Resend si el fallo fue de envío.

**Fuga/rotación de secretos:** rotar en origen (Supabase service role, Stripe,
Resend, Upstash), actualizar en Vercel y GitHub, redeploy. El anon key de
Supabase es público por diseño (protegido por RLS); el service role NUNCA debe
aparecer en código cliente (`server-only` ya lo protege en `lib/supabaseAdmin.ts`).
