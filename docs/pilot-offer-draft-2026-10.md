# Oferta de piloto — borrador de trabajo

> [PLACEHOLDER - NO PUBLICAR]
> Borrador interno. Ninguna cifra de este documento es un resultado medido.
> Los criterios de éxito son propuestas a validar con el hotel piloto antes de firmar.

Written for: equipo interno (fundador) que prepara conversaciones con hoteles.

## 1. Alcance

- 1 hotel, 1 área (candidatas: Housekeeping o Front Desk; alta frecuencia y fallos visibles).
- 1 plantilla de auditoría configurada con los criterios que el hotel ya usa.
- 2 a 3 auditores y 1 responsable de calidad con acceso a dashboard.

## 2. Duración y fases

| Semana | Fase | Qué pasa |
|---|---|---|
| 0 | Preparación | Firma de acuerdo de piloto y DPA. Configuración de área y plantilla. |
| 1-2 | Línea base | El hotel sigue con su método actual (papel, Excel o WhatsApp). Se registran desviaciones repetidas y tiempo de preparación de informes. |
| 3-6 | Piloto | Auditorías en ServiceControl. Acciones correctivas y reauditorías. Informe semanal a dirección. |
| 6 | Cierre | Informe de piloto de una página: línea base frente a resultado. Entrevista de 30 minutos y permiso por escrito para caso. |

## 3. Criterio de éxito (propuesta)

- Reducir al menos un 30 % las desviaciones repetidas entre la línea base y la semana 6.
- Cerrar al menos el 80 % de las acciones correctivas dentro del plazo acordado.

Nota: el segundo criterio necesita que cada acción tenga fecha límite. Hoy la fecha solo se fija a mano (ver `app/api/corrective-actions/update/route.ts`). Antes de ofrecer este criterio hay que decidir cómo se fija.

## 4. Qué entrega ServiceControl

- Configuración de área y plantilla, con formación inicial a auditores.
- Soporte directo durante el piloto, con canal acordado.
- Informe semanal para dirección y el informe de cierre.

## 5. Qué da el hotel a cambio

- Feedback semanal breve (15 minutos).
- Permiso por escrito para usar un caso documentado (nombre, cargo y cifras). Opcional: logo y cita grabada.
- Derecho a salir en cualquier momento, sin coste.

## 6. Precio

- 0 € durante el piloto.
- Después, el plan que corresponda. Cualquier descuento posterior debe estar implementado antes de prometerlo (ver hallazgo H3 del análisis de landing).

## 7. Condiciones que faltan antes de enviar

- [ ] DPA firmado o plantilla revisada. Hoy no hay plantilla en el repo.
- [ ] Revisión legal del texto de privacidad (subencargados añadidos en `app/privacy/page.tsx`).
- [ ] Decisión sobre cómo se fija la fecha límite de las acciones correctivas.
- [ ] Permiso del hotel para citar su nombre. Sin permiso, no hay caso.
