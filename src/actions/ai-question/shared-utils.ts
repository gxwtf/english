/**
 * 共享工具函数（不含 'use server'，可导出同步函数）
 */

import { parseThinkingContent } from '@/lib/openai';

/**
 * 从 AI 返回的内容中提取 JSON 对象，处理各种格式问题。
 * 支持：thinking 标签、代码块包裹、类型修复（int/number/float）、字段提取回退。
 */
export function extractJSONFromAIContent(rawContent: string, requiredFields: string[] = []): any {
  let content = rawContent.trim();

  // 解析 <reason> 标签
  const parsed = parseThinkingContent(content);
  content = parsed.content.trim();

  // 尝试从代码块中提取
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    content = fenceMatch[1].trim();
  } else if (requiredFields.length > 0) {
    // 查找包含所有必需字段的 JSON
    const fieldPattern = requiredFields.map(f => `"${f}"`).join('[\\s\\S]*');
    const strictMatch = content.match(new RegExp(`\\{[\\s\\S]*${fieldPattern}[\\s\\S]*\\}`));
    if (strictMatch) {
      content = strictMatch[0];
    } else {
      // 宽松匹配：包含任意一个必需字段
      const looseField = requiredFields[0];
      const looseMatch = content.match(new RegExp(`\\{[\\s\\S]*"${looseField}"[\\s\\S]*\\}`));
      if (looseMatch) content = looseMatch[0];
    }
  }

  // 修复类型名替换为实际值
  content = content.replace(/: *int([ ,}])/g, ': 0$1');
  content = content.replace(/: *number([ ,}])/g, ': 0$1');
  content = content.replace(/: *float([ ,}])/g, ': 0$1');
  // 修复 "..." 无效内容
  content = content.replace(/"[^"]*\.\.\.[^"]*"/g, '""');

  try {
    return JSON.parse(content);
  } catch (e) {
    // 尝试从内容中逐字段提取
    if (requiredFields.length > 0) {
      const extracted: Record<string, unknown> = {};
      let allFound = true;
      for (const field of requiredFields) {
        const strMatch = content.match(new RegExp(`"${field}" *: *"([^"]*)"`));
        const numMatch = content.match(new RegExp(`"${field}" *: *(\\d+|int|number|float)`));
        if (strMatch) extracted[field] = strMatch[1];
        else if (numMatch) extracted[field] = parseInt(numMatch[1]) || 0;
        else { allFound = false; break; }
      }
      if (allFound) return extracted;
    }

    // 最后尝试：匹配任何 JSON 对象
    const anyJsonMatch = content.match(/\{[\s\S]*\}/);
    if (anyJsonMatch) {
      try { return JSON.parse(anyJsonMatch[0]); } catch {}
    }

    throw new Error(`AI 返回的内容不是合法 JSON: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * 将生成参数（n, m）嵌入 relatedWordEntries 数组，以便重试时恢复。
 * 使用 _genOptions 标记，避免污染实际关联词数据。
 */
export function embedGenerationOptions(relatedWordEntries: object[] | undefined | null, options: { n: number; m: number }): object[] {
  const enriched = [...(relatedWordEntries || [])];
  (enriched as any[]).push({ _genOptions: true, n: options.n, m: options.m });
  return enriched;
}

/**
 * 从 relatedWordEntries 中提取之前嵌入的生成参数。
 * 如果未找到嵌入的参数，返回 null（兼容历史数据）。
 */
export function extractGenerationOptions(relatedWordEntries: object[] | undefined | null): { n: number; m: number } | null {
  if (!relatedWordEntries || !Array.isArray(relatedWordEntries)) return null;
  const marker = (relatedWordEntries as any[]).find((entry: any) => entry._genOptions === true);
  if (marker && typeof marker.n === 'number' && typeof marker.m === 'number') {
    return { n: marker.n, m: marker.m };
  }
  return null;
}
