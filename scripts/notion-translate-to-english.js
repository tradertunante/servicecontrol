const Anthropic = require('@anthropic-ai/sdk');
const { Client } = require('@notionhq/client');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

const notion = new Client({ auth: NOTION_TOKEN });
const anthropic = new Anthropic();

async function getAllPages() {
  const pages = [];
  let cursor;

  do {
    const res = await notion.search({
      page_size: 100,
      start_cursor: cursor,
    });

    const dbPages = res.results.filter(
      p => p.object === 'page' && p.parent?.database_id?.replace(/-/g, '') === DATABASE_ID.replace(/-/g, '')
    );
    pages.push(...dbPages);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return pages;
}

function extractText(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title.map(t => t.plain_text).join('');
  if (prop.type === 'rich_text') return prop.rich_text.map(t => t.plain_text).join('');
  return '';
}

async function rewriteInEnglish(titulo, copy) {
  if (!titulo.trim() && !copy.trim()) return { titulo, copy };

  const prompt = `You are a senior B2B copywriter for a hospitality tech SaaS startup.

The product is ServiceControl — an operational auditing platform for hotels. It replaces paper checklists and Excel with digital audit templates, mobile execution, corrective action tracking, and automated reports.

Target audience: General Managers, Operations Directors, and Quality Directors at hotels (3-5 star, independent and small chains).

You will receive a LinkedIn post written in Spanish. Do NOT translate it literally. Instead, rewrite it from scratch in English — keeping the same core message and format (hook, problem, solution, CTA) but making it feel native, punchy, and compelling to an English-speaking hospitality professional.

Rules:
- Hook must be strong (≤10 words), curiosity-driven or pain-driven
- Tone: direct, founder voice, no buzzwords, no corporate speak
- Structure: hook → problem → consequence → solution → CTA
- CTA: ask for a 20-min demo (DM or comment)
- 3–5 relevant English hashtags at the end
- Max 4–5 text icons (→, ✓, etc.), no excessive emojis
- 200–300 words

ORIGINAL TITLE: ${titulo}

ORIGINAL COPY:
${copy}

Return a JSON object with exactly two keys: "titulo" (the new English title) and "copy" (the full rewritten post). No extra text.`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text.trim();
  const json = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(json);
}

async function updatePage(pageId, titulo, copy) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      Nombre: { title: [{ text: { content: titulo } }] },
      COPY: { rich_text: [{ text: { content: copy } }] },
    },
  });
}

async function main() {
  console.log('Fetching posts from Notion...\n');
  const pages = await getAllPages();
  console.log(`Found ${pages.length} posts.\n`);

  for (const page of pages) {
    const titulo = extractText(page.properties.Nombre);
    const copy = extractText(page.properties.COPY);

    console.log(`Processing: "${titulo}"`);

    if (!titulo.trim() && !copy.trim()) {
      console.log('  ⏭  Skipped (empty)\n');
      continue;
    }

    try {
      const rewritten = await rewriteInEnglish(titulo, copy);
      await updatePage(page.id, rewritten.titulo, rewritten.copy);
      console.log(`  ✅ Rewritten → "${rewritten.titulo}"\n`);
    } catch (err) {
      console.error(`  ❌ Error: ${err.message}\n`);
    }
  }

  console.log('Done.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});