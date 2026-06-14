import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 检查选项是否已存在于释义列表中（用于验证干扰选项）。
 * meaning-select 和 meaning-select-en 共用。
 */
export function isOptionInMeanings(option: string, meanings: string[]): boolean {
  const normalizedOption = option.toLowerCase().trim();
  return meanings.some(m => {
    const normalizedMeaning = m.toLowerCase().trim();
    return normalizedOption === normalizedMeaning ||
           normalizedOption.includes(normalizedMeaning) ||
           normalizedMeaning.includes(normalizedOption);
  });
}
