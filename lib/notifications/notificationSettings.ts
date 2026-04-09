import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type NotificationType =
  | "new_user_email"
  | "quality_audit_submitted_email";

type NotificationSettings = {
  new_user_email_enabled: boolean;
  quality_audit_submitted_email_enabled: boolean;
};

const DEFAULTS: NotificationSettings = {
  new_user_email_enabled: true,
  quality_audit_submitted_email_enabled: true,
};

// Returns current settings; falls back to defaults if no row exists yet.
export async function getHotelNotificationSettings(
  hotelId: string
): Promise<NotificationSettings> {
  const { data } = await supabaseAdmin()
    .from("hotel_notification_settings")
    .select("new_user_email_enabled, quality_audit_submitted_email_enabled")
    .eq("hotel_id", hotelId)
    .maybeSingle();

  if (!data) return { ...DEFAULTS };

  return {
    new_user_email_enabled: data.new_user_email_enabled ?? DEFAULTS.new_user_email_enabled,
    quality_audit_submitted_email_enabled:
      data.quality_audit_submitted_email_enabled ??
      DEFAULTS.quality_audit_submitted_email_enabled,
  };
}

// Creates or updates settings for a hotel.
export async function upsertHotelNotificationSettings(
  hotelId: string,
  payload: Partial<NotificationSettings>
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("hotel_notification_settings")
    .upsert({ hotel_id: hotelId, ...payload }, { onConflict: "hotel_id" });

  if (error) throw error;
}

// Convenience helper: returns true if the notification type is enabled.
// Defaults to true if no settings row exists (safe: existing behaviour preserved).
export async function shouldSendNotification(
  hotelId: string,
  type: NotificationType
): Promise<boolean> {
  const settings = await getHotelNotificationSettings(hotelId);
  if (type === "new_user_email") return settings.new_user_email_enabled;
  if (type === "quality_audit_submitted_email") return settings.quality_audit_submitted_email_enabled;
  return true;
}
