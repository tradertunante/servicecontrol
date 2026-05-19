const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require('@notionhq/client');

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2025-09-03'
});
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

async function generarPost() {
  const client = new Anthropic();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Eres un experto en marketing B2B para SaaS hotelero.

Genera un post de LinkedIn en español para ServiceControl, una plataforma SaaS de auditorías operativas para hoteles (pre-lanzamiento). El objetivo es conseguir que General Managers, Directores de Operaciones y Directores de Calidad de hoteles pidan una demo de 20 minutos.

Requisitos del post:
- Hook fuerte en la primera línea (máximo 10 palabras) que genere curiosidad o identifique un dolor real
- Estructura B2B clara: problema → consecuencia → solución → prueba social implícita → CTA
- Mencionar funcionalidades clave: templates por área, ejecución desde móvil, seguimiento de correctivas, reportes automáticos
- CTA claro pidiendo una demo de 20 minutos (escribir por DM o comentar)
- 3-5 hashtags relevantes al final
- Tono directo, sin jerga de startup, como si lo escribiera el fundador
- Sin emojis excesivos, máximo 4-5 iconos de texto (→, ✓, etc.)
- Entre 200 y 300 palabras

Devuelve SOLO el texto del post, sin explicaciones ni metadatos.`
      }
    ]
  });

  return message.content[0].text.trim();
}

async function crearPost({ titulo, estado, formato, fecha, copy, notas }) {
  const response = await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties: {
      Nombre: {
        title: [{ text: { content: titulo } }]
      },
      ESTADO: {
        select: { name: estado || 'Borrador' }
      },
      FORMATO: {
        select: { name: formato || 'Hook problema' }
      },
      FECHA: {
        date: { start: fecha || new Date().toISOString().split('T')[0] }
      },
      COPY: {
        rich_text: [{ text: { content: copy } }]
      },
      NOTA: {
        rich_text: [{ text: { content: notas || '' } }]
      }
    }
  });
  return response.url;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      result[key] = args[i + 1];
      i++;
    }
  }
  return result;
}

const SEED_POSTS = [
  { titulo: 'Post 1 — Hook problema auditorías',                  fecha: '2026-06-02', formato: 'Hook problema',  estado: 'Aprobado' },
  { titulo: 'Post 2 — Hook contrarian riesgo hotel',              fecha: '2026-06-05', formato: 'Hook contrarian', estado: 'Aprobado' },
  { titulo: 'Post 3 — Cómo digitalizan auditorías los mejores hoteles', fecha: '2026-06-09', formato: 'Educativo',      estado: 'Borrador' },
  { titulo: 'Post 4 — Lo que cambia cuando dejas el Excel',       fecha: '2026-06-12', formato: 'Caso de uso',    estado: 'Borrador' },
  { titulo: 'Post 5 — 3 señales de que tu sistema falla',         fecha: '2026-06-16', formato: 'Educativo',      estado: 'Borrador' },
  { titulo: 'Post 6 — ¿Cuánto tiempo pierdes en reportes?',       fecha: '2026-06-19', formato: 'Hook problema',  estado: 'Borrador' },
  { titulo: 'Post 7 — De papel al reporte automático',            fecha: '2026-06-23', formato: 'Caso de uso',    estado: 'Borrador' },
  { titulo: 'Post 8 — Buscamos 3 hoteles para demo gratuita',     fecha: '2026-06-26', formato: 'Hook problema',  estado: 'Borrador' },
];

async function main() {
  const args = parseArgs();

  if ('seed' in args) {
    console.log(`Creando ${SEED_POSTS.length} entradas en Notion...\n`);
    for (const post of SEED_POSTS) {
      const url = await crearPost({ ...post, copy: '', notas: '' });
      console.log(`✅ ${post.titulo}\n   ${url}\n`);
    }

  } else if ('generar' in args) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('❌ Falta ANTHROPIC_API_KEY en el entorno');
      process.exit(1);
    }

    console.log('🤖 Generando post con Claude...\n');
    const copy = await generarPost();

    const titulo = copy.split('\n')[0].replace(/^[^a-zA-ZáéíóúÁÉÍÓÚ¿¡]+/, '').trim().slice(0, 100);
    const fecha = new Date().toISOString().split('T')[0];

    console.log('─'.repeat(60));
    console.log(copy);
    console.log('─'.repeat(60));
    console.log();

    const url = await crearPost({ titulo, copy, estado: 'Borrador', formato: 'Hook problema', fecha });
    console.log('✅ Post guardado en Notion:', url);

  } else {
    if (!args.titulo || !args.copy) {
      console.error('❌ Uso:');
      console.error('  Generar con IA:  ANTHROPIC_API_KEY=... node scripts/notion-post.js --generar');
      console.error('  Manual:          node scripts/notion-post.js --titulo "..." --copy "..." [--estado "..."] [--formato "..."] [--fecha "YYYY-MM-DD"] [--notas "..."]');
      process.exit(1);
    }

    const url = await crearPost({
      titulo: args.titulo,
      copy: args.copy,
      estado: args.estado,
      formato: args.formato,
      fecha: args.fecha,
      notas: args.notas,
    });
    console.log('✅ Post creado:', url);
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});