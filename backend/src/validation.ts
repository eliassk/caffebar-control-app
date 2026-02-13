/**
 * Shared input validation helpers for the Coffee API.
 *
 * Centralises format checks so they can be reused across routes,
 * scenes, and any future endpoint.
 */

/** Matches valid Home Assistant entity IDs: `domain.object_id` (lowercase + digits + underscores). */
const ENTITY_ID_RE = /^[a-z_]+\.[a-z0-9_]+$/;

/** Matches strict CSS hex colours: #abc or #aabbcc (case-insensitive). */
const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Validate that a string looks like a valid HA entity_id. */
export function isValidEntityId(value: unknown): value is string {
  return typeof value === "string" && ENTITY_ID_RE.test(value);
}

/**
 * Sanitise a scene colour value.
 * Returns the colour if it's a valid hex string, otherwise `undefined`.
 */
export function sanitizeColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return HEX_COLOR_RE.test(value.trim()) ? value.trim() : undefined;
}
