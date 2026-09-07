import 'server-only'
import { z } from 'zod'

// Validated once at boot. A missing or short secret fails loudly with the field name instead of
// letting the app run with a weak passcode (spec §10.1, §10.2).
const schema = z.object({
  APP_PASSCODE: z.string().min(8, 'APP_PASSCODE must be at least 8 characters'),
  SESSION_SECRET: z
    .string()
    .min(32, 'SESSION_SECRET must be at least 32 characters (openssl rand -base64 32)'),
  DATABASE_URL: z.string().optional(),
  DATABASE_URL_UNPOOLED: z.string().optional(),
  REPORT_OWNER_NAME: z.string().optional(),
  /** Optional read-only coach endpoint token (spec §5.2); ≥ 32 chars when set. */
  COACH_EXPORT_TOKEN: z.string().min(32, 'COACH_EXPORT_TOKEN must be at least 32 characters').optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export const env = schema.parse(process.env)
export const isProd = () => env.NODE_ENV === 'production'
