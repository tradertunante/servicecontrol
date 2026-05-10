---
title: "Reauditorías"
description: "Cómo funciona el ciclo de reauditoría: cuándo se activa, quién la ejecuta y cómo comparar resultados."
category: "auditorias"
order: 4
tags: ["reauditoría", "seguimiento", "verificación", "ciclo"]
related:
  - acciones-correctivas
  - cerrar-acciones
lastUpdated: "2026-05-10"
---

La reauditoría verifica que los puntos que fallaron en la auditoría original ahora cumplen. Es parte del mismo ciclo, no un módulo separado.

## Cuándo se activa

- **Automáticamente**: si el Admin configuró reauditoría obligatoria en la plantilla. Se programa cuando se cierran las acciones correctivas del área.
- **Manualmente**: el Admin puede crear una reauditoría en cualquier momento desde el panel de auditorías.

## Quién la ejecuta

Cualquier Auditor asignado por el Admin. No tiene que ser el mismo que realizó la auditoría original.

## Qué incluye la reauditoría

Por defecto, solo se evalúan los puntos que fallaron. Los puntos que cumplieron no se vuelven a revisar.

## Cómo completarla

El proceso es idéntico al de una auditoría normal. Consulta [Cómo ejecutar una auditoría](/help/ejecutar-auditoria). Los puntos ya están pre-filtrados: solo verás los que necesitan verificación.

## Comparar resultados

Desde el historial de cualquier auditoría puedes ver la comparativa con su reauditoría:

- Score original vs. score de la reauditoría.
- Qué puntos pasaron de "No cumple" a "Cumple".
- Qué puntos siguen fallando (se generan nuevas acciones correctivas).

## Ciclo completo

Auditoría → Acciones correctivas → Corrección → Reauditoría → Cierre

Si la reauditoría genera nuevos fallos, el ciclo se repite para esos puntos.