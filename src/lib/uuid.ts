/**
 * Generate a UUID v4-like string with fallback for environments
 * where crypto.randomUUID is not available
 */
export function generateUUID(): string {
  // Try using crypto.randomUUID if available
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // Fall through to fallback
    }
  }

  // Fallback: Generate a UUID v4-like string
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
