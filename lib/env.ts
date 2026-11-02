import { z } from 'zod';

const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required').optional(),

  // Optional app site url
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  // AI
  GEMINI_API_KEY: z.string().optional(),
  AI_PROVIDER: z.string().optional(),
  GEMINI_MODEL: z.string().optional(),
});

export const env = envSchema.safeParse(process.env);

if (!env.success && process.env.NODE_ENV === 'production') {
  console.error('❌ Invalid environment variables:', env.error.flatten().fieldErrors);
}
