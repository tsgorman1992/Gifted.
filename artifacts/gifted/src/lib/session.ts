const GIFT_KEYS = [
  "gifted_recipient_name",
  "gifted_sender_name",
  "gifted_recipient_phone",
  "gifted_occasion",
  "gifted_gift_title",
  "gifted_personal_note",
  "gifted_playlist_url",
  "gifted_extra_links",
  "gifted_amount",
  "gifted_intent",
  "gifted_scheduled_for",
  "gifted_scheduled_time",
  "gifted_experience",
  "gifted_video_path",
  "gifted_photo_paths",
  "gifted_paid_id",
  "gifted_gift_id",
  "gifted_gift_paid",
  "gifted_session_start",
];

export function clearGiftSession() {
  GIFT_KEYS.forEach((k) => localStorage.removeItem(k));
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/** Mark that a gift creation session has begun. Call on create page mount. */
export function touchGiftSession() {
  if (!localStorage.getItem("gifted_session_start")) {
    localStorage.setItem("gifted_session_start", String(Date.now()));
  }
}

/**
 * Returns true if the stored session is older than SESSION_TTL_MS.
 * Used on the landing page to auto-expire stale drafts.
 */
export function isGiftSessionStale(): boolean {
  const ts = localStorage.getItem("gifted_session_start");
  if (!ts) return false; // no session = nothing to clear
  return Date.now() - parseInt(ts, 10) > SESSION_TTL_MS;
}
