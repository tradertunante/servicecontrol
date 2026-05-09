import "server-only";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const TRIAL_LEADS_LIST_ID = 3; // Lista "Leads Landing" en Brevo

type BrevoContactAttributes = {
  NOMBRE?: string;
  HOTEL?: string;
};

export async function addTrialLeadToBrevo(
  email: string,
  name: string,
  hotelName: string
): Promise<void> {
  if (!BREVO_API_KEY) return;

  const attributes: BrevoContactAttributes = {};
  if (name) attributes.NOMBRE = name;
  if (hotelName) attributes.HOTEL = hotelName;

  try {
    await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({
        email,
        attributes,
        listIds: [TRIAL_LEADS_LIST_ID],
        updateEnabled: true,
      }),
    });
  } catch {
    // Brevo no es crítico — el registro continúa aunque falle
  }
}