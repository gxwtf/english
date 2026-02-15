// 查询词典的 API
// Author: wchengk09

import MDict from 'mdict-js';
import parse, { DictionaryEntry } from './parse-html';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DICT_PATH = path.join(__dirname, '..', '..', 'dict', 'niujin.mdx');

const dict = new MDict(DICT_PATH);

/**
 * 查询一个单词的函数
 * @param word 要查询的单词
 * @returns 返回下列 JSON 格式的信息：
 * {
    "word": "某个英文单词",
    "pronunciation": "这个单词的音标",
    "meanings": [
        {
            "content": "中文释义 1",
            "type": "词性 1",
            "sentence": "例句 1"
        },
        {
            "content": "中文释义 2",
            "type": "词性 2",
            "sentence": "例句 2"
        },
        ...
    ]
 */
export default function query(word: string): DictionaryEntry{
    let result = dict.lookup(word);
    return parse(result.definition);
}