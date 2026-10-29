import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_BASE_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z
    .string()
    .min(10, "FATAL: DATABASE_URL is required in server environment."),
  JWT_SECRET: z
    .string()
    .min(16, "JWT_SECRET must be at least 16 characters")
    .default("super-secure-production-jwt-token-key-change-this"),
  SESSION_EXPIRY: z.string().default("7d"),
  GEMINI_API_KEY: z
    .string()
    .min(5, "FATAL: GEMINI_API_KEY is not configured in server environment."),
  GROQ_API_KEY: z
    .string()
    .min(5, "FATAL: GROQ_API_KEY is not configured in server environment.")
    .optional(),
  DEFAULT_SEARCH_RADIUS_KM: z.coerce.number().positive().default(15.0),
  BASE_DELIVERY_FEE_CENTS: z.coerce.number().int().nonnegative().default(299),
  PER_KM_DELIVERY_FEE_CENTS: z.coerce.number().int().nonnegative().default(100),
  DEFAULT_TAX_RATE_PERCENTAGE: z.coerce.number().nonnegative().default(8.25),
});

export function validateEnv(rawEnv: NodeJS.ProcessEnv = process.env) {
  const merged = {
    ...rawEnv,
    GEMINI_API_KEY: rawEnv.GEMINI_API_KEY || rawEnv.GROQ_API_KEY,
    GROQ_API_KEY: rawEnv.GROQ_API_KEY || rawEnv.GEMINI_API_KEY,
  };
  const parsed = EnvSchema.safeParse(merged);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`FATAL ENVIRONMENT VALIDATION ERROR: ${formatted}`);
  }
  return parsed.data;
}

export const env = validateEnv(process.env);
