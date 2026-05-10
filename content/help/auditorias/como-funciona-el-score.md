---
title: "Cómo se calcula el score"
description: "Qué es el score de cumplimiento, cómo se calcula y qué factores lo afectan."
category: "auditorias"
order: 2
tags: ["score", "cumplimiento", "calificación", "pesos"]
related:
  - ejecutar-auditoria
  - mejores-practicas-auditorias
lastUpdated: "2026-05-10"
---

El **score de cumplimiento** mide qué porcentaje de los puntos auditados están correctos.

## Fórmula base

```
Score = (Respuestas "Cumple" / Total aplicables) × 100
```

Los puntos marcados como **N/A** no entran en el cálculo. Solo cuentan "Cumple" y "No cumple".

## Ejemplo

Una auditoría con 40 preguntas, 5 marcadas N/A y 3 como "No cumple":

- Total aplicables: 35
- Cumplen: 32
- **Score: 91,4%**

## Pesos por sección

Si el Admin configuró pesos distintos por sección, las preguntas de secciones con mayor peso impactan más en el score final. Las secciones críticas (ej: seguridad alimentaria, protocolos de seguridad) suelen tener peso más alto.

## Qué sube el score

- Responder "Cumple" en preguntas aplicables.
- Resolver acciones correctivas y completar una reauditoría exitosa.

## Qué baja el score

- Respuestas "No cumple".
- A igual número de fallos, una sección con mayor peso baja más el score.

## Dónde ver el score

| Dónde | Qué muestra |
|-------|-------------|
| Durante la auditoría | Indicador en tiempo real |
| Dashboard | Score promedio por área y período |
| Historial de auditorías | Score de cada auditoría enviada |

Un score por debajo del umbral configurado por el Admin genera una alerta visual en el dashboard.