/**
 * Normalize user-provided text for consistent validation and downstream processing.
 */
export function normalizeUnicode(value: string): string {
  return value.normalize('NFKC');
}

/**
 * Trim edges and collapse internal runs of whitespace to a single space.
 */
export function normalizeWhitespace(value: string): string {
  return normalizeUnicode(value).trim().replace(/\s+/g, ' ');
}

/**
 * Normalize identifier-like fields: unicode + trim only (preserve internal structure).
 */
export function normalizeIdentifier(value: string): string {
  return normalizeUnicode(value).trim();
}

/**
 * Normalize free-text complaint: unicode, trim, collapse whitespace.
 */
export function normalizeComplaint(value: string): string {
  return normalizeWhitespace(value);
}
