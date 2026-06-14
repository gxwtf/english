'use client';

import { MeaningSelectBaseAnswer } from '@/components/MeaningSelectBaseAnswer';

interface MeaningSelectQuestionItem {
  id: number;
  type: string;
  word: string;
  chinese: string;
  options: string[];
  correctAnswer: string;
}

interface MeaningSelectAnswerProps {
  questionId: string;
  questions: MeaningSelectQuestionItem[];
  thinking?: string;
  lastAnswer?: Record<string, unknown>;
  status?: string;
  onSubmitted?: () => void;
}

export function MeaningSelectAnswer({ questionId, questions, thinking, lastAnswer, status, onSubmitted }: MeaningSelectAnswerProps) {
  return (
    <MeaningSelectBaseAnswer
      questionId={questionId}
      questions={questions}
      thinking={thinking}
      lastAnswer={lastAnswer}
      status={status}
      onSubmitted={onSubmitted}
      optionGridCols={2}
    />
  );
}
