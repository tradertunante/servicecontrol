---
title: "Cerrar una acción correctiva"
description: "Cómo marcar una acción correctiva como resuelta y qué ocurre después."
category: "auditorias"
order: 6
tags: ["acciones correctivas", "manager", "quality", "cierre", "resuelta"]
related:
  - acciones-correctivas
  - reauditorias
lastUpdated: "2026-05-10"
---

## Quién puede cerrar una acción

Solo **Manager** y **Quality** pueden cambiar el estado de una acción correctiva a "Resuelta".

## Cómo cerrar una acción

1. Ve al panel de **Acciones correctivas**.
2. Abre la acción que quieres cerrar.
3. Cambia el estado a **Resuelta**.
4. Opcional: añade un comentario explicando cómo se resolvió.
5. Pulsa **Guardar**.

## Qué ocurre al cerrar

- La acción desaparece del listado de pendientes.
- Queda registrada en el historial con fecha y usuario que la cerró.
- Si la plantilla tiene reauditoría obligatoria, el sistema programa automáticamente una nueva auditoría para verificar la corrección.

## Reabrir una acción

Si cerraste una acción por error, puedes cambiarla de nuevo a **Pendiente** o **En proceso** desde la misma pantalla, siempre que no se haya iniciado ya una reauditoría.

## Estados disponibles

| Estado | Significado |
|--------|-------------|
| Pendiente | Detectada, sin intervención todavía |
| En proceso | Se está trabajando en la corrección |
| Resuelta | Corrección completada y verificada |

Usa **En proceso** para acciones que requieren tiempo (ej: una reparación): así el Manager sabe que está en marcha sin necesidad de preguntar.