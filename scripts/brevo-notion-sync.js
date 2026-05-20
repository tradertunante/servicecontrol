const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03',
});

const DS_ID = '3655fd04-0e3b-8085-81da-000b688ef219';
const BREVO_API_KEY = process.env.BREVO_API_KEY;

// Orden de progresión — solo avanzamos, nunca retrocedemos
const ESTADO_RANK = {
  'Identificado':     1,
  'Mensaje enviado':  2,
  'Conectado':        3,
  'Respondió':        4,
  'Demo agendada':    5,
  'Demo realizada':   6,
  'Cerrado':          7,
  'Descartado':       99,
};

function brevoToEstado(contact) {
  const stats  = contact.statistics || {};
  const sent   = stats.messagesSent?.count   ?? 0;
  const opened = stats.messagesOpened?.count ?? 0;
  const clicked = stats.linksClicked?.count  ?? 0;

  if (contact.emailBlacklisted) return 'Descartado';
  if (clicked > 0 || opened > 0) return 'Conectado';
  if (sent > 0)                   return 'Mensaje enviado';
  return null; // sin datos suficientes — no tocar Notion
}

async function getBrevoContact(email) {
  const res = await fetch(
    `https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}?includeStatistics=true`,
    { headers: { accept: 'application/json', 'api-key': BREVO_API_KEY } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getNotionHoteles() {
  const res = await notion.dataSources.query({
    data_source_id: DS_ID,
    page_size: 100,
  });
  return res.results.filter(p => {
    const email = p.properties?.Email?.email;
    return email && email.trim().length > 0;
  });
}

async function updateNotionEstado(pageId, nuevoEstado) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Estado: { select: { name: nuevoEstado } },
    },
  });
}

async function main() {
  if (!BREVO_API_KEY) {
    console.error('❌ Falta BREVO_API_KEY en el entorno');
    process.exit(1);
  }

  const hoteles = await getNotionHoteles();
  console.log(`Hoteles con email en Notion: ${hoteles.length}\n`);

  let actualizados = 0;

  for (const hotel of hoteles) {
    const nombre      = hotel.properties['Nombre hotel']?.title?.[0]?.plain_text ?? '(sin nombre)';
    const email       = hotel.properties.Email.email;
    const estadoActual = hotel.properties.Estado?.select?.name ?? null;

    let brevo;
    try {
      brevo = await getBrevoContact(email);
    } catch (e) {
      console.log(`⚠️  ${nombre} <${email}> — error Brevo: ${e.message}`);
      continue;
    }

    if (!brevo) {
      console.log(`—  ${nombre} <${email}> — no existe en Brevo`);
      continue;
    }

    const nuevoEstado = brevoToEstado(brevo);

    if (!nuevoEstado) {
      console.log(`—  ${nombre} <${email}> — sin actividad en Brevo`);
      continue;
    }

    const rankActual = ESTADO_RANK[estadoActual] ?? 0;
    const rankNuevo  = ESTADO_RANK[nuevoEstado]  ?? 0;

    if (rankNuevo <= rankActual) {
      console.log(`✓  ${nombre} <${email}> — ya en "${estadoActual}", sin cambio`);
      continue;
    }

    await updateNotionEstado(hotel.id, nuevoEstado);
    console.log(`✅ ${nombre} <${email}> — "${estadoActual ?? '—'}" → "${nuevoEstado}"`);
    actualizados++;
  }

  console.log(`\nResumen: ${actualizados} hotel(es) actualizado(s) de ${hoteles.length} con email.`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});