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
  "gifted_free_gift_id",
  "gifted_free_gift_url",
  "gifted_gift_id",
  "gifted_gift_paid",
  "gifted_link_shared",
  "gifted_session_start",
];

export function clearGiftSession() {
  GIFT_KEYS.forEach((k) => localStorage.removeItem(k));
}

/**
 * Keys that represent a *completed* gift (shared or paid).
 * These must be wiped whenever the create page starts a new gift so that
 * the preview page cannot accidentally restore a previous gift's ID.
 */
const COMPLETED_GIFT_KEYS = [
  "gifted_free_gift_id",
  "gifted_free_gift_url",
  "gifted_paid_id",
  "gifted_gift_id",
  "gifted_gift_paid",
  "gifted_link_shared",
];

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

/** Mark that a gift creation session has begun. Call on create page mount. */
export function touchGiftSession() {
  if (!localStorage.getItem("gifted_session_start")) {
    localStorage.setItem("gifted_session_start", String(Date.now()));
  }
}

/**
 * Call at the very start of a new gift creation (create page mount).
 * Clears completed-gift markers from any prior gift so the preview page
 * cannot restore a stale gift ID, while preserving draft form field data.
 */
export function resetCompletedGiftState() {
  COMPLETED_GIFT_KEYS.forEach((k) => localStorage.removeItem(k));
  localStorage.setItem("gifted_session_start", String(Date.now()));
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
