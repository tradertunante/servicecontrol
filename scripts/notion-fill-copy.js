const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03'
});
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const POSTS = [
  {
    titulo: 'Post 1 — Hook problema auditorías',
    copy: `¿Cuántas acciones correctivas de tu última auditoría siguen sin cerrarse?

No es una pregunta retórica.

La mayoría de hoteles que auditamos tienen el mismo patrón:

→ El auditor recorre el hotel con papel, Excel o fotos en WhatsApp
→ Se redacta un informe que tarda horas
→ Las tareas se asignan verbalmente o por mensaje
→ En la siguiente auditoría... aparecen los mismos problemas

No es falta de rigor. Es falta de sistema.

Por eso construimos ServiceControl. Una plataforma de auditorías operativas diseñada específicamente para hoteles:

✓ Templates por área: habitaciones, restaurante, mantenimiento, recepción...
✓ El auditor ejecuta la ronda desde el móvil, con fotos y evidencias
✓ Acciones correctivas asignadas, notificadas y cerradas con trazabilidad
✓ Reportes automáticos para dirección, sin trabajo manual
✓ Histórico por área para detectar patrones reales

Si gestionas operaciones o calidad en un hotel y quieres ver cómo funciona, puedo darte una demo de 20 minutos esta semana.

Escríbeme por aquí o deja un comentario y te contacto.

#HotelOperations #CalidadHotelera #Hospitalidad #HotelManagement #Auditorías`
  },
  {
    titulo: 'Post 2 — Hook contrarian riesgo hotel',
    copy: `El mayor riesgo operativo de tu hotel no es la competencia.

Es el Excel de auditorías que nadie actualiza.

Las cadenas hoteleras que mejor controlan la experiencia del huésped no tienen auditores más rigurosos.

Tienen mejores sistemas.

Cuando una incidencia queda registrada, asignada y con fecha de cierre, desaparece. Cuando vive en un Word o en WhatsApp, reaparece en cada auditoría.

Llevamos meses trabajando con hoteles para digitalizar este proceso con ServiceControl: templates por área, ejecución desde móvil, seguimiento de correctivas y reportes automáticos.

Si eres GM, Director de Operaciones o de Calidad y quieres ver cómo lo están haciendo otros hoteles, escríbeme.

20 minutos. Sin compromiso.

#HotelOperations #CalidadHotelera #Hospitalidad #Auditorías`
  },
  {
    titulo: 'Post 3 — Cómo digitalizan auditorías los mejores hoteles',
    copy: `Cómo digitalizan sus auditorías los hoteles que mejor gestionan la calidad.

No es magia. Es proceso.

Los hoteles con operaciones más controladas hacen lo mismo:

1. Definen templates por área
Cada área tiene su checklist estándar: habitaciones, restaurante, recepción, mantenimiento. No improvisan qué revisar cada vez.

2. Ejecutan desde el móvil
El auditor lleva el teléfono, no un papel. Foto de la incidencia, descripción, área afectada. Todo queda registrado en tiempo real.

3. Asignan correctivas al momento
Cuando se detecta un problema, se asigna responsable y plazo antes de salir de la planta. No en el informe de la tarde.

4. Generan reportes automáticos
La dirección recibe un resumen sin que nadie tenga que redactarlo. El tiempo que se ahorra en informes se reinvierte en resolver problemas reales.

5. Hacen seguimiento histórico
¿Esta área falla siempre en el mismo punto? El histórico lo muestra. Puedes anticiparte antes de que llegue una inspección o una queja.

Esto es lo que estamos construyendo con ServiceControl.

Si gestionas calidad u operaciones en un hotel, me encantaría mostrártelo. 20 minutos de demo.

Escríbeme por aquí.

#HotelOperations #CalidadHotelera #GestiónHotelera #Auditorías`
  },
  {
    titulo: 'Post 4 — Lo que cambia cuando dejas el Excel',
    copy: `Lo que cambia en un hotel cuando dejas de gestionar auditorías en Excel.

Antes:
→ El auditor imprime el checklist, lo rellena a mano
→ Al final del día pasa los datos al Excel
→ Alguien redacta el informe (2-3 horas)
→ Las correctivas se comunican por email o WhatsApp
→ En la siguiente auditoría nadie recuerda qué quedó pendiente

Después:
→ El auditor ejecuta la ronda desde el móvil
→ Las incidencias quedan registradas con foto en tiempo real
→ El informe se genera automáticamente
→ Las correctivas se asignan con responsable y plazo
→ En la siguiente auditoría el sistema muestra qué se cerró y qué no

El trabajo es el mismo. El sistema es diferente.

La diferencia real no está en el tiempo que se ahorra (que es mucho). Está en que los problemas dejan de repetirse.

Estamos en pre-lanzamiento de ServiceControl y buscamos hoteles que quieran ser de los primeros en probarlo.

Si te interesa una demo de 20 minutos, escríbeme.

#HotelOperations #CalidadHotelera #Hospitalidad #GestiónHotelera`
  },
  {
    titulo: 'Post 5 — 3 señales de que tu sistema falla',
    copy: `3 señales de que el sistema de auditorías de tu hotel está fallando.

No hablo de los resultados de la auditoría. Hablo del sistema en sí.

Señal 1: Las mismas incidencias aparecen auditoría tras auditoría
Si el mismo problema lleva tres trimestres en el informe, no es un problema de operaciones. Es un problema de seguimiento. Las correctivas no se están cerrando de verdad.

Señal 2: El informe tarda más en escribirse que la auditoría en ejecutarse
Si tu equipo dedica 2-3 horas a redactar lo que tardó 1 hora en revisar, el proceso está invertido. El valor está en detectar y resolver, no en documentar.

Señal 3: Nadie sabe exactamente qué quedó pendiente de la última ronda
Si tienes que preguntar "¿cerramos lo de mantenimiento de la tercera planta?" en cada reunión, las correctivas no tienen propietario real ni plazo.

Estas tres señales tienen el mismo origen: el sistema depende de personas recordando cosas en lugar de herramientas gestionando el proceso.

Por eso construimos ServiceControl.

¿Reconoces alguna de estas señales en tu hotel? Escríbeme y hablamos.

#HotelOperations #CalidadHotelera #GestiónHotelera #Auditorías #Hospitalidad`
  },
  {
    titulo: 'Post 6 — ¿Cuánto tiempo pierdes en reportes?',
    copy: `¿Cuánto tiempo dedica tu equipo cada mes a escribir informes de auditoría?

Cuenta todo:
→ Pasar las notas del papel al Excel
→ Revisar las fotos del móvil y organizarlas
→ Redactar el informe para dirección
→ Preparar el resumen de correctivas pendientes
→ Actualizar el seguimiento de la semana anterior

En la mayoría de hoteles con los que hemos hablado, son entre 6 y 12 horas al mes por auditor.

No es tiempo de auditoría. Es tiempo de administración.

El problema no es la dedicación del equipo. Es que el sistema obliga a documentar manualmente lo que debería registrarse solo.

Con ServiceControl, el informe se genera automáticamente cuando termina la ronda. El auditor ejecuta. El sistema documenta.

Las horas que se recuperan se reinvierten en hacer más rondas, cerrar más correctivas, o simplemente en trabajar menos fines de semana.

Si quieres ver cómo funciona en la práctica, puedo darte una demo de 20 minutos esta semana.

Escríbeme por aquí.

#HotelOperations #CalidadHotelera #Hospitalidad #HotelManagement`
  },
  {
    titulo: 'Post 7 — De papel al reporte automático',
    copy: `De papel y boli a reporte automático. Así es el proceso de auditoría en un hotel con ServiceControl.

Lunes. 9:00h. El auditor arranca la ronda de habitaciones.

Antes:
Lleva un folio impreso. Anota a mano. Si hay una incidencia, hace una foto con el móvil y la manda al grupo de WhatsApp. Al mediodía pasa todo al Excel. A las 17h envía el informe a dirección. Dirección lo lee el martes.

Con ServiceControl:
El auditor abre la app. Selecciona área: habitaciones, planta 3. Ejecuta el checklist. Detecta incidencia en baño 312: foto, descripción, asigna a mantenimiento, plazo 24h.

Termina la ronda a las 11h. El informe ya está generado. Dirección recibe notificación a las 11:15h.

Mantenimiento recibe la correctiva en su panel. La cierra con evidencia fotográfica antes de las 14h.

En la próxima auditoría, el sistema ya muestra si se resolvió.

Mismo trabajo. Sistema diferente.

Si quieres verlo en 20 minutos, escríbeme.

#HotelOperations #CalidadHotelera #Hospitalidad #Auditorías`
  },
  {
    titulo: 'Post 8 — Buscamos 3 hoteles para demo gratuita',
    copy: `Buscamos 3 hoteles para hacer una demo gratuita de ServiceControl.

No una demo genérica. Una sesión de 20 minutos configurada con vuestras áreas, vuestros checklists y vuestro flujo real.

¿Por qué solo 3?
Porque queremos tomarnos el tiempo de entender bien cada operación antes de la sesión. No es un formulario de contacto. Es una conversación real.

¿Para qué tipo de hotel?
→ Entre 50 y 500 habitaciones
→ Con equipo de operaciones o calidad activo
→ Que haga auditorías internas de forma regular (aunque sea en papel o Excel)

¿Qué veis en la demo?
✓ Cómo se configuran los templates por área
✓ Cómo ejecuta el auditor la ronda desde móvil
✓ Cómo se gestionan las correctivas con trazabilidad
✓ Cómo se genera el reporte automático para dirección

Sin compromiso. Sin pitch de ventas. Solo 20 minutos para ver si tiene sentido para vosotros.

Si te interesa, escríbeme por aquí o deja un comentario con tu email y te contacto esta semana.

#HotelOperations #CalidadHotelera #Hospitalidad #HotelManagement #Demo`
  }
];

const PAGE_IDS = [
  '3655fd040e3b81cf8d2cd833631d04df',
  '3655fd040e3b81dda72df17921f51286',
  '3655fd040e3b8175933afc934862b99e',
  '3655fd040e3b81398fa5e94b6d824442',
  '3655fd040e3b816790c7c31ec89c429b',
  '3655fd040e3b81e1a8d1e5a077549d9c',
  '3655fd040e3b8146833dca5aaca86ba4',
  '3655fd040e3b8173a33ec3858f19802a',
];

async function main() {
  for (let i = 0; i < POSTS.length; i++) {
    const post = POSTS[i];
    const pageId = PAGE_IDS[i];

    await notion.pages.update({
      page_id: pageId,
      properties: {
        COPY: {
          rich_text: [{ text: { content: post.copy.slice(0, 2000) } }]
        }
      }
    });
    console.log(`✅ ${post.titulo}`);
  }

  console.log('\nListo.');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});