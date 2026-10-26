/**
 * Pure parser for bulk-pasting MCQ questions.
 * Format expected:
 * Q: Question text...
 * A) Option text
 * B) Option text * (asterisk marks correct option)
 * C) Option text
 * D) Option text
 * Topic: Topic name (optional)
 * Marks: 2 (optional, defaults to 1)
 * Explanation: Optional explanation text...
 */

export interface ParsedOption {
  id: string; // "A", "B", "C", etc.
  text: string;
}

export interface ParsedQuestionDraft {
  number: number;
  text: string;
  options: ParsedOption[];
  correct_option: string;
  marks: number;
  topic: string | null;
  explanation: string | null;
  source: 'manual';
  review_status: 'draft';
  isValid: boolean;
  errors: string[];
}

export interface BulkParseResult {
  questions: ParsedQuestionDraft[];
  totalParsed: number;
  validCount: number;
  hasErrors: boolean;
}

/**
 * Splits bulk text into individual question blocks.
 * Questions typically start with "Q:", "Q1:", "Question:", "Question 1:", etc.
 */
function splitQuestionBlocks(rawText: string): string[] {
  const lines = rawText.split(/\r?\n/);
  const blocks: string[] = [];
  let currentBlock: string[] = [];

  const questionStartRegex = /^\s*(?:Q(?:\d+)?|Question(?:\s+\d+)?)\s*[:.]/i;

  for (const line of lines) {
    if (questionStartRegex.test(line)) {
      const trimmedBlock = currentBlock.join('\n').trim();
      if (trimmedBlock.length > 0) {
        blocks.push(trimmedBlock);
        currentBlock = [];
      }
    }
    currentBlock.push(line);
  }

  if (currentBlock.length > 0) {
    const joined = currentBlock.join('\n').trim();
    if (joined.length > 0) {
      blocks.push(joined);
    }
  }

  // Fallback: If no "Q:" was detected, split by double newlines
  if (blocks.length === 0 && rawText.trim().length > 0) {
    return rawText
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter((b) => b.length > 0);
  }

  return blocks;
}

/**
 * Parses a single question block text into a draft question object.
 */
export function parseSingleQuestionBlock(
  blockText: string,
  questionNumber: number
): ParsedQuestionDraft {
  const lines = blockText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const errors: string[] = [];

  let questionText = '';
  const options: ParsedOption[] = [];
  let correctOption = '';
  let topic: string | null = null;
  let marks = 1;
  let explanation: string | null = null;

  const optionRegex = /^([A-Za-z0-9]+)[\)\.\]]\s*(.*)$/;
  const topicRegex = /^Topic\s*[:.]\s*(.*)$/i;
  const marksRegex = /^Marks?\s*[:.]\s*(.*)$/i;
  const explanationRegex = /^Explanation\s*[:.]\s*(.*)$/i;
  const questionHeaderRegex = /^(?:Q(?:\d+)?|Question(?:\s+\d+)?)\s*[:.]\s*(.*)$/i;

  let readingQuestionText = true;
  let readingExplanation = false;

  for (const line of lines) {
    // Check for Topic
    const topicMatch = line.match(topicRegex);
    if (topicMatch) {
      topic = topicMatch[1].trim() || null;
      readingQuestionText = false;
      readingExplanation = false;
      continue;
    }

    // Check for Marks
    const marksMatch = line.match(marksRegex);
    if (marksMatch) {
      const parsedMarks = parseFloat(marksMatch[1].trim());
      if (!isNaN(parsedMarks) && parsedMarks > 0) {
        marks = parsedMarks;
      }
      readingQuestionText = false;
      readingExplanation = false;
      continue;
    }

    // Check for Explanation
    const explanationMatch = line.match(explanationRegex);
    if (explanationMatch) {
      explanation = explanationMatch[1].trim();
      readingQuestionText = false;
      readingExplanation = true;
      continue;
    }

    // Check for Options: e.g. "A) London", "B) Paris *"
    const optionMatch = line.match(optionRegex);
    if (optionMatch) {
      readingQuestionText = false;
      readingExplanation = false;

      const optionId = optionMatch[1].toUpperCase();
      let optionText = optionMatch[2].trim();

      // Check if this option is marked as correct with an asterisk (*)
      const isCorrect = optionText.includes('*');
      if (isCorrect) {
        // Strip trailing or inline asterisk
        optionText = optionText.replace(/\*/g, '').trim();
        if (correctOption) {
          errors.push(`Multiple correct options marked with '*' (found ${correctOption} and ${optionId})`);
        }
        correctOption = optionId;
      }

      options.push({
        id: optionId,
        text: optionText,
      });
      continue;
    }

    // If reading explanation across multiple lines
    if (readingExplanation) {
      explanation = explanation ? `${explanation} ${line}` : line;
      continue;
    }

    // If reading question text
    if (readingQuestionText) {
      const qHeaderMatch = line.match(questionHeaderRegex);
      const textToAdd = qHeaderMatch ? qHeaderMatch[1].trim() : line;
      questionText = questionText ? `${questionText} ${textToAdd}` : textToAdd;
    }
  }

  // Validate the parsed draft
  if (!questionText || questionText.trim().length === 0) {
    errors.push('Question text is missing');
  }

  if (options.length < 2) {
    errors.push(`At least 2 options are required (found ${options.length})`);
  }

  if (!correctOption) {
    errors.push('No correct option marked with asterisk (*)');
  } else {
    const matchingOption = options.find((opt) => opt.id === correctOption);
    if (!matchingOption) {
      errors.push(`Correct option '${correctOption}' does not match any of the option letters`);
    }
  }

  return {
    number: questionNumber,
    text: questionText.trim(),
    options,
    correct_option: correctOption,
    marks,
    topic,
    explanation: explanation ? explanation.trim() : null,
    source: 'manual',
    review_status: 'draft',
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Parses full bulk text containing one or more question blocks.
 */
export function parseBulkQuestions(rawText: string): BulkParseResult {
  const blocks = splitQuestionBlocks(rawText);
  const questions: ParsedQuestionDraft[] = [];

  let index = 1;
  for (const block of blocks) {
    const parsed = parseSingleQuestionBlock(block, index);
    questions.push(parsed);
    index++;
  }

  const validCount = questions.filter((q) => q.isValid).length;
  const hasErrors = questions.some((q) => !q.isValid);

  return {
    questions,
    totalParsed: questions.length,
    validCount,
    hasErrors,
  };
}
