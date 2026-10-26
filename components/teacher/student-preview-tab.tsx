'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, Eye } from 'lucide-react';

interface StudentPreviewTabProps {
  exam: {
    title: string;
    instructions: string | null;
    duration_min: number;
    negative_marking: number;
  };
  questions: {
    id: string;
    number: number;
    text: string;
    options: { id: string; text: string }[] | Record<string, string>;
    marks: number;
    topic: string | null;
  }[];
}

export function StudentPreviewTab({ exam, questions }: StudentPreviewTabProps) {
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});

  const handleSelectOption = (questionId: string, optionId: string) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const normalizeOptions = (options: unknown): { id: string; text: string }[] => {
    if (Array.isArray(options)) {
      return options.map((opt) => ({
        id: String(opt.id || '').trim().toUpperCase(),
        text: String(opt.text || opt),
      }));
    }
    if (typeof options === 'object' && options !== null) {
      return Object.entries(options).map(([k, v]) => ({
        id: k.trim().toUpperCase(),
        text: String(v),
      }));
    }
    return [];
  };

  return (
    <div className="space-y-6">
      {/* Student View Banner */}
      <Alert className="border-blue-300 bg-blue-50/50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200">
        <Eye className="w-4 h-4 text-blue-600" />
        <AlertDescription className="text-xs">
          <strong>Student Examination Preview:</strong> This preview replicates what students see when taking
          this exam. In accordance with platform security rules, correct options and explanations are strictly
          omitted from the client prior to final submission.
        </AlertDescription>
      </Alert>

      {/* Simulated Student Exam Header */}
      <Card className="border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-xl font-bold">{exam.title}</CardTitle>
              {exam.instructions && (
                <CardDescription className="text-xs pt-1">{exam.instructions}</CardDescription>
              )}
            </div>

            {/* Simulated Server-Owned Timer */}
            <div className="flex items-center gap-2 self-start sm:self-auto bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-lg text-sm font-mono font-semibold">
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>{exam.duration_min}:00</span>
              <span className="text-[10px] text-amber-600/70 font-sans uppercase tracking-wider font-normal">
                (Server-Timed)
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-neutral-500">
            <span>Total Questions: {questions.length}</span>
            <span>•</span>
            <span>Duration: {exam.duration_min} mins</span>
            {exam.negative_marking > 0 && (
              <>
                <span>•</span>
                <span className="text-red-500 font-medium">
                  Negative Marking: -{Math.round(exam.negative_marking * 100)}% on incorrect answers
                </span>
              </>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Questions list */}
      {questions.length === 0 ? (
        <Card className="py-8 text-center text-neutral-400 text-sm">
          No questions added to this exam yet. Add questions to preview the student experience.
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => {
            const optionsList = normalizeOptions(q.options);
            const currentSelected = selectedAnswers[q.id];

            return (
              <Card key={q.id} className="border-neutral-200/80 dark:border-neutral-800">
                <CardHeader className="py-3 px-4 pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-2.5 py-1 rounded">
                        Question #{q.number}
                      </span>
                      {q.topic && (
                        <Badge variant="secondary" className="text-[10px]">
                          {q.topic}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-neutral-500">
                      {q.marks} {q.marks === 1 ? 'Mark' : 'Marks'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 pt-2 whitespace-pre-line">
                    {q.text}
                  </p>
                </CardHeader>

                <CardContent className="py-3 px-4 pt-1 space-y-2">
                  <div className="space-y-2">
                    {optionsList.map((opt) => {
                      const isChosen = currentSelected === opt.id;
                      return (
                        <label
                          key={opt.id}
                          onClick={() => handleSelectOption(q.id, opt.id)}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                            isChosen
                              ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 font-medium'
                              : 'border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`preview-q-${q.id}`}
                            checked={isChosen}
                            onChange={() => handleSelectOption(q.id, opt.id)}
                            className="text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span className="w-5 font-bold text-neutral-500">{opt.id}</span>
                          <span className="flex-1">{opt.text}</span>
                        </label>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
