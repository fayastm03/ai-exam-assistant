import 'server-only';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads a prompt template from prompts/v1/<filename>.txt
 * and replaces template placeholders (e.g. {{variable}}).
 */
export function loadPrompt(
  filename: string,
  variables: Record<string, string> = {}
): string {
  const cleanName = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  const filePath = path.join(process.cwd(), 'prompts', 'v1', cleanName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Prompt file not found at ${filePath}`);
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  for (const [key, value] of Object.entries(variables)) {
    content = content.replaceAll(`{{${key}}}`, value);
  }

  return content;
}
