import { z } from 'zod';

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === 'boolean') {
      return value;
    }

    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  });

const positiveInt = z.coerce.number().int().positive();
const nonNegativeInt = z.coerce.number().int().nonnegative();

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: positiveInt.default(3000),
    HOST: z.string().min(1).default('0.0.0.0'),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TRUST_PROXY: booleanFromString.default(false),

    JSON_BODY_LIMIT: z.string().default('1mb'),
    REQUEST_TIMEOUT_MS: positiveInt.default(28000),
    HTTP_KEEP_ALIVE_TIMEOUT_MS: positiveInt.default(65_000),
    HTTP_HEADERS_TIMEOUT_MS: positiveInt.default(66_000),
    CORS_ENABLED: booleanFromString.default(true),
    CORS_ORIGIN: z.string().default('*'),
    RATE_LIMIT_ENABLED: booleanFromString.default(true),
    RATE_LIMIT_WINDOW_MS: positiveInt.default(60_000),
    RATE_LIMIT_MAX_REQUESTS: positiveInt.default(600),
    COMPRESSION_ENABLED: booleanFromString.default(true),

    GROQ_API_KEY: z.string().optional(),
    GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
    GROQ_BASE_URL: z
      .string()
      .url()
      .default('https://api.groq.com')
      .transform((url) => url.replace(/\/openai\/v1\/?$/, '')),
    GROQ_EXTRACTION_TIMEOUT_MS: positiveInt.default(8000),
    GROQ_PROSE_TIMEOUT_MS: positiveInt.default(12000),
    GROQ_PROSE_MAX_TOKENS: positiveInt.default(512),
    GROQ_MAX_RETRIES: nonNegativeInt.default(1),
    GROQ_RETRY_DELAY_MS: nonNegativeInt.default(500),

    SAFETY_STRICT_MODE: booleanFromString.default(true),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.GROQ_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'GROQ_API_KEY is required when NODE_ENV is production',
        path: ['GROQ_API_KEY'],
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return result.data;
}
