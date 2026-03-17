import "server-only";

import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

import {
  authorizeRouteRequest,
  getAllowedAreaIdsForProfile,
  resolveRouteHotelScope,
} from "@/lib/auth/server";
import type { Role } from "@/lib/auth/permissions";
import type { Profile } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type TrainingRole = Extract<Role, "admin" | "quality" | "manager" | "general_manager">;

type SignedRegistrationPayload = {
  sessionId: string;
  topicId: string;
  hotelId: string;
  nonce: string;
  exp: number;
};

function getTrainingRegistrationSecret() {
  const secret =
    process.env.TRAINING_REGISTRATION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  if (!secret.trim()) {
    throw new Error("Missing TRAINING_REGISTRATION_SECRET.");
  }

  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", getTrainingRegistrationSecret())
    .update(payload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createTrainingRegistrationToken(
  sessionId: string,
  topicId: string,
  hotelId: string,
  nonce: string,
  ttlSeconds = 900
) {
  const payload: SignedRegistrationPayload = {
    sessionId,
    topicId,
    hotelId,
    nonce,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyTrainingRegistrationToken(
  token: string,
  expected: { sessionId: string; topicId: string; hotelId: string }
) {
  const [encodedPayload, providedSignature] = String(token ?? "").trim().split(".");
  if (!encodedPayload || !providedSignature) {
    return { ok: false as const, error: "registration_token inválido.", status: 400 };
  }

  const expectedSignature = signPayload(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return { ok: false as const, error: "registration_token inválido.", status: 403 };
  }

  let payload: SignedRegistrationPayload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload)) as SignedRegistrationPayload;
  } catch {
    return { ok: false as const, error: "registration_token inválido.", status: 400 };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    return { ok: false as const, error: "registration_token expirado.", status: 403 };
  }

  if (
    payload.sessionId !== expected.sessionId ||
    payload.topicId !== expected.topicId ||
    payload.hotelId !== expected.hotelId
  ) {
    return { ok: false as const, error: "registration_token fuera de scope.", status: 403 };
  }

  return { ok: true as const, payload };
}

function hashRegistrationNonce(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}

export async function issueTrainingRegistrationToken(
  sessionId: string,
  topicId: string,
  hotelId: string,
  ttlSeconds = 900
) {
  const nonce = randomUUID();
  const token = createTrainingRegistrationToken(sessionId, topicId, hotelId, nonce, ttlSeconds);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const { error } = await supabaseAdmin().from("training_registration_tokens").insert({
    hotel_id: hotelId,
    topic_id: topicId,
    session_id: sessionId,
    token_nonce_hash: hashRegistrationNonce(nonce),
    expires_at: expiresAt,
  });

  if (error) throw error;
  return token;
}

export async function consumeTrainingRegistrationToken(
  token: string,
  expected: { sessionId: string; topicId: string; hotelId: string }
) {
  const verification = verifyTrainingRegistrationToken(token, expected);
  if (!verification.ok) return verification;

  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin()
    .from("training_registration_tokens")
    .update({ used_at: nowIso })
    .eq("session_id", expected.sessionId)
    .eq("topic_id", expected.topicId)
    .eq("hotel_id", expected.hotelId)
    .eq("token_nonce_hash", hashRegistrationNonce(verification.payload.nonce))
    .is("used_at", null)
    .gt("expires_at", nowIso)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false as const, error: error.message, status: 500 };
  }

  if (!data?.id) {
    return {
      ok: false as const,
      error: "registration_token invalido, expirado o ya consumido.",
      status: 403,
    };
  }

  return { ok: true as const };
}

export async function getTrainingsCaller(
  request: NextRequest,
  allowedRoles: readonly TrainingRole[]
) {
  const caller = await authorizeRouteRequest(request, { roles: allowedRoles });
  if (!caller) {
    return { ok: false as const, error: "No autorizado.", status: 401 };
  }

  const hotelResult = resolveRouteHotelScope(caller.profile, null);
  if (!hotelResult.ok) {
    return hotelResult;
  }

  return {
    ok: true as const,
    caller: {
      profile: caller.profile,
      hotelId: hotelResult.hotelId,
    },
  };
}

export async function getTrainingsVisibleAreaIds(profile: Profile, hotelId: string) {
  if (profile.role !== "manager") {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("areas")
      .select("id")
      .eq("hotel_id", hotelId)
      .eq("active", true);

    if (error) throw error;
    return (data ?? []).map((row) => String(row.id));
  }

  return getAllowedAreaIdsForProfile(profile, hotelId);
}

export async function loadTrainingTopic(topicId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("training_topics")
    .select("id, hotel_id, area_id, title, description, qr_token, is_active, created_at")
    .eq("id", topicId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function loadTrainingSession(sessionId: string) {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("training_sessions")
    .select("id, hotel_id, topic_id, status, opened_at, closed_at, supervisor_name_snapshot, session_label")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

export async function enforceTrainingAreaScope(
  profile: Profile,
  hotelId: string,
  areaId: string | null
) {
  if (!areaId) {
    return {
      ok: false as const,
      error: "El training no tiene area_id válido.",
      status: 400,
    };
  }

  if (profile.role !== "manager") {
    return { ok: true as const };
  }

  const allowedAreaIds = await getTrainingsVisibleAreaIds(profile, hotelId);
  if (!allowedAreaIds.includes(areaId)) {
    return { ok: false as const, error: "Forbidden: area fuera de alcance.", status: 403 };
  }

  return { ok: true as const };
}
