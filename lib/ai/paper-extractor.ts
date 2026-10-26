import 'server-only';

import mammoth from 'mammoth';
import { getAIProvider, AIResult } from './provider';
import { loadPrompt } from './prompts';
import {
  extractedQuestionsResponseSchema,
  ExtractedQuestionsResponse,
} from '@/lib/validations/ai';

export interface FileToExtract {
  buffer: Buffer;
  mimeType: string;
  name: string;
}

/**
 * Extracts MCQ questions from an uploaded file (PDF, DOCX, PNG, JPG).
 * Converts DOCX to raw text with mammoth before passing to model.
 * Passes PDF/Images directly to extractFromFile.
 */
export async function extractQuestionsFromFile(
  file: FileToExtract
): Promise<AIResult<ExtractedQuestionsResponse>> {
  const provider = getAIProvider();
  const importPrompt = loadPrompt('import');

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

    const promptWithDocx = `${importPrompt}\n\nDocument Text Content:\n${docxText}`;
    return provider.generateText(promptWithDocx, extractedQuestionsResponseSchema);
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

  return provider.extractFromFile(
    { buffer: file.buffer, mimeType, name: file.name },
    importPrompt,
    extractedQuestionsResponseSchema
  );
}

