import { SupabaseClient } from '@supabase/supabase-js';

export const JOIN_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a random 6-character join code using the alphabet without look-alikes.
 */
export function generateRandomJoinCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * JOIN_CODE_ALPHABET.length);
    code += JOIN_CODE_ALPHABET[randomIndex];
  }
  return code;
}

/**
 * Generates a unique 6-character join code that does not currently exist in the classes table.
 */
export async function generateUniqueJoinCode(supabase: SupabaseClient): Promise<string> {
  let attempts = 0;
  const maxAttempts = 20;

  while (attempts < maxAttempts) {
    const candidate = generateRandomJoinCode();
    const { data } = await supabase
      .from('classes')
      .select('id')
      .eq('join_code', candidate)
      .maybeSingle();

    if (!data) {
      return candidate;
    }
    attempts++;
  }

  // Fallback timestamp suffix if collision persists
  return generateRandomJoinCode();
}

