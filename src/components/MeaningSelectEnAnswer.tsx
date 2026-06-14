'use client';

import { MeaningSelectBaseAnswer } from '@/components/MeaningSelectBaseAnswer';

interface MeaningSelectEnQuestionItem {
  id: number;
  type: string;
  word: string;
  english: string;
  options: string[];
  correctAnswer: string;
}

interface MeaningSelectEnAnswerProps {
  questionId: string;
  questions: MeaningSelectEnQuestionItem[];
  thinking?: string;
  lastAnswer?: Record<string, unknown>;
  status?: string;
  onSubmitted?: () => void;
}

export function MeaningSelectEnAnswer({ questionId, questions, thinking, lastAnswer, status, onSubmitted }: MeaningSelectEnAnswerProps) {
  return (
    <MeaningSelectBaseAnswer
      questionId={questionId}
      questions={questions}
      thinking={thinking}
      lastAnswer={lastAnswer}
      status={status}
      onSubmitted={onSubmitted}
      optionGridCols={1}
    />
  );
}
