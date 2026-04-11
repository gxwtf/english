'use server';

import { query as queryDict } from '@/lib/dict/query';
import { DictionaryEntry } from '@/types/dict';

/**
 * Server Action：查询单词
 * @param word 要查询的单词
 * @returns 返回字典条目，如果没找到返回 null
 */
export default async function queryWord(word: string): Promise<DictionaryEntry | null> {
    return queryDict(word);
}