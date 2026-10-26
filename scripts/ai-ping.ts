import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';

// Mock server-only in standalone CLI script context so require('server-only') succeeds
try {
  const serverOnlyPath = require.resolve('server-only');
  require.cache[serverOnlyPath] = {
    id: serverOnlyPath,
    filename: serverOnlyPath,
    loaded: true,
    exports: {},
  } as unknown as NodeModule;
} catch {
  // Ignored if server-only cannot be resolved
}

// Load .env.local if present and not already loaded
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const content = fs.readFileSync(envLocalPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...rest] = trimmed.split('=');
    if (key && rest.length > 0) {
      const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
      if (!process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  }
}

// Zod schema for ping response verification
const pingResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  timestamp: z.string().optional(),
});

// Dynamic imports after server-only mock
async function main() {
  const { getAIProvider } = await import('../lib/ai/provider');
  const { loadPrompt } = await import('../lib/ai/prompts');
  console.log('--- AI Provider Ping Test ---');
  console.log(`Configured AI_PROVIDER: ${process.env.AI_PROVIDER || 'gemini'}`);
  console.log(`Configured GEMINI_MODEL: ${process.env.GEMINI_MODEL || '(default)'}`);

  try {
    const provider = getAIProvider();
    console.log(`Initialized Provider: [${provider.name}] with model: [${provider.model}]`);

    // Load prompt from prompts/v1/ping.txt
    const prompt = loadPrompt('ping', {
      message: 'Antigravity connection ping test',
    });

    console.log('\nSending test prompt to AI provider...');
    const result = await provider.generateText(prompt, pingResponseSchema);

    if (result.isFlagged) {
      console.error('\n❌ Request completed but returned a FLAGGED result:');
      console.error(`Flag reason: ${result.flagReason}`);
      console.error(`Raw text: ${result.rawText}`);
      process.exit(1);
    }

    console.log('\n✅ AI Provider Ping Successful!');
    console.log('---------------------------------');
    console.log('Parsed Response:', JSON.stringify(result.data, null, 2));
    console.log(`Latency: ${result.usage.latencyMs}ms`);
    console.log(
      `Tokens: prompt=${result.usage.promptTokens}, candidates=${result.usage.candidatesTokens}, total=${result.usage.totalTokens}`
    );
    console.log('---------------------------------');
  } catch (err: unknown) {
    console.error('\n❌ Ping failed with an error:');
    if (err instanceof Error) {
      console.error(err.message);
      if (err.stack) console.error(err.stack);
    } else {
      console.error(String(err));
    }
    process.exit(1);
  }
}

main();
