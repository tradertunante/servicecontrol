# Estrategia AI Features — ServiceControl
*Creado: 2026-05-24 | Refinado: 2026-05-25*

---

## Objetivo
Añadir features de IA que cierren el ciclo calidad-formación y diferencien SC frente a competidores genéricos como Oditly. Coste de API estimado total: <$0.30/hotel/mes. Sin impacto en precio de licencia.

---

## Usuarios centrales

| Rol | Qué gana |
|-----|----------|
| **Manager de área** | Por primera vez tiene visibilidad narrativa de su propia área. Es el actor principal de Feature 3 — tiene responsabilidad real sobre su equipo. |
| **Quality Manager** | Vista agregada del hotel + panel de accountability sobre formaciones generadas. No es gatekeeper, es garantía de que el sistema funciona. |
| **General Manager** | Reporte de hotel semanal/mensual. Visibilidad sin fricción. |

---

## Feature 1 — Reporte narrativo semanal

### Qué es
El reporte semanal deja de ser tablas. El AI interpreta el período, detecta tendencias, identifica áreas en riesgo y escribe un resumen en lenguaje natural. **Dos niveles de reporte generados desde el mismo sistema.**

### Nivel hotel → QM + GM
> "Esta semana el hotel bajó 6 puntos respecto a la anterior. El 65% de las desviaciones se concentran en Housekeeping, turno de tarde. Hay 4 acciones correctivas abiertas con más de 7 días sin cierre — 2 de ellas son recurrentes desde la semana pasada. Mantenimiento mejoró por tercer semana consecutiva."

### Nivel área → manager de área
> "Tu área bajó 4 puntos esta semana. El problema está concentrado en la limpieza de baños en el turno de tarde — 6 de las 9 desviaciones son del mismo tipo. Tienes 2 correctivas abiertas desde hace más de 5 días sin cierre."

El manager de área pasa de no tener visibilidad narrativa propia a tener su reporte específico. Es el cambio más relevante frente al planteamiento original.

### Datos de entrada
- Puntuaciones por área (semana actual vs. anterior)
- Desviaciones detectadas (área, tipo, turno si disponible)
- Correctivas abiertas / cerradas / vencidas
- Reauditorías completadas

### Entrega
- Email automático al GM y QM cada lunes (nivel hotel)
- Email automático a cada manager de área cada lunes (nivel área)
- Accesible desde el dashboard (sección "Resumen de la semana")
- Tono: directo, sin humo

### Coste API
~$0.02 por reporte de hotel + ~$0.02 por área → ~$0.08–$0.16/mes por hotel según número de áreas

---

## Feature 2 — Reporte narrativo mensual

### Qué es
Versión extendida del semanal. Visión estratégica del mes: progreso respecto al mes anterior, áreas que mejoran vs. que se estancan, acciones correctivas con mayor tasa de reapertura, tendencia general del hotel. También con nivel hotel y nivel área.

### Diferencia clave vs. semanal
- Incluye comparativa mes a mes (últimos 3 meses si hay datos)
- Más orientado al dueño / dirección general que al QM
- Output más largo — puede exportarse como PDF branded para presentar al ownership (fase 2)

### Entrega
- Email el primer lunes de cada mes
- Opción de exportar PDF branded (fase 2)

### Coste API
~$0.04 por reporte → ~$0.04/mes por hotel

---

## Feature 3 — Generador de formaciones basado en hallazgos recurrentes

### Qué es
Cuando el sistema detecta que una desviación se repite (umbral por ratio dentro del área + mínimo de ocurrencias absolutas), sugiere generar una formación específica para ese problema. El AI crea el contenido; el manager de área lo revisa y aprueba; el QM mantiene visibilidad de todo el pipeline.

### Trigger: ratio por área, no frecuencia absoluta
El trigger se mide como *ratio de desviaciones del mismo tipo dentro del área en los últimos N días*, no por frecuencia absoluta. Un hotel pequeño con 20 auditorías/mes no puede competir en volumen con uno grande — el ratio lo iguala. Se añade un umbral mínimo de ocurrencias absolutas para evitar falsos positivos en áreas con pocas auditorías.

Ejemplo: "El 40% de las desviaciones de Housekeeping en las últimas 3 semanas son 'Limpieza de baños incompleta' (6 ocurrencias)."

### Flujo
1. Sistema detecta recurrencia → **notificación al manager de área**
2. Manager de área revisa el contenido generado por AI (UI diseñada para forzar atención, no solo un botón "aprobar")
3. Manager de área aprueba → formación queda activa para su equipo
4. **QM es notificado** y puede ver el estado en su panel

### Estados de formación (visibles al QM)
| Estado | Qué significa |
|--------|--------------|
| **Pendiente** | El sistema la generó, el manager aún no la ha revisado |
| **Aprobada** | El manager la aprobó, pendiente de realizarse con el equipo |
| **Realizada** | El manager la marcó como completada |

El QM usa este panel como garantía: si ve muchas formaciones en "pendiente" o "aprobada" sin avanzar, sabe que ese manager no está dando seguimiento — sin tener que preguntar.

### Contenido generado por el AI
1. Objetivo de la formación (qué debe cambiar)
2. Procedimiento correcto (paso a paso)
3. Checklist de verificación para el equipo
4. 3–5 preguntas de comprobación post-formación

### Trazabilidad
La formación queda vinculada a los hallazgos que la originaron. Se puede ver qué desviaciones concretas la generaron.

### Por qué es estratégico
Cierra el loop completo que promete SC: detectar → asignar → verificar → **formar**. La formación deja de ser un registro manual y se convierte en consecuencia automática de los hallazgos reales del hotel. El manager de área pasa de receptor de datos a actor con responsabilidad sobre su mejora.

### Coste API
~$0.04 por formación generada → ~$0.16/mes por hotel (asumiendo 4 generaciones/mes)

---

## Plan de implementación

### Orden recomendado
1. **Reporte semanal nivel hotel** — base técnica, menor complejidad, impacto inmediato en demos
2. **Reporte semanal nivel área** — mismo sistema, filtrado diferente, nuevo usuario
3. **Reporte mensual** — mismo código, diferente rango de fechas + lógica comparativa
4. **Generador de formaciones** — trigger de recurrencia + UI de revisión + panel QM

### Esfuerzo estimado

| Feature | Backend | Frontend | AI/Prompt | Total |
|---------|---------|----------|-----------|-------|
| Reporte semanal (hotel + área) | 2 días | 1.5 días | 1 día | ~4.5 días |
| Reporte mensual | 1 día | 0.5 días | 0.5 días | ~2 días |
| Generador formaciones | 3 días | 2.5 días | 1 día | ~6.5 días |
| **Total** | | | | **~13 días** |

### Stack técnico
- LLM: Claude Sonnet 4.6 (`claude-sonnet-4-6`) con prompt caching en el system prompt
- Llamadas desde route handler server-side (`app/api/`)
- Jobs programados: cron via Supabase Edge Functions (semanal/mensual)
- El AI recibe datos agregados estructurados (período actual + histórico de N semanas) y es él quien detecta patrones, tendencias y qué merece formación — no hay umbral hardcodeado en SQL
- El SQL es solo capa de agregación: sirve los datos al AI, no toma decisiones

### Dónde aplica el AI y dónde no

| Tipo de reporte | AI | Motivo |
|---|---|---|
| Reporte semanal automático (cron) | ✅ Sí | Frecuencia fija, coste predecible |
| Reporte mensual automático (cron) | ✅ Sí | Idem |
| Reporte de período personalizado (UI) | ❌ No | El usuario controla el rango → coste impredecible |

Los reportes de período personalizado mantienen el formato actual: datos y tablas, sin interpretación AI.

---

## Supuestos a validar antes de implementar

- [ ] **¿El manager de área tiene sesiones activas en la plataforma?** Si el rol existe pero no entra, hay que resolver el canal de entrega (email, notificación push) antes de construir la feature
- [ ] **¿Las desviaciones son opciones fijas o texto libre?** Si son texto libre, la detección de recurrencia por SQL simple fallará — necesitaría categorización previa o embeddings
- [ ] **¿Cuál es el umbral de ratio razonable?** Necesita calibración con datos reales antes de activar notificaciones en producción

---

## Coste total por hotel/mes

| Feature | Coste API |
|---------|-----------|
| Reporte semanal hotel (×4) | ~$0.08 |
| Reporte semanal por área (×4 × N áreas) | ~$0.08–$0.16 |
| Reporte mensual (×1) | ~$0.04 |
| Formaciones generadas (×4) | ~$0.16 |
| **Total** | **~$0.36–$0.44/hotel/mes** |

Con licencia a €200–400/hotel/mes: el coste de IA es **<0.2% del revenue**.

---

## Lo que NO haremos (por ahora)
- **AI en reportes de período personalizado** — el usuario controla el rango y dispararía tokens de forma impredecible; esos reportes son datos y tablas
- **Chat conversacional con los datos** — valor alto, complejidad alta, es fase 2
- **Verificación AI de fotos** — complejidad alta, relevancia baja en hotelería con equipo propio
- **Briefing diario** — demasiado ruido para el ritmo operativo hotelero
- **Priorización AI de correctivas** — útil pero no en esta fase
- **Reporte mensual en PDF branded** — fase 2, primero validar que el email se lee