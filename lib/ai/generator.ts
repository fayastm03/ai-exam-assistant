import 'server-only';

import mammoth from 'mammoth';
import { getAIProvider, AIResult } from './provider';
import { loadPrompt } from './prompts';
import {
  generatedQuestionsResponseSchema,
  GeneratedQuestionsResponse,
} from '@/lib/validations/ai';

export interface GenerateOptions {
  count: number;
  level: 'easy' | 'medium' | 'hard';
  text?: string;
  file?: {
    buffer: Buffer;
    mimeType: string;
    name: string;
  };
}

/**
 * Generates MCQs from provided text notes or uploaded documents/photos.
 * Fills {{count}} and {{level}} placeholders in prompts/v1/generate.txt.
 * Converts DOCX to text with mammoth first, or passes PDF/image to extractFromFile.
 */
export async function generateQuestionsFromNotes(
  options: GenerateOptions
): Promise<AIResult<GeneratedQuestionsResponse>> {
  const { count, level, text, file } = options;
  const provider = getAIProvider();

  // Load prompt with {{count}} and {{level}} placeholders filled
  const systemPrompt = loadPrompt('generate', {
    count: String(count),
    level,
  });

  // Case 1: Uploaded document/photo
  if (file) {
    const isDocx =
      file.mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.toLowerCase().endsWith('.docx');

    if (isDocx) {
      const mammothResult = await mammoth.extractRawText({ buffer: file.buffer });
      const docxText = mammothResult.value;

      if (!docxText || docxText.trim().length === 0) {
        return {
          data: null,
          rawText: '',
          isFlagged: true,
          flagReason: 'No text content could be extracted from DOCX file',
          usage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0, latencyMs: 0 },
        };
      }

      const combinedText = [text, docxText].filter(Boolean).join('\n\n');
      const fullPrompt = `${systemPrompt}\n\nReference Material / Notes:\n${combinedText}`;
      return provider.generateText(fullPrompt, generatedQuestionsResponseSchema);
    }

    // PDF or Image
    let mimeType = file.mimeType;
    if (!mimeType || mimeType === 'application/octet-stream') {
      const name = file.name.toLowerCase();
      if (name.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (name.endsWith('.png')) mimeType = 'image/png';
      else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mimeType = 'image/jpeg';
      else mimeType = 'application/pdf';
    }

    const promptWithInstructions = text
      ? `${systemPrompt}\n\nAdditional Notes / Instructions:\n${text}`
      : systemPrompt;

    return provider.extractFromFile(
      { buffer: file.buffer, mimeType, name: file.name },
      promptWithInstructions,
      generatedQuestionsResponseSchema
    );
  }

  // Case 2: Pasted text notes
  if (!text || text.trim().length === 0) {
    return {
      data: null,
      rawText: '',
      isFlagged: true,
      flagReason: 'No text or file provided for question generation',
      usage: { promptTokens: 0, candidatesTokens: 0, totalTokens: 0, latencyMs: 0 },
    };
  }

  const fullPrompt = `${systemPrompt}\n\nReference Material / Notes:\n${text}`;
  return provider.generateText(fullPrompt, generatedQuestionsResponseSchema);
}
