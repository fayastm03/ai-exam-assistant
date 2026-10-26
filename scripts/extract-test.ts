import * as fs from 'node:fs';
import * as path from 'node:path';

// Mock server-only in standalone CLI script context
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

// Load .env.local if present
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

interface ExpectedQuestion {
  number: number;
  text: string;
  options: { id: string; text: string }[];
  correct_option?: string | null;
  marks?: number;
  topic?: string | null;
}

interface ExpectedData {
  [filename: string]: {
    questions: ExpectedQuestion[];
  };
}

function normalize(str: string): string {
  return str.toLowerCase().replace(/[\s\p{P}]+/gu, ' ').trim();
}

function compareQuestion(
  actual: {
    number?: number;
    text: string;
    options: { id: string; text: string }[];
    correct_option?: string | null;
  },
  expected: ExpectedQuestion,
  qIndex: number
): string[] {
  const diffs: string[] = [];
  const qNum = expected.number || qIndex + 1;

  if (actual.number !== expected.number) {
    diffs.push(`Q#${qNum}: Expected question number ${expected.number}, but got ${actual.number}`);
  }

  if (normalize(actual.text) !== normalize(expected.text)) {
    diffs.push(`Q#${qNum} text:\n  Expected: "${expected.text}"\n  Received: "${actual.text}"`);
  }

  if (expected.correct_option) {
    const expCorrect = expected.correct_option.trim().toUpperCase();
    const actCorrect = (actual.correct_option || '').trim().toUpperCase();
    if (expCorrect !== actCorrect) {
      diffs.push(`Q#${qNum} correct_option:\n  Expected: "${expCorrect}"\n  Received: "${actCorrect}"`);
    }
  }

  if (actual.options.length !== expected.options.length) {
    diffs.push(
      `Q#${qNum} options count: Expected ${expected.options.length} options, but got ${actual.options.length}`
    );
  } else {
    for (let i = 0; i < expected.options.length; i++) {
      const expOpt = expected.options[i];
      const actOpt = actual.options[i];
      if (expOpt.id.toUpperCase() !== actOpt.id.toUpperCase()) {
        diffs.push(`Q#${qNum} option[${i}] ID:\n  Expected: "${expOpt.id}"\n  Received: "${actOpt.id}"`);
      }
      if (normalize(expOpt.text) !== normalize(actOpt.text)) {
        diffs.push(
          `Q#${qNum} option[${expOpt.id}] text:\n  Expected: "${expOpt.text}"\n  Received: "${actOpt.text}"`
        );
      }
    }
  }

  return diffs;
}

async function main() {
  console.log('--- Paper Extraction Test Runner ---\n');

  const { extractQuestionsFromFile } = await import('../lib/ai/paper-extractor');

  const samplesDir = path.join(process.cwd(), 'samples');
  const expectedPath = path.join(samplesDir, 'expected.json');

  if (!fs.existsSync(expectedPath)) {
    console.error(`❌ Expected results file not found at ${expectedPath}`);
    process.exit(1);
  }

  const expectedContent = fs.readFileSync(expectedPath, 'utf-8');
  let expectedMap: ExpectedData;
  try {
    expectedMap = JSON.parse(expectedContent);
  } catch {
    console.error(`❌ Invalid JSON in ${expectedPath}`);
    process.exit(1);
  }

  const sampleFiles = fs
    .readdirSync(samplesDir)
    .filter((file) => file !== 'expected.json' && !file.startsWith('.'));

  if (sampleFiles.length === 0) {
    console.warn('⚠️ No sample paper files found in samples/ directory.');
    process.exit(0);
  }

  let passedCount = 0;
  let failedCount = 0;

  for (const filename of sampleFiles) {
    console.log(`\n========================================`);
    console.log(`Testing file: samples/${filename}`);
    console.log(`========================================`);

    const filePath = path.join(samplesDir, filename);
    const buffer = fs.readFileSync(filePath);
    const expectedItem = expectedMap[filename];

    if (!expectedItem) {
      console.log(`❌ FAIL: No expected entry found in expected.json for "${filename}"`);
      failedCount++;
      continue;
    }

    let mimeType = 'application/octet-stream';
    const lower = filename.toLowerCase();
    if (lower.endsWith('.docx')) {
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (lower.endsWith('.pdf')) {
      mimeType = 'application/pdf';
    } else if (lower.endsWith('.png')) {
      mimeType = 'image/png';
    } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      mimeType = 'image/jpeg';
    }

    try {
      const result = await extractQuestionsFromFile({
        buffer,
        mimeType,
        name: filename,
      });

      if (result.isFlagged || !result.data?.questions) {
        console.log(`❌ FAIL: AI extraction returned flagged result: ${result.flagReason}`);
        failedCount++;
        continue;
      }

      const actualQuestions = result.data.questions;
      const expectedQuestions = expectedItem.questions;

      const fileDiffs: string[] = [];

      if (actualQuestions.length !== expectedQuestions.length) {
        fileDiffs.push(
          `Total questions count mismatch: Expected ${expectedQuestions.length}, got ${actualQuestions.length}`
        );
      }

      const maxLen = Math.min(actualQuestions.length, expectedQuestions.length);
      for (let i = 0; i < maxLen; i++) {
        const qDiffs = compareQuestion(actualQuestions[i], expectedQuestions[i], i);
        fileDiffs.push(...qDiffs);
      }

      if (fileDiffs.length === 0) {
        console.log(`✅ PASS: ${filename}`);
        console.log(`   Extracted ${actualQuestions.length} question(s) exactly matching expected.json`);
        console.log(`   Tokens: prompt=${result.usage.promptTokens}, candidates=${result.usage.candidatesTokens}, latency=${result.usage.latencyMs}ms`);
        passedCount++;
      } else {
        console.log(`❌ FAIL: ${filename}`);
        console.log(`Differences found:`);
        fileDiffs.forEach((diff) => console.log(`  - ${diff}`));
        failedCount++;
      }
    } catch (err: unknown) {
      console.log(`❌ FAIL: Error extracting ${filename}:`);
      console.log(err instanceof Error ? err.message : String(err));
      failedCount++;
    }
  }

  console.log('\n========================================');
  console.log(`Test Summary: ${passedCount} PASSED, ${failedCount} FAILED (Total: ${sampleFiles.length})`);
  console.log('========================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

main();
