import { FORBIDDEN_OBJECT_KEYS } from '../config/constants';
import { ValidationError } from '../errors/app-error';

const MAX_SAFE_DEPTH = 10;

export function isForbiddenKey(key: string): boolean {
  return (FORBIDDEN_OBJECT_KEYS as readonly string[]).includes(key);
}

/**
 * Reject prototype-pollution keys at any depth before schema parsing.
 */
export function assertNoForbiddenKeys(
  value: unknown,
  path = 'body',
  depth = 0,
): void {
  if (depth > MAX_SAFE_DEPTH) {
    throw new ValidationError(`Invalid request: maximum object depth exceeded at ${path}`);
  }

  if (value === null || typeof value !== 'object') {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertNoForbiddenKeys(item, `${path}[${index}]`, depth + 1);
    });
    return;
  }

  const record = value as Record<string, unknown>;

  for (const key of Object.keys(record)) {
    if (isForbiddenKey(key)) {
      throw new ValidationError(`Invalid request: forbidden key "${key}" at ${path}`);
    }

    assertNoForbiddenKeys(record[key], `${path}.${key}`, depth + 1);
  }
}

/**
 * Ensure the request body is a plain object (not array, not null).
 */
export function assertPlainObjectBody(body: unknown): asserts body is Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Invalid request: body must be a JSON object');
  }
}

/**
 * Reject non-plain objects (e.g. Object.create(null) is ok, but Date/Buffer are not).
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
