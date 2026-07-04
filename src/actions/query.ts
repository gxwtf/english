'use server';

import { connection } from 'next/server';
import { query as queryDict } from '@/lib/dict/query';
import { DictionaryEntry } from '@/types/dict';

/**
 * Server Action：查询单词
 * @param word 要查询的单词
 * @returns 返回字典条目，如果没找到返回 null
 */
export default async function queryWord(word: string): Promise<DictionaryEntry | null> {
    // 防止 Next.js 缓存 server action 结果，避免批量查询时返回前一次的结果
    connection();
    return queryDict(word);
}