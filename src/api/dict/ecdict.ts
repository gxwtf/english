import * as fs from 'fs';

// --- 接口定义 ---

export interface Meaning {
    content: string; // 一个中文释义
    type: string;    // 单词的词性 (例如: n. / vi. / adj.)
}

export interface DictionaryEntry {
    word: string;
    meaning: Meaning[];
}

// --- 核心类实现 ---

export class DictCsv {
    // 内部存储：Key 为单词小写，Value 为整行 CSV 数据数组
    private dataMap: Map<string, string[]> = new Map();

    // 对应 Python 代码中的列索引（假设 stardict.py 生成的标准 CSV 布局）
    private readonly COL_WORD = 0;
    private readonly COL_TRANSLATION = 3;

    constructor(csvPath: string) {
        this.loadCsv(csvPath);
    }

    /**
     * 解析并加载 CSV 文件到内存
     */
    private loadCsv(path: string) {
        if (!fs.existsSync(path)) return;
        
        const content = fs.readFileSync(path, 'utf-8');
        const lines = content.split(/\r?\n/);

        for (let i = 1; i < lines.length; i++) { // 跳过表头
            const line = lines[i].trim();
            if (!line) continue;

            const row = this.parseCsvLine(line);
            if (row.length > this.COL_TRANSLATION) {
                const word = row[this.COL_WORD].toLowerCase();
                // 如果有重复单词，可以按需决定覆盖或追加，这里采用保留第一个
                if (!this.dataMap.has(word)) {
                    this.dataMap.set(word, row);
                }
            }
        }
    }

    /**
     * 基础 CSV 解析逻辑（处理引号包裹的内容）
     */
    private parseCsvLine(line: string): string[] {
        const result: string[] = [];
        let cur = '';
        let inQuote = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuote = !inQuote;
            else if (char === ',' && !inQuote) {
                result.push(cur);
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur);
        return result;
    }

    /**
     * 复刻 Python 版的 decode 函数，还原转义字符
     */
    private decode(text: string): string {
        if (!text) return '';
        return text
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\\\/g, '\\');
    }

    /**
     * 魔改后的查询函数
     * @param word 英文单词字符串
     */
    public query(word: string): DictionaryEntry | null {
        const key = word.trim().toLowerCase();
        const row = this.dataMap.get(key);

        if (!row) return null;

        const rawTranslation = this.decode(row[this.COL_TRANSLATION]);
        
        return {
            word: row[this.COL_WORD],
            meaning: this.parseTranslationToMeanings(rawTranslation)
        };
    }

    /**
     * 将原始翻译字符串拆解为 Meaning 数组
     * 逻辑：识别行首的词性标记 (如 "n.", "adj.")
     */
    private parseTranslationToMeanings(translation: string): Meaning[] {
        const meanings: Meaning[] = [];
        // 按换行符分割，每一行通常代表一种词性及其解释
        const lines = translation.split('\n');

        // 匹配词性前缀的正则：例如 "n. ", "vi. ", "prep. "
        // 规则：开头是小写字母组成的缩写加点号
        const posRegex = /^([a-z]+\.)\s*(.*)/i;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const match = trimmedLine.match(posRegex);

            if (match) {
                // 情况 A: 匹配到词性前缀
                meanings.push({
                    type: match[1],         // 例如 "n."
                    content: match[2].trim() // 例如 "苹果; 某种零件"
                });
            } else {
                // 情况 B: 没有明确词性前缀（归类为 "def." 或通用）
                meanings.push({
                    type: 'def.', 
                    content: trimmedLine
                });
            }
        }

        return meanings;
    }
}

// --- 使用演示 ---

/*
const dict = new DictCsv('./stardict.csv');
const result = dict.query('apple');

if (result) {
    console.log(JSON.stringify(result, null, 2));
}
*/