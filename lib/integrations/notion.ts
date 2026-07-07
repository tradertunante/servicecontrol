import "server-only";

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PIPELINE_DB_ID = process.env.NOTION_PIPELINE_ID;

export async function addDemoLeadToNotion(
  email: string,
  contactName: string,
  startTime: string,
  notes?: string
): Promise<void> {
  if (!NOTION_TOKEN) return;

  const meetingDate = new Date(startTime);
  const fechaISO = meetingDate.toISOString().split("T")[0];
  const fechaHora = meetingDate.toLocaleString("es-ES", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid",
  });

  const notasText = [
    `Demo agendada vía web — ${fechaHora}`,
    notes?.trim() ? `Notas: ${notes.trim()}` : "",
  ].filter(Boolean).join("\n");

  try {
    await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: PIPELINE_DB_ID },
        properties: {
          "Nombre hotel": {
            title: [{ text: { content: email } }],
          },
          Email: { email },
          Contacto: {
            rich_text: [{ text: { content: contactName } }],
          },
          Estado: { select: { name: "Demo agendada" } },
          "Fecha contacto": {
            date: { start: fechaISO },
          },
          Notas: {
            rich_text: [{ text: { content: notasText } }],
          },
        },
      }),
    });
  } catch {
    // Notion no es crítico
  }
}

export async function addTrialLeadToNotion(
  email: string,
  hotelName: string
): Promise<void> {
  if (!NOTION_TOKEN) return;

  try {
    await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
      },
      body: JSON.stringify({
        parent: { database_id: PIPELINE_DB_ID },
        properties: {
          "Nombre hotel": {
            title: [{ text: { content: hotelName } }],
          },
          Email: { email },
          Estado: { select: { name: "Identificado" } },
          "Fecha contacto": {
            date: { start: new Date().toISOString().split("T")[0] },
          },
          Notas: {
            rich_text: [{ text: { content: "Lead sandbox" } }],
          },
        },
      }),
    });
  } catch {
    // Notion no es crítico — el registro continúa aunque falle
  }
}