import "server-only";

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const TRIAL_LEADS_LIST_ID = 3; // Lista "Leads Landing" en Brevo

type BrevoContactAttributes = {
  NOMBRE?: string;
  HOTEL?: string;
  FUENTE?: string;
  FIRST_LOGIN_AT?: string;
  FIRST_AUDIT_AT?: string;
  TRIAL_EXPIRES_AT?: string;
};

export async function updateBrevoContact(
  email: string,
  attributes: Omit<BrevoContactAttributes, "NOMBRE" | "HOTEL" | "FUENTE">
): Promise<void> {
  if (!BREVO_API_KEY) return;
  try {
    await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: "PATCH",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": BREVO_API_KEY,
      },
      body: JSON.stringify({ attributes }),
    });
  } catch {
    // Brevo no es crítico
  }
}

export async function addTrialLeadToBrevo(
  email: string,
  name: string,
  hotelName: string,
  trialExpiresAt?: string,
): Promise<void> {
  if (!BREVO_API_KEY) return;

  const attributes: BrevoContactAttributes = { FUENTE: "landing" };
  if (name) attributes.NOMBRE = name;
  if (hotelName) attributes.HOTEL = hotelName;
  if (trialExpiresAt) attributes.TRIAL_EXPIRES_AT = trialExpiresAt;

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