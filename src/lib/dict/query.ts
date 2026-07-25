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
    const parenPlaceholder = (text: string): [string, string[]] => {
        const placeholders: string[] = [];
        const result = text.replace(/（[^）]*）/g, (match) => {
            placeholders.push(match);
            return `\x00PAREN${placeholders.length - 1}\x01`;
        });
        return [result, placeholders];
    };
    const restoreParen = (text: string, placeholders: string[]): string => {
        return text.replace(/\x00PAREN(\d+)\x01/g, (_, i) => placeholders[parseInt(i)]);
    };

    for (const meaning of result.meaning) {
        const [protectedText, placeholders] = parenPlaceholder(meaning.content.trim());
        const content = protectedText
            .replaceAll(';', ',')
            .replaceAll('，', ',')
            .replaceAll('；', ',')
            .replaceAll(' ', '')
            .replace(/(?<!\.)\.(?!\.)/g, ',')  // 替换独立点号，保留省略号 ...
            .split(',')
            .map(c => restoreParen(c.trim(), placeholders))
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