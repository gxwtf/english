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
    let ret: DictionaryEntry = {
        word: word,
        meaning: []
    };
    if (!result)return null;
    for (const meaning of result.meaning) {
        const content = meaning.content.trim().replaceAll(';', ',').replaceAll('，', ',').replaceAll('；', '.').replaceAll(' ','').replaceAll('.',',').split(',');
        for (const c of content) {
            ret.meaning.push({
                type: meaning.type,
                content: c.trim()
            });
        }
    }
    return ret;
}