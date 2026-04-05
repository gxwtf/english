'use client';

import { QuestionQueueItem } from '@/types/word';
import { Sparkles, Clock, CheckCircle2, Edit3, Loader2 } from 'lucide-react';

interface QuestionPanelProps {
  queue: QuestionQueueItem[];
  isOpen: boolean;
  onClose: () => void;
  onProcess: () => void;
  onSubmitAnswer?: (questionId: string, answers: Record<string, unknown>) => void;
  processing: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  GENERATING: '正在生成',
  GENERATED: '生成完毕',
  ANSWERED: '已作答',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  GENERATING: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
  GENERATED: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  ANSWERED: <Edit3 className="h-4 w-4 text-amber-500" />,
};

export const QuestionPanel = ({
  queue,
  isOpen,
  onClose,
  onProcess,
  onSubmitAnswer,
  processing,
}: QuestionPanelProps) => {
  if (!isOpen) return null;

  const generatingCount = queue.filter(q => q.status === 'GENERATING').length;
  const generatedQuestions = queue.filter(q => q.status === 'GENERATED' || q.status === 'ANSWERED');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">AI 出题队列</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            关闭
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {queue.length === 0 && !processing && (
            <div className="text-center py-12 text-gray-400 dark:text-gray-500">
              暂无题目记录
            </div>
          )}

          {generatingCount > 0 && (
            <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  还有 {generatingCount} 道题目正在生成中...
                </span>
              </div>
              <button
                onClick={onProcess}
                disabled={processing}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
              >
                触发 AI 生成
              </button>
            </div>
          )}

          {generatedQuestions.map(q => (
            <div key={q.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              {/* Question header */}
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-750 border-b border-gray-200 dark:border-gray-700">
                {STATUS_ICONS[q.status]}
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {STATUS_LABELS[q.status]}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {q.questionType === 'fill-blank' ? '选词填空' : '翻译句子'}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(q.updatedAt).toLocaleString('zh-CN')}
                </span>
              </div>

              {/* Question content */}
              {q.questionContent && (
                <div className="p-4">
                  <QuestionDisplay content={q.questionContent} questionId={q.id} onSubmitAnswer={q.status === 'GENERATED' ? onSubmitAnswer : undefined} />
                </div>
              )}

              {/* Last answer preview */}
              {q.lastAnswer && (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-200 dark:border-amber-800">
                  <summary className="text-sm text-amber-700 dark:text-amber-400 cursor-pointer">
                    查看作答记录
                  </summary>
                  <pre className="text-xs text-amber-600 dark:text-amber-300 mt-1 whitespace-pre-wrap overflow-auto max-h-24">
                    {JSON.stringify(q.lastAnswer, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Simple renderer for the question content
function QuestionDisplay({
  content,
  questionId,
  onSubmitAnswer,
}: {
  content: Record<string, unknown>;
  questionId: string;
  onSubmitAnswer?: (id: string, answers: Record<string, unknown>) => void;
}) {
  const title = content.title as string | undefined;
  const passage = content.passage as string | undefined;
  const instructions = content.instructions as string | undefined;
  const options = content.options as Record<string, string[]> | undefined;
  const answers = content.answers as Record<string, string> | undefined;

  return (
    <div className="space-y-4">
      {title && <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>}
      {instructions && <p className="text-sm text-gray-600 dark:text-gray-400">{instructions}</p>}
      {passage && <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">{passage}</p>}

      {options && (
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
      )}

      {renderRawContent(content.raw)}

      {renderQuestions(content.questions)}
    </div>
  );
}

// Helper to safely render raw content
function renderRawContent(raw: unknown): React.ReactNode {
  if (!raw) return null;
  return (
    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
      {String(raw)}
    </div>
  );
}

// Helper to safely render questions array
function renderQuestions(questions: unknown): React.ReactNode {
  if (!Array.isArray(questions)) return null;
  return (
    <div className="space-y-4">
      {questions.map((q: any, i: number) => (
        <div key={i} className="space-y-2">
          {q.type === 'cn_to_en' && (
            <>
              <p className="text-sm text-gray-900 dark:text-white font-medium">
                {q.chinese}
              </p>
              {q.hint && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{q.hint}</p>
              )}
              {q.referenceAnswer && (
                <details className="text-xs">
                  <summary className="text-blue-600 dark:text-blue-400 cursor-pointer">参考答案</summary>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">{q.referenceAnswer}</p>
                </details>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
