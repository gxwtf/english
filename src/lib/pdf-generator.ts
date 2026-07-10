import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { PdfQuestionData } from '@/actions/ai-question/pdf';
import type { Word } from '@/types/word';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 15;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;

function mmToPx(mm: number): number {
  return mm * 3.7795275591;
}

function formatFilenameDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * Render question content as HTML for a single question (odd page).
 */
function renderQuestionHtml(q: PdfQuestionData, questionIndex: number): string {
  const content = q.questionContent;
  const questions = content.questions as any[] | undefined;
  const cards = content.cards as any[] | undefined;
  const words = content.words as string[] | undefined;
  const title = content.title as string | undefined;

  let html = '';

  html += `<div class="header">
    <h1>英语练习试卷</h1>
    <p class="subtitle">题目 ${questionIndex + 1}：${q.questionTypeLabel}</p>
  </div>`;

  if (title) {
    html += `<h2 class="section-title">${escapeHtml(title)}</h2>`;
  }

  if (q.questionType === 'fill-blank' || q.questionType === 'definition-fill-blank') {
    // Word bank box at top
    if (words && words.length > 0) {
      html += `<div class="word-bank">
        <p class="word-bank-label">可选单词：</p>
        <p class="word-list-plain">${words.map(w => escapeHtml(w)).join('　　')}</p>
      </div>`;
    }
    if (questions) {
      questions.forEach((item, i) => {
        const sentence = q.questionType === 'fill-blank' ? item.sentence : item.definition;
        html += `<div class="question-item">
          <p class="question-number">第 ${i + 1} 题</p>
          <p class="question-text">${renderBlankSentenceHtml(sentence)}</p>
        </div>`;
      });
    }
  } else if (q.questionType === 'translate') {
    if (questions) {
      questions.forEach((item, i) => {
        html += `<div class="question-item">
          <p class="question-number">第 ${i + 1} 题</p>
          <p class="question-text">${escapeHtml(item.chinese)}</p>
          ${item.keyWords?.length ? `<p class="hint-text">必用单词：${item.keyWords.map((k: string) => escapeHtml(k)).join('、')}</p>` : ''}
          ${item.hint ? `<p class="hint-text">提示：${escapeHtml(item.hint)}</p>` : ''}
          <div class="answer-lines">
            <div class="answer-line"></div>
            <div class="answer-line"></div>
          </div>
        </div>`;
      });
    }
  } else if (q.questionType === 'word-select-translate') {
    // Word bank box at top
    if (words && words.length > 0) {
      html += `<div class="word-bank">
        <p class="word-bank-label">候选单词：</p>
        <p class="word-list-plain">${words.map(w => escapeHtml(w)).join('　　')}</p>
      </div>`;
    }
    if (questions) {
      questions.forEach((item, i) => {
        html += `<div class="question-item">
          <p class="question-number">第 ${i + 1} 题</p>
          <p class="question-text">${escapeHtml(item.chinese)}</p>
          <div class="answer-lines">
            <div class="answer-line"></div>
            <div class="answer-line"></div>
          </div>
        </div>`;
      });
    }
  } else if (q.questionType === 'meaning-select') {
    if (questions) {
      questions.forEach((item, i) => {
        html += `<div class="question-item">
          <p class="question-number">第 ${i + 1} 题</p>
          <p class="question-text">${escapeHtml(item.word)} 的中文释义是？</p>
          ${renderOptionsLayout(item.options)}
        </div>`;
      });
    }
  } else if (q.questionType === 'meaning-select-en') {
    if (questions) {
      questions.forEach((item, i) => {
        html += `<div class="question-item">
          <p class="question-number">第 ${i + 1} 题</p>
          <p class="question-text">${escapeHtml(item.word)} 的英文释义是？</p>
          ${renderOptionsLayout(item.options)}
        </div>`;
      });
    }
  } else if (q.questionType === 'word-card') {
    if (cards) {
      html += `<p class="hint-text">点击卡片翻转查看释义</p>`;
      cards.forEach((card, i) => {
        html += `<div class="card-item">
          <div class="card-front">
            <p class="card-word">${escapeHtml(card.word)}</p>
            <p class="card-hint">正面</p>
          </div>
        </div>`;
      });
    }
  }

  return html;
}

/**
 * Render answer content as HTML for a single question (even page).
 */
function renderAnswerHtml(q: PdfQuestionData, questionIndex: number): string {
  const content = q.questionContent;
  const questions = content.questions as any[] | undefined;
  const cards = content.cards as any[] | undefined;

  let html = '';

  html += `<div class="header">
    <h1>答案与单词释义</h1>
    <p class="subtitle">题目 ${questionIndex + 1}：${q.questionTypeLabel}</p>
  </div>`;

  html += `<h2 class="section-title">参考答案</h2>`;

  if (q.questionType === 'fill-blank' || q.questionType === 'definition-fill-blank') {
    if (questions) {
      questions.forEach((item, i) => {
        const sentence = q.questionType === 'fill-blank' ? item.sentence : item.definition;
        html += `<div class="answer-item">
          <p class="question-number">第 ${i + 1} 题</p>
          <p class="question-text">${renderFilledSentenceHtml(sentence, item.answer)}</p>
        </div>`;
      });
    }
  } else if (q.questionType === 'translate') {
    if (questions) {
      questions.forEach((item, i) => {
        html += `<div class="answer-item">
          <p class="question-number">第 ${i + 1} 题</p>
          <p class="question-text">${escapeHtml(item.chinese)}</p>
          ${item.keyWords?.length ? `<p class="hint-text">必用单词：${item.keyWords.map((k: string) => escapeHtml(k)).join('、')}</p>` : ''}
          <p class="answer-text">${escapeHtml(item.referenceAnswers)}</p>
        </div>`;
      });
    }
  } else if (q.questionType === 'word-select-translate') {
    if (questions) {
      questions.forEach((item, i) => {
        html += `<div class="answer-item">
          <p class="question-number">第 ${i + 1} 题</p>
          <p class="question-text">${escapeHtml(item.chinese)}</p>
          <p class="answer-text">${escapeHtml(item.referenceAnswers)}</p>
        </div>`;
      });
    }
  } else if (q.questionType === 'meaning-select') {
    if (questions) {
      questions.forEach((item, i) => {
        const correctIndex = item.options?.indexOf(item.correctAnswer) ?? -1;
        const correctLetter = correctIndex >= 0 ? ['A', 'B', 'C', 'D'][correctIndex] : '';
        const correctOption = item.correctAnswer || '';
        html += `<div class="answer-item">
          <p class="question-number">第 ${i + 1} 题</p>
          <p class="answer-text">${escapeHtml(item.word)} 的中文释义是：${escapeHtml(correctLetter)}. ${escapeHtml(correctOption)}</p>
        </div>`;
      });
    }
  } else if (q.questionType === 'meaning-select-en') {
    if (questions) {
      questions.forEach((item, i) => {
        const correctIndex = item.options?.indexOf(item.correctAnswer) ?? -1;
        const correctLetter = correctIndex >= 0 ? ['A', 'B', 'C', 'D'][correctIndex] : '';
        const correctOption = item.correctAnswer || '';
        html += `<div class="answer-item">
          <p class="question-number">第 ${i + 1} 题</p>
          <p class="answer-text">${escapeHtml(item.word)} 的英文释义是：${escapeHtml(correctLetter)}. ${escapeHtml(correctOption)}</p>
        </div>`;
      });
    }
  } else if (q.questionType === 'word-card') {
    if (cards) {
      cards.forEach((card, i) => {
        html += `<div class="answer-item">
          <p class="question-number">第 ${i + 1} 题</p>
          <p class="answer-text">${escapeHtml(card.word)}</p>
          <div class="card-meanings">
            ${card.meanings?.map((m: any) => `<p class="meaning-line"><span class="meaning-type">${escapeHtml(m.type)}</span> ${escapeHtml(m.content)}</p>`).join('') || '<p class="meaning-line">暂无释义</p>'}
          </div>
        </div>`;
      });
    }
  }

  // Word meanings section
  if (q.wordMeanings.length > 0) {
    html += `<h2 class="section-title" style="margin-top: 20px;">单词释义</h2>`;
    html += `<div class="word-meanings">`;
    q.wordMeanings.forEach(wm => {
      const sourceLabel = wm.isRelatedWord && wm.sourceWords?.length
        ? `（${wm.sourceWords.join('、')}的关联词）`
        : '';
      html += `<div class="word-meaning-item">
        <span class="wm-word">${escapeHtml(wm.text)}${sourceLabel}：</span>
        <span class="wm-meanings">${wm.meanings.map(m =>
          `<span class="wm-meaning"><span class="wm-type">${escapeHtml(m.type)}</span> ${escapeHtml(m.content)}</span>`
        ).join('；') || '暂无释义'}</span>
      </div>`;
    });
    html += `</div>`;
  }

  return html;
}

function renderBlankSentenceHtml(sentence: string): string {
  if (!sentence) return '';
  return escapeHtml(sentence).replace(/_+/g, '<span class="blank-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>');
}

function renderFilledSentenceHtml(sentence: string, answer: string): string {
  if (!sentence) return '';
  // Replace underscores with the answer
  return escapeHtml(sentence).replace(/_+/g, `<span class="filled-answer">${escapeHtml(answer)}</span>`);
}

/**
 * Render options layout based on text length.
 * - Short options (< 15 chars): 1 row (A  B  C  D)
 * - Medium options (15-40 chars): 2 rows (A  B / C  D)
 * - Long options (> 40 chars): 4 rows (A / B / C / D)
 */
function renderOptionsLayout(options: string[] | undefined): string {
  if (!options || options.length === 0) return '';

  const letters = ['A', 'B', 'C', 'D'];
  const maxLen = Math.max(...options.map(o => o.length));

  if (maxLen < 15) {
    // All short: one row
    return `<p class="options-row">${options.map((opt, j) => `${letters[j]}. ${escapeHtml(opt)}`).join('　　')}</p>`;
  } else if (maxLen <= 40) {
    // Medium: two rows
    const row1 = `${letters[0]}. ${escapeHtml(options[0])}　　${letters[1]}. ${escapeHtml(options[1])}`;
    const row2 = `${letters[2]}. ${escapeHtml(options[2])}　　${letters[3]}. ${escapeHtml(options[3])}`;
    return `<p class="options-row">${row1}</p><p class="options-row">${row2}</p>`;
  } else {
    // Long: four rows
    return options.map((opt, j) => `<p class="options-row">${letters[j]}. ${escapeHtml(opt)}</p>`).join('');
  }
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Black and white styles for PDF
const PDF_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", "Hiragino Sans GB", sans-serif; color: #000; line-height: 1.6; }
  .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #000; }
  .header h1 { font-size: 22px; font-weight: bold; margin-bottom: 4px; }
  .header .subtitle { font-size: 14px; color: #333; }
  .section-title { font-size: 16px; font-weight: bold; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 1px solid #000; }
  .word-bank { margin-bottom: 16px; padding: 10px; border: 1px solid #000; }
  .word-bank-label { font-size: 13px; font-weight: bold; margin-bottom: 6px; }
  .word-list-plain { font-size: 13px; line-height: 2; }
  .question-item { margin-bottom: 16px; padding: 10px 0; border-bottom: 1px solid #ccc; }
  .question-number { font-size: 13px; font-weight: bold; margin-bottom: 4px; }
  .question-text { font-size: 14px; line-height: 1.8; }
  .hint-text { font-size: 12px; color: #333; margin-top: 4px; }
  .blank-line { display: inline-block; min-width: 60px; border-bottom: 1px solid #000; margin: 0 2px; }
  .filled-answer { font-weight: 900; }
  .answer-lines { margin-top: 8px; }
  .answer-line { width: 100%; border-bottom: 1px solid #999; height: 28px; }
  .options-row { font-size: 13px; line-height: 2; margin-top: 4px; }
  .answer-item { margin-bottom: 12px; padding: 6px 0; border-bottom: 1px solid #ccc; }
  .answer-text { font-size: 14px; font-weight: 500; margin-top: 4px; }
  .word-meanings { margin-top: 8px; }
  .word-meaning-item { margin-bottom: 6px; font-size: 13px; line-height: 1.6; }
  .wm-word { font-weight: bold; }
  .wm-meanings { }
  .wm-meaning { }
  .wm-type { font-weight: bold; margin-right: 2px; }
  .card-item { margin-bottom: 16px; padding: 12px; border: 2px solid #000; border-radius: 8px; text-align: center; }
  .card-front { }
  .card-word { font-size: 18px; font-weight: bold; margin-bottom: 8px; }
  .card-hint { font-size: 12px; color: #666; }
  .card-meanings { margin-top: 8px; }
  .meaning-line { font-size: 13px; line-height: 1.6; margin-top: 4px; }
  .meaning-type { font-weight: bold; margin-right: 4px; }
  .card-word-page { display: flex; justify-content: center; align-items: center; height: 600px; }
  .card-word-large { font-size: 48px; font-weight: bold; text-align: center; }
  .card-meaning-page { padding: 20px; }
  .card-word-title { font-size: 32px; font-weight: bold; text-align: center; margin-bottom: 24px; }
  .card-all-meanings { }
`;

function mergeWordMeanings(meanings: Word['meanings']): Array<{ type: string; content: string }> {
  const merged: Record<string, string[]> = {};

  for (const meaning of meanings || []) {
    const type = (meaning.type || '').trim() || '释义';
    const content = (meaning.content || '').trim();
    if (!content) continue;
    if (!merged[type]) merged[type] = [];
    merged[type].push(content);
  }

  return Object.entries(merged).map(([type, contents]) => ({
    type,
    content: contents.join('；'),
  }));
}

const WORDBOOK_FONT = {
  simsunFile: 'simsun.ttf',
  simsunName: 'SimSun',
  timesFile: 'times.ttf',
  timesBoldFile: 'timesbd.ttf',
  timesName: 'TimesNewRoman',
} as const;

const WORDBOOK_VECTOR = {
  columnGap: 8,
  headerBottomY: MARGIN_MM + 12,
  contentTopY: MARGIN_MM + 18,
  contentBottomY: A4_HEIGHT_MM - MARGIN_MM,
  wordSize: 11.2,
  indexSize: 9.2,
  bodySize: 9.5,
  tagSize: 8.2,
  wordLineHeight: 4.7,
  bodyLineHeight: 4.25,
  tagLineHeight: 3.7,
  entryPaddingTop: 1,
  entryPaddingBottom: 1.8,
};

type WordbookFontName = typeof WORDBOOK_FONT.simsunName | typeof WORDBOOK_FONT.timesName;
type WordbookFontStyle = 'normal' | 'bold';

interface WordbookTextRun {
  text: string;
  font: WordbookFontName;
  style: WordbookFontStyle;
  size: number;
}

interface WordbookLine {
  runs: WordbookTextRun[];
  indent: number;
  lineHeight: number;
}

interface WordbookEntryLayout {
  lines: WordbookLine[];
  height: number;
}

interface WordbookPlacedEntry {
  layout: WordbookEntryLayout;
}

type WordbookPageLayout = [WordbookPlacedEntry[], WordbookPlacedEntry[]];

const fontBase64Cache: Record<string, string> = {};

function wordbookColumnWidth(): number {
  return (CONTENT_WIDTH_MM - WORDBOOK_VECTOR.columnGap) / 2;
}

function isCjkChar(char: string): boolean {
  return /[\u2E80-\u9FFF\uF900-\uFAFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF]/.test(char);
}

function compactRuns(runs: WordbookTextRun[]): WordbookTextRun[] {
  const result: WordbookTextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const prev = result[result.length - 1];
    if (prev && prev.font === run.font && prev.style === run.style && prev.size === run.size) {
      prev.text += run.text;
    } else {
      result.push({ ...run });
    }
  }
  return result;
}

function textRuns(
  text: string,
  size: number,
  englishStyle: WordbookFontStyle = 'normal',
): WordbookTextRun[] {
  const runs: WordbookTextRun[] = [];
  let current = '';
  let currentIsCjk: boolean | null = null;

  for (const char of Array.from(text)) {
    const nextIsCjk = isCjkChar(char);
    if (current && nextIsCjk !== currentIsCjk) {
      runs.push({
        text: current,
        font: currentIsCjk ? WORDBOOK_FONT.simsunName : WORDBOOK_FONT.timesName,
        style: currentIsCjk ? 'normal' : englishStyle,
        size,
      });
      current = '';
    }
    current += char;
    currentIsCjk = nextIsCjk;
  }

  if (current && currentIsCjk !== null) {
    runs.push({
      text: current,
      font: currentIsCjk ? WORDBOOK_FONT.simsunName : WORDBOOK_FONT.timesName,
      style: currentIsCjk ? 'normal' : englishStyle,
      size,
    });
  }

  return compactRuns(runs);
}

function setWordbookFont(pdf: jsPDF, run: WordbookTextRun): void {
  pdf.setFont(run.font, run.font === WORDBOOK_FONT.simsunName ? 'normal' : run.style);
  pdf.setFontSize(run.size);
}

function measureRun(pdf: jsPDF, run: WordbookTextRun): number {
  setWordbookFont(pdf, run);
  return pdf.getTextWidth(run.text);
}

function tokenizeRun(run: WordbookTextRun): WordbookTextRun[] {
  if (run.font === WORDBOOK_FONT.simsunName) {
    return Array.from(run.text).map((text) => ({ ...run, text }));
  }

  const parts = run.text.match(/\S+\s*|\s+/g) ?? [];
  return parts.map((text) => ({ ...run, text }));
}

function wrapWordbookRuns(
  pdf: jsPDF,
  runs: WordbookTextRun[],
  maxWidth: number,
  indent: number,
  lineHeight: number,
): WordbookLine[] {
  const lines: WordbookLine[] = [];
  let current: WordbookTextRun[] = [];
  let currentWidth = 0;
  const availableWidth = Math.max(8, maxWidth - indent);

  const pushLine = () => {
    const cleanRuns = compactRuns(current).map((run, index) => (
      index === 0 ? { ...run, text: run.text.replace(/^\s+/, '') } : run
    )).filter((run) => run.text.length > 0);
    if (cleanRuns.length > 0) {
      lines.push({ runs: cleanRuns, indent, lineHeight });
    }
    current = [];
    currentWidth = 0;
  };

  for (const run of runs) {
    for (const token of tokenizeRun(run)) {
      const tokenWidth = measureRun(pdf, token);
      if (current.length > 0 && currentWidth + tokenWidth > availableWidth) {
        pushLine();
      }

      if (tokenWidth > availableWidth) {
        for (const char of Array.from(token.text)) {
          const charRun = { ...token, text: char };
          const charWidth = measureRun(pdf, charRun);
          if (current.length > 0 && currentWidth + charWidth > availableWidth) {
            pushLine();
          }
          current.push(charRun);
          currentWidth += charWidth;
        }
      } else {
        current.push(token);
        currentWidth += tokenWidth;
      }
    }
  }

  pushLine();
  return lines;
}

function layoutWordbookEntry(pdf: jsPDF, word: Word, index: number, columnWidth: number): WordbookEntryLayout {
  const lines: WordbookLine[] = [];
  const bodyIndent = 8.7;
  const headRuns: WordbookTextRun[] = [
    { text: `${index}. `, font: WORDBOOK_FONT.timesName, style: 'normal', size: WORDBOOK_VECTOR.indexSize },
    ...textRuns(word.text, WORDBOOK_VECTOR.wordSize, 'bold'),
  ];

  lines.push(...wrapWordbookRuns(pdf, headRuns, columnWidth, 0, WORDBOOK_VECTOR.wordLineHeight));

  const meanings = mergeWordMeanings(word.meanings);
  if (meanings.length > 0) {
    for (const meaning of meanings) {
      const runs = [
        ...textRuns(`${meaning.type} `, WORDBOOK_VECTOR.bodySize, 'bold'),
        ...textRuns(meaning.content, WORDBOOK_VECTOR.bodySize),
      ];
      lines.push(...wrapWordbookRuns(pdf, runs, columnWidth, bodyIndent, WORDBOOK_VECTOR.bodyLineHeight));
    }
  } else {
    lines.push(...wrapWordbookRuns(
      pdf,
      textRuns('暂无释义', WORDBOOK_VECTOR.bodySize),
      columnWidth,
      bodyIndent,
      WORDBOOK_VECTOR.bodyLineHeight,
    ));
  }

  if (word.relatedWords.length > 0) {
    const related = word.relatedWords.map((rw) => rw.text).join('、');
    lines.push(...wrapWordbookRuns(
      pdf,
      textRuns(`关联：${related}`, WORDBOOK_VECTOR.tagSize),
      columnWidth,
      bodyIndent,
      WORDBOOK_VECTOR.tagLineHeight,
    ));
  }

  const textHeight = lines.reduce((sum, line) => sum + line.lineHeight, 0);
  return {
    lines,
    height: WORDBOOK_VECTOR.entryPaddingTop + textHeight + WORDBOOK_VECTOR.entryPaddingBottom,
  };
}

function paginateWordbookEntries(entries: WordbookEntryLayout[]): WordbookPageLayout[] {
  const pages: WordbookPageLayout[] = [[[], []]];
  let page = pages[0];
  let columnIndex: 0 | 1 = 0;
  let y = WORDBOOK_VECTOR.contentTopY;

  for (const layout of entries) {
    if (
      page[columnIndex].length > 0 &&
      y + layout.height > WORDBOOK_VECTOR.contentBottomY
    ) {
      if (columnIndex === 0) {
        columnIndex = 1;
        y = WORDBOOK_VECTOR.contentTopY;
      } else {
        page = [[], []];
        pages.push(page);
        columnIndex = 0;
        y = WORDBOOK_VECTOR.contentTopY;
      }
    }

    page[columnIndex].push({ layout });
    y += layout.height;
  }

  return pages;
}

function drawWordbookHeader(pdf: jsPDF, pageIndex: number, totalPages: number, totalWords: number): void {
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.35);
  pdf.line(MARGIN_MM, WORDBOOK_VECTOR.headerBottomY, A4_WIDTH_MM - MARGIN_MM, WORDBOOK_VECTOR.headerBottomY);

  pdf.setTextColor(0);
  pdf.setFont(WORDBOOK_FONT.simsunName, 'normal');
  pdf.setFontSize(18);
  pdf.text('单词本', MARGIN_MM, MARGIN_MM + 7.2);

  const metaRuns = [
    ...textRuns(`共 ${totalWords} 词 · 第 `, 10),
    { text: `${pageIndex + 1} / ${totalPages}`, font: WORDBOOK_FONT.timesName, style: 'bold' as const, size: 10 },
    ...textRuns(' 页', 10),
  ];
  const metaWidth = metaRuns.reduce((sum, run) => sum + measureRun(pdf, run), 0);
  let x = A4_WIDTH_MM - MARGIN_MM - metaWidth;
  const y = MARGIN_MM + 6.8;
  for (const run of metaRuns) {
    setWordbookFont(pdf, run);
    pdf.text(run.text, x, y);
    x += measureRun(pdf, run);
  }
}

function drawWordbookLine(pdf: jsPDF, line: WordbookLine, x: number, baselineY: number): void {
  let runX = x + line.indent;
  for (const run of line.runs) {
    setWordbookFont(pdf, run);
    pdf.text(run.text, runX, baselineY);
    runX += measureRun(pdf, run);
  }
}

function drawWordbookPage(pdf: jsPDF, page: WordbookPageLayout, pageIndex: number, totalPages: number, totalWords: number): void {
  drawWordbookHeader(pdf, pageIndex, totalPages, totalWords);

  const columnWidth = wordbookColumnWidth();
  for (let columnIndex = 0; columnIndex < page.length; columnIndex++) {
    const entries = page[columnIndex];
    const x = MARGIN_MM + columnIndex * (columnWidth + WORDBOOK_VECTOR.columnGap);
    let y = WORDBOOK_VECTOR.contentTopY;

    for (const entry of entries) {
      y += WORDBOOK_VECTOR.entryPaddingTop;
      for (const line of entry.layout.lines) {
        const baselineY = y + line.lineHeight * 0.73;
        drawWordbookLine(pdf, line, x, baselineY);
        y += line.lineHeight;
      }
      y += WORDBOOK_VECTOR.entryPaddingBottom - 0.8;
      pdf.setDrawColor(225);
      pdf.setLineWidth(0.15);
      pdf.line(x, y, x + columnWidth, y);
      y += 0.8;
    }
  }
}

async function fetchFontBase64(url: string): Promise<string> {
  if (fontBase64Cache[url]) return fontBase64Cache[url];

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`字体加载失败：${url}`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  const base64 = btoa(binary);
  fontBase64Cache[url] = base64;
  return base64;
}

async function registerWordbookFonts(pdf: jsPDF): Promise<void> {
  const [simsun, times, timesBold] = await Promise.all([
    fetchFontBase64(`/fonts/${WORDBOOK_FONT.simsunFile}`),
    fetchFontBase64(`/fonts/${WORDBOOK_FONT.timesFile}`),
    fetchFontBase64(`/fonts/${WORDBOOK_FONT.timesBoldFile}`),
  ]);

  pdf.addFileToVFS(WORDBOOK_FONT.simsunFile, simsun);
  pdf.addFont(WORDBOOK_FONT.simsunFile, WORDBOOK_FONT.simsunName, 'normal');
  pdf.addFileToVFS(WORDBOOK_FONT.timesFile, times);
  pdf.addFont(WORDBOOK_FONT.timesFile, WORDBOOK_FONT.timesName, 'normal');
  pdf.addFileToVFS(WORDBOOK_FONT.timesBoldFile, timesBold);
  pdf.addFont(WORDBOOK_FONT.timesBoldFile, WORDBOOK_FONT.timesName, 'bold');
}

/**
 * 单词卡片 - 奇数页：单词（粗体，居中）
 */
function renderWordCardWordHtml(card: any, cardIndex: number): string {
  return `
    <div class="header">
      <h1>单词卡片</h1>
      <p class="subtitle">第 ${cardIndex + 1} 张卡片</p>
    </div>
    <div class="card-word-page">
      <p class="card-word-large">${escapeHtml(card.word)}</p>
    </div>
  `;
}

/**
 * 单词卡片 - 偶数页：单词 + 所有释义（合并相同词性）
 */
function renderWordCardMeaningHtml(card: any, cardIndex: number): string {
  const meanings = card.meanings || [];
  // 合并相同词性的释义
  const merged: Record<string, string[]> = {};
  for (const m of meanings) {
    const type = m.type || '';
    if (!merged[type]) {
      merged[type] = [];
    }
    merged[type].push(m.content);
  }
  const mergedMeanings = Object.entries(merged).map(([type, contents]) => ({
    type,
    content: contents.join('; '),
  }));

  return `
    <div class="header">
      <h1>单词卡片</h1>
      <p class="subtitle">第 ${cardIndex + 1} 张卡片 - 释义</p>
    </div>
    <div class="card-meaning-page">
      <p class="card-word-title">${escapeHtml(card.word)}</p>
      <div class="card-all-meanings">
        ${mergedMeanings.length > 0
          ? mergedMeanings.map((m: any) => `<p class="meaning-line"><span class="meaning-type">${escapeHtml(m.type)}</span> ${escapeHtml(m.content)}</p>`).join('')
          : '<p class="meaning-line">暂无释义</p>'
        }
      </div>
    </div>
  `;
}

export async function generateWordbookPdf(words: Word[]): Promise<void> {
  if (words.length === 0) return;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    putOnlyUsedFonts: true,
    compress: true,
  });

  await registerWordbookFonts(pdf);
  pdf.setProperties({
    title: '广学英语单词本',
    subject: '单词本',
    creator: '广学英语',
  });

  const columnWidth = wordbookColumnWidth();
  const entries = words.map((word, index) => layoutWordbookEntry(pdf, word, index + 1, columnWidth));
  const pages = paginateWordbookEntries(entries);

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) {
      pdf.addPage();
    }
    drawWordbookPage(pdf, pages[i], i, pages.length, words.length);
  }

  pdf.save(`广学英语单词本_${formatFilenameDate()}.pdf`);
}

export interface WritingEntryPdf {
  id: number;
  content: string;
  note: string | null;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export async function generateWritingEntriesPdf(entries: WritingEntryPdf[]): Promise<void> {
  if (entries.length === 0) return;

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    putOnlyUsedFonts: true,
    compress: true,
  });

  await registerWordbookFonts(pdf);
  pdf.setProperties({
    title: '广学英语作文积累本',
    subject: '作文积累本',
    creator: '广学英语',
  });

  const columnWidth = wordbookColumnWidth();
  const layouts = entries.map((entry, index) => layoutWritingEntry(pdf, entry, index + 1, columnWidth));
  const pages = paginateWordbookEntries(layouts);

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) {
      pdf.addPage();
    }
    drawWritingEntriesPage(pdf, pages[i], i, pages.length, entries.length);
  }

  pdf.save(`广学英语作文积累本_${formatFilenameDate()}.pdf`);
}

function layoutWritingEntry(pdf: jsPDF, entry: WritingEntryPdf, index: number, columnWidth: number): WordbookEntryLayout {
  const lines: WordbookLine[] = [];
  const bodyIndent = 8.7;

  // 标题：序号 + 内容
  const headRuns: WordbookTextRun[] = [
    { text: `${index}. `, font: WORDBOOK_FONT.timesName, style: 'normal', size: WORDBOOK_VECTOR.indexSize },
    ...textRuns(entry.content, WORDBOOK_VECTOR.wordSize, 'bold'),
  ];
  lines.push(...wrapWordbookRuns(pdf, headRuns, columnWidth, 0, WORDBOOK_VECTOR.wordLineHeight));

  // 备注（如果有）
  if (entry.note && entry.note.trim()) {
    const noteRuns = textRuns(entry.note, WORDBOOK_VECTOR.bodySize);
    lines.push(...wrapWordbookRuns(pdf, noteRuns, columnWidth, bodyIndent, WORDBOOK_VECTOR.bodyLineHeight));
  }

  // 标签（如果有）
  if (entry.tags.length > 0) {
    const tags = entry.tags.join('、');
    const tagRuns = textRuns(`标签：${tags}`, WORDBOOK_VECTOR.tagSize);
    lines.push(...wrapWordbookRuns(pdf, tagRuns, columnWidth, bodyIndent, WORDBOOK_VECTOR.tagLineHeight));
  }

  const textHeight = lines.reduce((sum, line) => sum + line.lineHeight, 0);
  return {
    lines,
    height: WORDBOOK_VECTOR.entryPaddingTop + textHeight + WORDBOOK_VECTOR.entryPaddingBottom,
  };
}

function drawWritingEntriesPage(pdf: jsPDF, page: WordbookPageLayout, pageIndex: number, totalPages: number, totalEntries: number): void {
  // 绘制标题和页码
  pdf.setDrawColor(0);
  pdf.setLineWidth(0.35);
  pdf.line(MARGIN_MM, WORDBOOK_VECTOR.headerBottomY, A4_WIDTH_MM - MARGIN_MM, WORDBOOK_VECTOR.headerBottomY);

  pdf.setTextColor(0);
  pdf.setFont(WORDBOOK_FONT.simsunName, 'normal');
  pdf.setFontSize(18);
  pdf.text('作文积累本', MARGIN_MM, MARGIN_MM + 7.2);

  const metaRuns = [
    ...textRuns(`共 ${totalEntries} 条 · 第 `, 10),
    { text: `${pageIndex + 1} / ${totalPages}`, font: WORDBOOK_FONT.timesName, style: 'bold' as const, size: 10 },
    ...textRuns(' 页', 10),
  ];
  const metaWidth = metaRuns.reduce((sum, run) => sum + measureRun(pdf, run), 0);
  let x = A4_WIDTH_MM - MARGIN_MM - metaWidth;
  const y = MARGIN_MM + 6.8;
  for (const run of metaRuns) {
    setWordbookFont(pdf, run);
    pdf.text(run.text, x, y);
    x += measureRun(pdf, run);
  }

  // 绘制内容
  for (let columnIndex = 0; columnIndex < page.length; columnIndex++) {
    const entries = page[columnIndex];
    const x = MARGIN_MM + columnIndex * (wordbookColumnWidth() + WORDBOOK_VECTOR.columnGap);
    let y = WORDBOOK_VECTOR.contentTopY;

    for (const entry of entries) {
      y += WORDBOOK_VECTOR.entryPaddingTop;
      for (const line of entry.layout.lines) {
        const baselineY = y + line.lineHeight * 0.73;
        drawWordbookLine(pdf, line, x, baselineY);
        y += line.lineHeight;
      }
      y += WORDBOOK_VECTOR.entryPaddingBottom - 0.8;
      pdf.setDrawColor(225);
      pdf.setLineWidth(0.15);
      pdf.line(x, y, x + wordbookColumnWidth(), y);
      y += 0.8;
    }
  }
}

export async function generatePdf(questionsData: PdfQuestionData[]): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const contentWidthPx = mmToPx(CONTENT_WIDTH_MM);
  const contentHeightPx = mmToPx(A4_HEIGHT_MM - MARGIN_MM * 2);

  for (let i = 0; i < questionsData.length; i++) {
    const q = questionsData[i];

    // Word-card: 特殊处理，每个卡片生成奇偶两页
    if (q.questionType === 'word-card') {
      const cards = q.questionContent.cards as any[] || [];
      for (let j = 0; j < cards.length; j++) {
        const card = cards[j];
        // 奇数页：单词（粗体，居中）
        const wordHtml = renderWordCardWordHtml(card, j);
        await addPageFromHtml(pdf, wordHtml, contentWidthPx, contentHeightPx, i > 0 || j > 0);
        // 偶数页：单词 + 所有释义
        const meaningHtml = renderWordCardMeaningHtml(card, j);
        await addPageFromHtml(pdf, meaningHtml, contentWidthPx, contentHeightPx, true);
      }
    } else {
      // Odd page: question
      const questionHtml = renderQuestionHtml(q, i);
      await addPageFromHtml(pdf, questionHtml, contentWidthPx, contentHeightPx, i > 0);

      // Even page: answer + word meanings
      const answerHtml = renderAnswerHtml(q, i);
      await addPageFromHtml(pdf, answerHtml, contentWidthPx, contentHeightPx, true);
    }
  }

  pdf.save(`广学英语_${formatFilenameDate()}.pdf`);
}

async function addPageFromHtml(
  pdf: jsPDF,
  htmlContent: string,
  widthPx: number,
  heightPx: number,
  newPage: boolean,
  styles = PDF_STYLES,
): Promise<void> {
  // Use an iframe to isolate rendering from the main page's CSS
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = `${widthPx}px`;
  iframe.style.height = `${heightPx + 40}px`;
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  try {
    const iframeDoc = iframe.contentDocument!;
    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html><html><head><style>${styles}</style></head><body style="margin:0;padding:20px;background:white;"><div style="width:${widthPx - 40}px;">${htmlContent}</div></body></html>`);
    iframeDoc.close();

    const container = iframeDoc.body;

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: widthPx,
      windowWidth: widthPx,
      logging: false,
    });

    if (newPage) {
      pdf.addPage();
    }

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', MARGIN_MM, MARGIN_MM, CONTENT_WIDTH_MM, A4_HEIGHT_MM - MARGIN_MM * 2);
  } finally {
    document.body.removeChild(iframe);
  }
}
