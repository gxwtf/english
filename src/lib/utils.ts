import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 检查选项是否已存在于释义列表中（用于验证干扰选项）。
 * meaning-select 和 meaning-select-en 共用。
 *
 * 匹配规则：
 * - 完全匹配：选项和释义完全相同
 * - 释义完全包含选项：释义是"打平、压平"，选项是"打平" → 匹配
 * - 不匹配 substring 包含：选项是"打倒"，释义是"打平" → 不匹配（因为"打"只是部分重叠）
 */
export function isOptionInMeanings(option: string, meanings: string[]): boolean {
  const normalizedOption = option.toLowerCase().trim();
  return meanings.some(m => {
    const normalizedMeaning = m.toLowerCase().trim();
    // 完全匹配
    if (normalizedOption === normalizedMeaning) return true;
    // 释义中的每个分词（逗号分隔）是否与选项完全匹配
    const meaningParts = normalizedMeaning.split(/[，,、；;]/).map(p => p.trim());
    return meaningParts.some(part => part === normalizedOption);
  });
}
