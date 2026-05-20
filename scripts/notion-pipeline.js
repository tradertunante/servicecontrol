const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03'
});

const DATABASE_ID = process.env.NOTION_PIPELINE_ID;

async function insertarHotel({ nombre, pais, categoria, contacto, cargo, estado, fechaContacto, notas }) {
  const response = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties: {
      'Nombre hotel': {
        title: [{ text: { content: nombre } }]
      },
      País: {
        select: { name: pais }
      },
      Categoría: {
        select: { name: categoria }
      },
      Contacto: {
        rich_text: [{ text: { content: contacto } }]
      },
      Cargo: {
        rich_text: [{ text: { content: cargo } }]
      },
      Estado: {
        select: { name: estado }
      },
      'Fecha contacto': {
        date: { start: fechaContacto }
      },
      Notas: {
        rich_text: [{ text: { content: notas } }]
      }
    }
  });
  return response.url;
}

async function main() {
  if (!process.env.NOTION_TOKEN) {
    console.error('❌ Falta NOTION_TOKEN en el entorno');
    process.exit(1);
  }
  if (!DATABASE_ID) {
    console.error('❌ Falta NOTION_PIPELINE_ID en el entorno');
    process.exit(1);
  }

  const hotel = {
    nombre: 'Hotel Arts Barcelona',
    pais: 'España',
    categoria: '5 estrellas',
    contacto: 'Por identificar',
    cargo: 'Director de Operaciones',
    estado: 'Identificado',
    fechaContacto: new Date().toISOString().split('T')[0],
    notas: 'Hotel de lujo en Barcelona, cadena Ritz-Carlton'
  };

  console.log(`Insertando "${hotel.nombre}" en Notion...`);
  const url = await insertarHotel(hotel);
  console.log('✅ Hotel creado:', url);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  if (err.body) console.error('   Detalle:', JSON.stringify(err.body, null, 2));
  process.exit(1);
});