---
title: "Acciones correctivas"
description: "Qué son, cómo se generan automáticamente y quién puede gestionarlas."
category: "auditorias"
order: 3
tags: ["acciones correctivas", "no cumple", "manager", "quality"]
related:
  - cerrar-acciones
  - reauditorias
lastUpdated: "2026-05-10"
---

Cuando un punto se marca como **"No cumple"** en una auditoría, el sistema genera automáticamente una acción correctiva asociada a ese punto.

## Qué contiene una acción correctiva

- Descripción del punto que falló.
- Área y sección donde ocurrió.
- Fecha de la auditoría original.
- Estado actual: **Pendiente**, **En proceso** o **Resuelta**.
- Comentarios y fotos adjuntas por el Auditor, si las hay.

## Quién puede gestionar las acciones

Solo **Manager** y **Quality** pueden cambiar el estado de una acción correctiva. El Auditor puede verlas, pero no modificarlas.

## Cómo ver las acciones correctivas

- **Manager**: panel de **Acciones correctivas**, filtradas por su área.
- **Quality / Admin**: panel global con acciones de todas las áreas.

## Flujo típico

1. La auditoría se envía → las acciones se crean en estado **Pendiente**.
2. El Manager cambia a **En proceso** mientras se trabaja en la corrección.
3. Una vez resuelta, el Manager o Quality la marca como **Resuelta**.
4. Si la plantilla tiene reauditoría automática configurada, se programa una nueva verificación.

## Filtros disponibles

Puedes filtrar acciones por estado, área, auditoría de origen y rango de fechas desde la parte superior del panel.