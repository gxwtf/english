import { NextRequest, NextResponse } from 'next/server';
import {
  generateFillBlankWithQuestion,
  generateTranslateWithQuestion,
  generateMeaningSelectWithQuestion,
  generateMeaningSelectEnWithQuestion,
  generateDefinitionFillBlankWithQuestion,
  generateWordSelectTranslateWithQuestion,
  markQuestionAsFailed,
} from '@/actions/ai-question';
import { getAuthUser } from '@/actions/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 600;

interface PendingQuestionPayload {
  questionId: string;
  questionType: string;
  wordIds: number[];
  options: any;
  relatedWordEntries: any[];
}

/**
 * 触发单道 AI 题目的生成。
 *
 * 使用 Route Handler 而非 Server Action：Next.js 的 Server Action 会进入
 * App Router 的 action 队列串行执行，长时间运行的出题会阻塞同一客户端后续
 * 的 Server Action（例如读取题目状态），导致页面一直停留在“加载中”。
 * Route Handler 不参与该队列，因此出题期间状态轮询 / 进度读取仍可正常进行。
 */
export async function POST(request: NextRequest) {
  let item: PendingQuestionPayload;
  try {
    item = (await request.json()) as PendingQuestionPayload;
  } catch {
    return NextResponse.json({ ok: false, error: '无效的请求体' }, { status: 400 });
  }

  const { questionId, questionType, wordIds, options, relatedWordEntries } = item || ({} as PendingQuestionPayload);
  if (!questionId || !questionType || !Array.isArray(wordIds)) {
    return NextResponse.json({ ok: false, error: '缺少必要参数' }, { status: 400 });
  }

  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: '未登录' }, { status: 401 });
  }

  try {
    switch (questionType) {
      case 'fill-blank': {
        const fillBlankOptions = options?.fillBlank ?? { n: 5, m: 0 };
        await generateFillBlankWithQuestion(
          questionId, wordIds, fillBlankOptions,
          undefined, options?.deepThinking,
          relatedWordEntries, options?.allowFormChange
        );
        break;
      }
      case 'translate': {
        const translateOptions = options?.translate ?? { n: 5 };
        await generateTranslateWithQuestion(
          questionId, wordIds, translateOptions,
          undefined, options?.deepThinking,
          relatedWordEntries
        );
        break;
      }
      case 'meaning-select': {
        const meaningSelectOptions = options?.meaningSelect ?? { n: 5 };
        await generateMeaningSelectWithQuestion(
          questionId, wordIds, meaningSelectOptions,
          options?.deepThinking,
          relatedWordEntries
        );
        break;
      }
      case 'meaning-select-en': {
        const meaningSelectEnOptions = options?.meaningSelectEn ?? { n: 5 };
        await generateMeaningSelectEnWithQuestion(
          questionId, wordIds, meaningSelectEnOptions,
          options?.deepThinking,
          relatedWordEntries
        );
        break;
      }
      case 'definition-fill-blank': {
        const definitionFillBlankOptions = options?.definitionFillBlank ?? { n: 5, m: 0 };
        await generateDefinitionFillBlankWithQuestion(
          questionId, wordIds, definitionFillBlankOptions,
          undefined, options?.deepThinking,
          relatedWordEntries
        );
        break;
      }
      case 'word-select-translate': {
        const wordSelectTranslateOptions = options?.wordSelectTranslate ?? { n: 5, m: 0 };
        await generateWordSelectTranslateWithQuestion(
          questionId, wordIds, wordSelectTranslateOptions,
          undefined, options?.deepThinking,
          relatedWordEntries
        );
        break;
      }
      case 'word-card': {
        // word-card 不需要 AI 生成
        break;
      }
      default: {
        return NextResponse.json({ ok: false, error: `未知题目类型: ${questionType}` }, { status: 400 });
      }
    }
  } catch (error) {
    console.error('[ai-generate] 生成失败:', error);
    try {
      await markQuestionAsFailed(questionId);
    } catch {
      // ignore
    }
    return NextResponse.json({ ok: false, error: '生成失败' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
