import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DictCsv } from './ecdict';
import { DictionaryEntry } from '@/types/dict';

const DICT_FILE_NAME = 'ecdict.csv';
// 词典文件约 65MB，小于该阈值视为占位/损坏文件，避免误加载成空词典
const MIN_DICT_SIZE = 1024 * 1024;

/**
 * 生成词典文件的候选路径。
 *
 * 不能只在模块加载时用 `import.meta.url` 定位：webpack 打包生产版本时会把
 * `import.meta.url` 变成**构建时的绝对源码路径**。如果构建发生在临时目录
 * （例如 CI / 部署脚本先复制到 /tmp/xxx-build 再构建），运行时就找不到该文件，
 * `DictCsv` 会静默加载成空词典，所有查词返回 null（表现为“添加单词时释义列表为空”）。
 *
 * 因此这里以**运行时**的工作目录（生产环境即项目根目录）为主，并保留模块路径、
 * 向上回溯与显式环境变量作为兜底。
 */
function buildCandidatePaths(): string[] {
    const candidates = new Set<string>();
    const add = (candidate: string | undefined | null) => {
        if (!candidate) return;
        candidates.add(path.resolve(candidate));
    };

    const addForRoot = (root: string) => {
        add(path.join(root, 'src', 'dict', DICT_FILE_NAME));
        add(path.join(root, 'dict', DICT_FILE_NAME));
    };

    // 1. 显式配置优先（部署时可用环境变量指向任意位置）
    add(process.env.ECDICT_PATH);

    // 2. 运行时工作目录：生产环境 cwd 为项目根，与构建目录无关
    addForRoot(process.cwd());

    // 3. 当前模块所在目录（开发模式 / 就地构建），兼容 .next/server/chunks 等打包位置
    try {
        const moduleDir = path.dirname(fileURLToPath(import.meta.url));
        add(path.join(moduleDir, '..', '..', 'dict', DICT_FILE_NAME));
        let dir = moduleDir;
        for (let i = 0; i < 6; i++) {
            addForRoot(dir);
            dir = path.dirname(dir);
        }
    } catch {
        // import.meta.url 不可用时忽略，继续使用其它候选路径
    }

    // 4. 从 cwd 向上回溯（cwd 可能位于项目的子目录）
    let cwd = process.cwd();
    for (let i = 0; i < 6; i++) {
        addForRoot(cwd);
        cwd = path.dirname(cwd);
    }

    return [...candidates];
}

function isUsableDictFile(filePath: string): boolean {
    try {
        const stat = fs.statSync(filePath);
        return stat.isFile() && stat.size >= MIN_DICT_SIZE;
    } catch {
        return false;
    }
}

function resolveDictPath(): string | null {
    for (const candidate of buildCandidatePaths()) {
        if (isUsableDictFile(candidate)) return candidate;
    }
    return null;
}

let dict: DictCsv | null = null;
let dictPath: string | null = null;
let resolutionErrorLogged = false;

/**
 * 懒加载词典：首次查词时才读取 CSV。
 * 若首次未找到文件，后续查词会重新尝试解析路径（文件可能稍后才就绪）。
 */
function getDict(): DictCsv | null {
    if (dict) return dict;

    const resolved = resolveDictPath();
    if (!resolved) {
        if (!resolutionErrorLogged) {
            resolutionErrorLogged = true;
            console.error(
                `[dict] 未找到可用的词典文件 ${DICT_FILE_NAME}，查词将返回 null。` +
                `已尝试以下路径：\n${buildCandidatePaths().map((p) => `  - ${p}`).join('\n')}\n` +
                `可通过环境变量 ECDICT_PATH 指定词典文件的绝对路径。`
            );
        }
        return null;
    }

    dictPath = resolved;
    dict = new DictCsv(resolved);
    return dict;
}

/** 当前已加载的词典文件路径；未加载或未找到时为 null（用于诊断） */
export function getLoadedDictPath(): string | null {
    getDict();
    return dictPath;
}

export function query(word: string): DictionaryEntry | null {
    const dictionary = getDict();
    if (!dictionary) return null;

    const result = dictionary.query(word);
    if (!result) return null;
    let ret: DictionaryEntry = {
        word: result.word,
        pronunciation: result.pronunciation,
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
