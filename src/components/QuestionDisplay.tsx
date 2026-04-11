import { CheckCircle2, Edit3, Loader2, AlertCircle, ArrowRight, Eye } from 'lucide-react';
import { QuestionQueueItem } from '@/types/word';

const STATUS_LABELS: Record<string, string> = {
  GENERATING: '生成中',
  GENERATED: '生成完毕',
  ANSWERED: '已作答',
  FAILED: '生成失败',
};

export function QuestionList({
  queue,
  onRetry,
}: {
  queue: QuestionQueueItem[];
  onRetry?: (questionId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {queue.length === 0 && (
        <div className="text-center py-12 text-gray-400 dark:text-gray-500">
          暂无题目记录
        </div>
      )}

      {queue.map(q => (
        <div key={q.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3">
            <StatusIcon status={q.status} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {STATUS_LABELS[q.status]}
            </span>
            <span className="text-xs text-gray-400 ml-auto">
              {q.questionType === 'fill-blank' ? '选词填空' : '翻译句子'}
            </span>
            <span className="text-xs text-gray-400">
              {new Date(q.updatedAt).toLocaleString('zh-CN')}
            </span>

            {/* Action buttons based on status */}
            {q.status === 'GENERATED' && (
              <a
                href={`/practice/${q.id}`}
                className="ml-2 flex items-center gap-1 text-xs px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
              >
                开始作答 <ArrowRight className="h-3 w-3" />
              </a>
            )}

            {q.status === 'ANSWERED' && (
              <a
                href={`/practice/${q.id}`}
                className="ml-2 flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                查看作答 <Eye className="h-3 w-3" />
              </a>
            )}

            {q.status === 'GENERATING' && (
              <span className="ml-2 text-xs text-gray-400">AI 正在生成...</span>
            )}

            {q.status === 'FAILED' && onRetry && (
              <button
                onClick={() => onRetry(q.id)}
                className="ml-2 flex items-center gap-1 text-xs px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
              >
                重试 <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'GENERATING') return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
  if (status === 'GENERATED') return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === 'ANSWERED') return <Edit3 className="h-4 w-4 text-amber-500" />;
  if (status === 'FAILED') return <AlertCircle className="h-4 w-4 text-red-500" />;
  return null;
}

export function QuestionDisplay({
  content,
  questionId,
  onSubmitAnswer,
}: {
  content?: Record<string, unknown> | null;
  questionId: string;
  onSubmitAnswer?: (id: string, answers: Record<string, unknown>) => void;
}) {
  if (!content) return null;

  // New fill-blank format: { words: [...], questions: [{ sentence, answer }] }
  const words = content.words as string[] | undefined;
  const questions = content.questions as { sentence: string; answer: string }[] | undefined;
  // Old fill-blank format (backward compat): { title, instructions, passage, options, answers }
  const passage = content.passage as string | undefined;
  const options = content.options as Record<string, string[]> | undefined;
  const answers = content.answers as Record<string, string> | undefined;
  const title = content.title as string | undefined;
  const instructions = content.instructions as string | undefined;
  const isNewFillBlank = words && words.length > 0;
  const thinkingContent = content.thinking as string | undefined;

  return (
    <>
      {thinkingContent && (
        <details className="mb-4 text-xs">
          <summary className="cursor-pointer text-amber-600 dark:text-amber-400 font-medium">
            查看 AI 思考过程
          </summary>
          <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg whitespace-pre-wrap text-xs overflow-auto max-h-48">
            {thinkingContent}
          </pre>
        </details>
      )}
      <div className="space-y-4">
        {title && <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>}

        {/* New fill-blank format */}
        {isNewFillBlank && (
          <>
            {instructions && <p className="text-sm text-gray-600 dark:text-gray-400">{instructions}</p>}
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">可选单词：</p>
              <div className="flex flex-wrap gap-2">
                {words!.map((word, i) => (
                  <span
                    key={i}
                    className="text-sm px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full border border-green-200 dark:border-green-800"
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
            {questions && Array.isArray(questions) && (
              <div className="space-y-4">
                {questions!.map((q, i) => (
                  <div key={i} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">第 {i + 1} 题</p>
                    {renderBlankSentence(q.sentence)}
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                      答案: {q.answer}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Old fill-blank format (backward compat) */}
        {!isNewFillBlank && passage && options && (
          <>
            {instructions && <p className="text-sm text-gray-600 dark:text-gray-400">{instructions}</p>}
            {passage && <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{passage}</p>}
            <div className="space-y-3">
              {Object.entries(options).map(([num, opts]) => (
                <div key={num}>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">第 {num} 题</p>
                  <div className="grid grid-cols-2 gap-2">
                    {opts.map((opt, i) => (
                      <div
                        key={i}
                        className="text-sm px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300"
                      >
                        {['A', 'B', 'C', 'D'][i]}. {opt}
                      </div>
                    ))}
                  </div>
                  {answers?.[num] && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                      答案: {answers[num]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {renderRawContent(content.raw)}
        {renderTranslateQuestions(content.questions as unknown)}
      </div>
    </>
  );
}

function renderRawContent(raw: unknown): React.ReactNode {
  if (!raw) return null;
  return (
    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
      {String(raw)}
    </div>
  );
}

function renderBlankSentence(sentence: string, highlightAnswer?: string): React.ReactNode {
  if (!sentence) return null;
  const parts = sentence.replace(/_+/g, '_').split('_');
  return (
    <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <span className="inline-block min-w-[60px] border-b-2 border-dashed border-green-400 dark:border-green-600 mx-1">&nbsp;</span>
          )}
        </span>
      ))}
    </p>
  );
}

export function renderTranslateQuestions(questions: unknown): React.ReactNode {
  if (!Array.isArray(questions)) return null;
  // Only render translate-type questions (has 'chinese' field, not fill-blank)
  const translateQs = questions.filter((q: any) => q.chinese !== undefined);
  if (translateQs.length === 0) return null;
  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      {translateQs.map((q: any, i: number) => (
        <div key={i} className="space-y-2">
          {q.type === 'cn_to_en' && (
            <>
              <p className="text-sm text-gray-900 dark:text-white font-medium">
                {q.chinese}
              </p>
              {q.hint && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{q.hint}</p>
              )}
              {q.referenceAnswers && (
                <details className="text-xs">
                  <summary className="text-blue-600 dark:text-blue-400 cursor-pointer">参考答案</summary>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">{q.referenceAnswers}</p>
                </details>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
