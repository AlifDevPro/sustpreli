/**
 * Validate ISO 8601 UTC timestamps as required by the hackathon contract.
 * Accepts second precision with Z suffix, e.g. 2026-04-14T14:08:22Z
 */
const ISO_8601_UTC_REGEX =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

export function isValidIso8601UtcTimestamp(value: string): boolean {
  if (!ISO_8601_UTC_REGEX.test(value)) {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

export function parseIso8601UtcTimestamp(value: string): Date | null {
  if (!isValidIso8601UtcTimestamp(value)) {
    return null;
  }

  return new Date(value);
}
