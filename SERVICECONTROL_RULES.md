# ServiceControl — Rules & Guardrails (AI + Dev)

---

## 0) Objetivo

Este repo es **ServiceControl**: un SaaS de auditorías y estándares operativos para hoteles.

Prioridades absolutas:

1. UX clara y profesional
2. Multi-hotel sólido
3. Seguridad con RLS
4. Código simple, mantenible y escalable
5. Consistencia visual centralizada

---

## 1) Principios de trabajo

- **Simplicidad primero:** siempre elegir la solución más simple que funcione.
- **Cambios mínimos:** tocar solo lo necesario, evitar refactors innecesarios.
- **Verificar antes de cerrar:** comprobar consola, errores TS y funcionamiento real.
- **No inventar estructura:** si falta una tabla, columna o relación → preguntar o crear migración clara.
- **Evitar duplicación:** reutilizar hooks, utils y componentes existentes.

---

## 2) Stack y convenciones técnicas

### Stack oficial

- Next.js App Router
- TypeScript estricto
- Supabase (Postgres + RLS)
- CSS centralizado en `globals.css`

---

### Organización de código

- Hooks en `_hooks/*`
- Utilidades en `_lib/*`
- Tipos en `types.ts` o `_lib/*Types.ts`
- Componentes reutilizables en `_components/*`

---

### Buenas prácticas

- No meter lógica SQL dispersa.
- Centralizar queries por módulo.
- Usar `useMemo` para transforms pesados.
- Mantener separación clara entre representacional y lógica.

---

## 3) Roles y permisos (NO romper)

Roles válidos:

- superadmin
- admin
- manager
- auditor

---

### Reglas críticas

- `superadmin` NO puede asignarse desde paneles normales.
- Usuarios siempre restringidos por `hotel_id`.
- Toda query sensible debe respetar RLS.
- Nunca mezclar datos entre hoteles.

---

## 4) Multi-hotel — reglas duras

- Toda data de negocio debe filtrarse por `hotel_id`.
- El hotel activo se obtiene desde:
