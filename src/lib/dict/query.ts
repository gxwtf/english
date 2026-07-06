import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DictCsv } from './ecdict';
import { DictionaryEntry, Meaning } from '@/types/dict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DICT_PATH = path.join(__dirname, '..', '..', 'dict', 'ecdict.csv');

const dict = new DictCsv(DICT_PATH);

export function query(word: string): DictionaryEntry | null {
    const result = dict.query(word);
    if (!result) return null;
    let ret: DictionaryEntry = {
        word: result.word,
        meaning: []
    };
    for (const meaning of result.meaning) {
        const content = meaning.content.trim()
            .replaceAll(';', ',')
            .replaceAll('，', ',')
            .replaceAll('；', ',')
            .replaceAll(' ', '')
            .replace(/(?<!\.)\.(?!\.)/g, ',')  // 替换独立点号，保留省略号 ...
            .split(',')
            .map(c => c.trim())
            .filter(c => c.length > 0);
        for (const c of content) {
            ret.meaning.push({
                type: meaning.type,
                content: c
            });
        }
    }
    return ret;
}