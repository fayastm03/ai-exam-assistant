import 'server-only';

import { getAIProvider, AIResult } from './provider';
import { loadPrompt } from './prompts';
import {
  explainQuestionsResponseSchema,
  ExplainQuestionsResponse,
} from '@/lib/validations/ai';

export interface QuestionToExplain {
  id: string;
  number: number;
  text: string;
  options: unknown;
  correct_option: string;
  topic?: string | null;
  explanation?: string | null;
}

/**
 * Generates explanations and fact-checks correct options for all questions in an exam in one call.
 * Uses prompts/v1/explain.txt.
 * Guarantees that correct_option is never altered.
 */
export async function explainExamQuestions(
  questions: QuestionToExplain[]
): Promise<AIResult<ExplainQuestionsResponse>> {
  const provider = getAIProvider();
  const basePrompt = loadPrompt('explain');

  // Format questions into structured text for the prompt
  const formattedQuestions = questions
    .map((q) => {
      let optionsStr = '';
      if (Array.isArray(q.options)) {
        optionsStr = q.options
          .map((opt: { id?: string; key?: string; text?: string }) => {
            const key = opt.id || opt.key || '';
            const text = opt.text || '';
            return `  ${key}) ${text}`;
          })
          .join('\n');
      } else if (q.options && typeof q.options === 'object') {
        optionsStr = Object.entries(q.options)
          .map(([k, v]) => `  ${k}) ${v}`)
          .join('\n');
      } else {
        optionsStr = String(q.options || '');
      }

      return `Question #${q.number}:
Statement: ${q.text}
Options:
${optionsStr}
Designated Correct Option: ${q.correct_option}${q.topic ? `\nTopic: ${q.topic}` : ''}`;
    })
    .join('\n\n---\n\n');

  const fullPrompt = `${basePrompt}\n\nExam Questions to Explain:\n${formattedQuestions}`;

  return provider.generateText(fullPrompt, explainQuestionsResponseSchema);
}
