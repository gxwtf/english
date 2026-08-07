/**
 * gradingResult / lastAnswer → SM-2 quality 映射
 *
 * quality 取值 0-5（SM-2 标准）：
 *   - 5: 完美回忆
 *   - 4: 正确但犹豫
 *   - 3: 正确但困难（阈值）
 *   - 2: 错误但似曾相识
 *   - 1: 错误
 *   - 0: 完全没印象
 *
 * null 表示放弃/无法判分，跳过该 wordId 的状态更新
 */

import type { QuestionType } from '@/types/word';

export interface SubQuestionGrade {
  isCorrect?: boolean;
  score?: number;
  maxScore?: number;
  /** 用户是否放弃（空答案） */
  abandoned?: boolean;
}

/**
 * 将单道小题的批改结果转换为 SM-2 quality
 *
 * @returns 0-5 的 quality，或 null 表示跳过
 */
export function gradeResultToQuality(
  questionType: QuestionType,
  sub: SubQuestionGrade
): number | null {
  // 放弃（空答案）：跳过
  if (sub.abandoned) return null;

  switch (questionType) {
    case 'fill-blank':
    case 'definition-fill-blank':
    case 'meaning-select':
    case 'meaning-select-en': {
      // 二值判分：对→5，错→2
      if (sub.isCorrect === undefined) return null;
      return sub.isCorrect ? 5 : 2;
    }

    case 'translate':
    case 'word-select-translate': {
      // AI 评分 0-10：≥8→5, ≥6→4, ≥4→3, <4→2
      if (sub.score == null || sub.maxScore == null || sub.maxScore === 0) return null;
      const ratio = sub.score / sub.maxScore;
      if (ratio >= 0.8) return 5;
      if (ratio >= 0.6) return 4;
      if (ratio >= 0.4) return 3;
      return 2;
    }

    case 'word-card':
      // 查看型，不更新
      return null;

    default:
      return null;
  }
}
