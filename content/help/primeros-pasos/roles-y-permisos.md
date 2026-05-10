---
title: "Roles y permisos"
description: "Qué puede hacer cada rol en ServiceControl. Tabla comparativa completa."
category: "primeros-pasos"
order: 2
tags: ["roles", "permisos", "admin", "auditor", "manager"]
related:
  - agregar-usuarios
lastUpdated: "2026-05-10"
---

## Tabla de permisos

| Función | Admin | Auditor | Manager | Quality | GM |
|---------|:-----:|:-------:|:-------:|:-------:|:--:|
| Configurar plantillas y áreas | ✓ | — | — | — | — |
| Crear y asignar auditorías | ✓ | — | — | — | — |
| Ejecutar auditorías asignadas | — | ✓ | — | — | — |
| Ver sus propias auditorías | — | ✓ | — | — | — |
| Ver auditorías de su área | — | — | ✓ | ✓ | ✓ |
| Cambiar estado de acciones correctivas | — | — | ✓ | ✓ | — |
| Ver dashboard global | ✓ | — | — | ✓ | ✓ |
| Ver dashboard de área | — | — | ✓ | ✓ | ✓ |
| Exportar reportes | ✓ | — | — | ✓ | ✓ |
| Gestionar usuarios | ✓ | — | — | — | — |

## Descripción de cada rol

**Admin** — Configura áreas, plantillas, usuarios y parámetros de auditoría. No ejecuta auditorías.

**Auditor** — Recibe auditorías asignadas y las completa en campo. Solo ve sus propias auditorías activas.

**Manager** — Responsable de uno o varios áreas. Gestiona las acciones correctivas de su área y puede marcarlas como resueltas.

**Quality** — Visión transversal de todas las áreas. Mismas capacidades que GM más la gestión de acciones correctivas.

**General Manager (GM)** — Acceso a indicadores ejecutivos y reportes. No interviene en la operación directa.

## Notas

- Un usuario solo puede tener un rol a la vez.
- El rol se puede cambiar en cualquier momento desde **Equipo**.
- Los datos históricos se conservan aunque cambie el rol.