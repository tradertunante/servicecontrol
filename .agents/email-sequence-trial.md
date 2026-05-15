# Secuencia de Email — Trial → Demo → Cliente

*Creado: 2026-05-15*

---

## Arquitectura general

```
[Registro trial]
      │
      ▼
 SECUENCIA A: Onboarding (7 emails / 14 días)
      │
      ├── Si FIRST_LOGIN_AT vacío en D+1 → Email 2a (activación urgente)
      ├── Si FIRST_AUDIT_AT relleno → saltar Email 4, avanzar a demo antes
      └── Si agenda demo → salir de secuencia A, entrar en SECUENCIA B
      
[Trial expira en 3 días] → SECUENCIA C: Expiración (2 emails)
[Trial expirado sin convertir] → SECUENCIA D: Win-back (2 emails)
```

**Plataforma:** Brevo  
**Triggers disponibles en Brevo:** atributos `FIRST_LOGIN_AT`, `FIRST_AUDIT_AT`, `TRIAL_EXPIRES_AT`  
**Lista:** "Leads Landing" (ID 3)  
**Sender name:** Jaime de ServiceControl *(o nombre real del fundador)*  
**Sender email:** hola@servicecontrol.io *(o similar)*

---

## SECUENCIA A — Onboarding del Trial

```
Trigger: Contacto añadido a lista "Leads Landing"
Goal: Que el usuario haga su primera auditoría y agende una demo
Exit: Agenda demo / convierte a cliente de pago
Duración: 14 días, 7 emails
```

---

### Email A1 — Bienvenida + acceso
**Envío:** Inmediato (pero este email ya lo envía Resend — ver nota abajo)*  
**Asunto:** `Tu acceso a ServiceControl está listo, {{NOMBRE}}`  
**Preview:** `Tienes 14 días de acceso completo. Así empiezas.`

> *Nota: El email de bienvenida con credenciales ya se envía vía Resend (`sendTrialWelcomeEmail`). Este email en Brevo puede enviarse 10-15 minutos después como refuerzo contextual, o eliminarse si se considera redundante. Recomendación: mantenerlo pero diferenciarlo — Resend entrega las credenciales, Brevo entrega el contexto.*

**Cuerpo:**
```
Hola {{NOMBRE}},

Tu sandbox de ServiceControl está activo.

Tienes acceso completo durante 14 días: auditorías, acciones correctivas, 
reauditorías, formación y dashboard ejecutivo. Todo con datos de demo para 
que veas cómo funciona desde el primer momento.

Para entrar:
→ [Acceder al sandbox]

Dos cosas que te recomiendo hacer hoy:

1. Abre el dashboard y revisa el estado por áreas
2. Ejecuta una auditoría de prueba (tarda menos de 5 minutos)

Si tienes cualquier pregunta, responde a este email. Lo leo yo directamente.

— Jaime
ServiceControl
```

**CTA:** `Acceder al sandbox` → `{APP_URL}/login`

---

### Email A2 — Primera activación
**Envío:** D+1 (solo si `FIRST_LOGIN_AT` está vacío)  
**Asunto:** `¿Pudiste entrar, {{NOMBRE}}?`  
**Preview:** `A veces el email de acceso se cuela en spam. Te lo confirmo aquí.`

**Cuerpo:**
```
Hola {{NOMBRE}},

Ayer te mandé los accesos a tu sandbox de ServiceControl y quería 
asegurarme de que llegaron bien.

Si no los encuentras, revisa la carpeta de spam — a veces el email 
con las credenciales acaba ahí.

→ [Ver mis credenciales de acceso]

Si ya entraste y tienes alguna duda, responde aquí y te ayudo.

— Jaime
```

**CTA:** `Ver mis credenciales de acceso` → `{APP_URL}/login`

---

### Email A3 — Quick win: el dashboard
**Envío:** D+2  
**Asunto:** `Lo primero que mirar en tu dashboard`  
**Preview:** `El ranking de áreas te dice dónde está el problema en menos de 10 segundos.`

**Cuerpo:**
```
Hola {{NOMBRE}},

Cuando entras al dashboard de ServiceControl, lo primero que ves es 
el ranking de áreas por puntuación.

De un vistazo sabes:
- Qué área está funcionando bien
- Cuál tiene más desviaciones abiertas
- Dónde está el backlog operativo acumulado

No necesitas esperar el reporte de fin de mes. Ni preguntar al equipo.

Si quieres verlo en acción con los datos de demo que tienes ahora mismo:
→ [Abrir el dashboard]

Mañana te cuento cómo funciona el ciclo completo: 
auditoría → acción correctiva → reauditoría.

— Jaime
```

**CTA:** `Abrir el dashboard` → `{APP_URL}/dashboard`

---

### Email A4 — El ciclo completo
**Envío:** D+4 (solo si `FIRST_AUDIT_AT` está vacío)  
**Asunto:** `El problema no es auditar. Es lo que pasa después.`  
**Preview:** `La mayoría de hoteles detectan bien. El fallo está en el seguimiento.`

**Cuerpo:**
```
Hola {{NOMBRE}},

La mayoría de hoteles que nos contactan no tienen un problema de auditorías.

Tienen un problema de seguimiento.

Auditan. Detectan cosas. Las apuntan en un Excel o en un papel. 
Y dos meses después, el mismo problema sigue ahí.

En ServiceControl, cada punto que no pasa en una auditoría genera 
automáticamente una acción correctiva:

- Con un dueño asignado
- Con fecha límite
- Con visibilidad para el manager de área y para dirección

Y cuando se marca como corregida, el sistema puede lanzar 
una reauditoría automática para verificar que se mantuvo.

El ciclo completo: detectar → asignar → corregir → verificar.

Puedes verlo ahora mismo en tu sandbox:
→ [Ejecutar mi primera auditoría]

— Jaime
```

**CTA:** `Ejecutar mi primera auditoría` → `{APP_URL}/audits`

---

### Email A5 — Invitación a demo (primer intento)
**Envío:** D+6  
**Asunto:** `¿Te enseño cómo encajarlo en tu hotel?`  
**Preview:** `El sandbox es genérico. La demo es con tus áreas y tus estándares reales.`

**Cuerpo:**
```
Hola {{NOMBRE}},

El sandbox tiene datos de demo. Es útil para explorar, pero no es 
lo mismo que ver ServiceControl configurado con las áreas reales 
de {{HOTEL}}.

En la demo (30 min, por videollamada) te enseño:

→ Cómo configurar tus áreas y plantillas de auditoría
→ Cómo fluye una desviación desde que se detecta hasta que se cierra
→ Qué ve la dirección en el dashboard en tiempo real

Sin presión de venta. Si no encaja, te lo digo yo primero.

→ [Agendar una demo]

— Jaime
```

**CTA:** `Agendar una demo` → `{APP_URL}/demo`

---

### Email A6 — Manejo de objeción: adopción del equipo
**Envío:** D+9  
**Asunto:** `"El equipo no adoptará otra herramienta"`  
**Preview:** `Es la objeción que más escucho. Y tiene una respuesta concreta.`

**Cuerpo:**
```
Hola {{NOMBRE}},

La objeción que más escucho cuando enseño ServiceControl es esta:

"El equipo no va a adoptar otra herramienta."

Es legítima. He visto cómo muchas implementaciones fallan por esto.

Lo que diferencia a ServiceControl es que el auditor o el manager 
de área no necesita aprender un sistema nuevo para hacer su trabajo.

Entra, ve qué tiene pendiente su área, lo corrige, lo cierra.
Eso es todo.

No hay formularios complejos. No hay pantallas de configuración.
El flujo está diseñado para el campo, no para la oficina.

Si quieres verlo desde la perspectiva del equipo operativo (no solo 
de dirección), en la demo lo repasamos con ese enfoque específico.

→ [Agendar demo]

— Jaime
```

**CTA:** `Agendar demo` → `{APP_URL}/demo`

---

### Email A7 — Último aviso antes de expirar
**Envío:** D+12 (2 días antes de que expire el trial según `TRIAL_EXPIRES_AT`)  
**Asunto:** `Tu acceso a ServiceControl expira en 2 días`  
**Preview:** `Si quieres continuar, hablamos. Si no, sin problema.`

**Cuerpo:**
```
Hola {{NOMBRE}},

Tu sandbox de ServiceControl expira en 2 días.

Si has podido explorar la plataforma y quieres dar el siguiente paso, 
el mejor camino es una llamada de 30 minutos para ver cómo encajaría 
en {{HOTEL}} con tus áreas y estándares reales.

→ [Agendar llamada antes de que expire]

Si no es el momento o no es lo que necesitas, sin problema. 
Puedes responder aquí y te cuento opciones.

— Jaime
```

**CTA:** `Agendar llamada antes de que expire` → `{APP_URL}/demo`

---

## SECUENCIA B — Post-demo (nurturing hacia cierre)

```
Trigger: Usuario agenda demo (manual o via webhook Cal.com)
Goal: Convertir a cliente de pago
Condición: Salir de Secuencia A
```

### Email B1 — Confirmación + preparación
**Envío:** Inmediato tras agendar demo  
**Asunto:** `Demo confirmada — esto es lo que preparo para {{HOTEL}}`  
**Preview:** `Para que la media hora sea útil de verdad, necesito saber una cosa.`

**Cuerpo:**
```
Hola {{NOMBRE}},

Demo confirmada. Nos vemos el [fecha].

Para prepararlo bien, cuéntame en una línea: 
¿cuál es el mayor problema operativo que tienes ahora mismo 
en {{HOTEL}}?

No hace falta que sea elaborado. Con una frase me sirve.

Así enfoco la demo en lo que realmente te importa, no en un 
recorrido genérico de funcionalidades.

— Jaime
```

**CTA:** Responder al email (sin botón)

---

### Email B2 — Follow-up post-demo
**Envío:** D+1 tras la demo  
**Asunto:** `Lo que hablamos ayer + próximos pasos`  
**Preview:** `Resumen de la demo y qué haría falta para arrancar.`

**Cuerpo:**
```
Hola {{NOMBRE}},

Gracias por el tiempo de ayer.

Resumo lo que vimos y los próximos pasos que tienen sentido 
para {{HOTEL}}:

[Personalizar manualmente según la llamada]

Si quieres que prepare una propuesta con el desglose de 
la implementación y el coste anual, dímelo y la tengo lista 
en 24-48h.

→ [Sí, mándame la propuesta]

— Jaime
```

**CTA:** `Sí, mándame la propuesta` → responder email o formulario

---

### Email B3 — Seguimiento si no hay respuesta
**Envío:** D+4 tras la demo (solo si no ha respondido)  
**Asunto:** `¿Sigue siendo una prioridad para {{HOTEL}}?`  
**Preview:** `Sin presión. Solo quiero saber si tiene sentido seguir hablando.`

**Cuerpo:**
```
Hola {{NOMBRE}},

Te mando esto por si el anterior se perdió entre los correos.

¿Sigue siendo una prioridad resolver el seguimiento de calidad 
operativa en {{HOTEL}}?

Si el momento no es ahora, sin problema — lo apunto para más adelante 
y te escribo cuando tenga sentido retomarlo.

Si sí, dime y te preparo la propuesta esta semana.

— Jaime
```

**CTA:** Responder al email

---

## SECUENCIA C — Expiración del trial

```
Trigger: TRIAL_EXPIRES_AT = hoy (o mañana)
Condición: No ha convertido a cliente
```

### Email C1 — Trial expirado
**Envío:** Día de expiración  
**Asunto:** `Tu trial de ServiceControl ha expirado`  
**Preview:** `Si quieres continuar, hay una forma sencilla de hacerlo.`

**Cuerpo:**
```
Hola {{NOMBRE}},

Tu acceso al sandbox de ServiceControl expiró hoy.

Si durante estas dos semanas viste algo que tiene sentido para 
{{HOTEL}}, el siguiente paso es una llamada de 30 minutos 
para configurarlo con tus áreas reales y preparar una propuesta.

→ [Agendar llamada]

Si no es el momento, ningún problema. Puedes escribirme 
cuando quieras retomarlo.

— Jaime
```

**CTA:** `Agendar llamada` → `{APP_URL}/demo`

---

### Email C2 — Win-back a los 7 días
**Envío:** D+7 tras expiración (solo si no ha respondido)  
**Asunto:** `Una pregunta rápida sobre {{HOTEL}}`  
**Preview:** `No es para vender. Es para entender qué no encajó.`

**Cuerpo:**
```
Hola {{NOMBRE}},

Hace una semana expiró tu acceso a ServiceControl y no hemos 
hablado desde entonces.

No te escribo para insistir. Te escribo porque me ayuda entender 
qué no encajó.

¿Fue el momento, el producto, el precio, o algo del sandbox 
que no te convenció?

Una línea me sirve. Y si hay algo que pueda mejorar o aclarar, 
te respondo hoy.

— Jaime
```

**CTA:** Responder al email

---

## Configuración recomendada en Brevo

### Atributos de contacto a usar
| Atributo | Tipo | Descripción |
|---|---|---|
| `NOMBRE` | Texto | Nombre del usuario |
| `HOTEL` | Texto | Nombre del hotel |
| `FUENTE` | Texto | `landing` (hardcoded en el registro) |
| `FIRST_LOGIN_AT` | Fecha | Primer login en el sandbox |
| `FIRST_AUDIT_AT` | Fecha | Primera auditoría completada |
| `TRIAL_EXPIRES_AT` | Fecha | Fecha de expiración del trial |

### Condiciones de salida (exit conditions)
- Contacto responde a cualquier email → mover a seguimiento manual
- Contacto agenda demo → salir de Secuencia A, entrar Secuencia B
- Contacto convierte a cliente → salir de todas las secuencias

### Segmentación futura (cuando haya datos)
- Si `FIRST_AUDIT_AT` relleno en D+2 → usuario activo → adelantar demo invite a D+4
- Si `FIRST_LOGIN_AT` vacío en D+3 → usuario inactivo → considerar parar secuencia

---

## Métricas a seguir

| Métrica | Benchmark referencia | Dónde medir |
|---|---|---|
| Open rate | >40% (B2B nicho) | Brevo |
| Click rate | >5% | Brevo |
| Trial → demo rate | Meta: >15% | Manual / CRM |
| Demo → propuesta | Meta: >50% | Manual |
| Propuesta → cliente | Meta: >30% | Manual |
| Trial → cliente total | Meta: >5% | Manual |

---

## Pendiente de configurar

- [ ] Webhook de Cal.com para marcar contacto como "demo agendada" en Brevo y salir de Secuencia A
- [ ] Definir sender name y email real (¿hola@servicecontrol.io? ¿nombre propio?)
- [ ] Activar Secuencia C con condición sobre `TRIAL_EXPIRES_AT`
- [ ] Decidir si Email A1 de Brevo se envía o se elimina (ya existe el de Resend)