"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hybridQuery = hybridQuery;
exports.syncHybridQuery = syncHybridQuery;
exports.getPhraseSuggestions = getPhraseSuggestions;
const module_1 = require();
from;
'./phrasal-verb-dictionary';
const query_new_1 = require("./query-new");
// 主要的混合查询函数
async function hybridQuery(query) {
    const trimmedQuery = query.trim().toLowerCase();
    // 1. 尝试短语词典
    const phrasalVerbResult = (0, module_1.queryPhrasalVerb)(trimmedQuery);
    if (phrasalVerbResult) {
        const dictionaryResult = (queryPhrasalVerb) => ({}(phrasalVerbResult));
        return {
            word: dictionaryResult.word,
            pronunciation: dictionaryResult.pronunciation,
            meanings: dictionaryResult.meanings.map(m => ({
                ...m,
                source: 'phrasal-verb'
            })),
            confidence: 0.95,
            explanation: '从短语动词词库中找到精确匹配'
        };
    }
    // 2. 如果是短语（包含空格），尝试智能分割查询
    if (trimmedQuery.includes(' ')) {
        const compoundResult = await queryCompoundWord(trimmedQuery);
        if (compoundResult) {
            return compoundResult;
        }
    }
    // 3. 尝试普通词典查询
    try {
        const regularResult = await (0, query_new_1.queryWord)(query);
        if (regularResult.meanings.length > 0) {
            return {
                word: regularResult.word,
                pronunciation: regularResult.pronunciation,
                meanings: regularResult.meanings.map(m => ({
                    ...m,
                    source: 'dictionary'
                })),
                confidence: 0.7,
                explanation: '在普通词典中找到'
            };
        }
    }
    catch (error) {
        console.warn('Dictionary lookup failed:', error);
    }
    // 4. 尝试不同的空格处理方式
    const spaceVariations = generateSpaceVariations(query);
    for (const variation of spaceVariations) {
        try {
            const result = await (0, query_new_1.queryWord)(variation);
            if (result.meanings.length > 0) {
                return {
                    word: result.word,
                    pronunciation: result.pronunciation,
                    meanings: result.meanings.map(m => ({
                        ...m,
                        source: 'dictionary'
                    })),
                    confidence: 0.5,
                    explanation: `通过查询 "${variation}" 找到`
                };
            }
        }
        catch (error) {
            // 继续尝试下一个变体
        }
    }
    // 5. 未找到任何结果
    return {
        word: query,
        pronunciation: '',
        meanings: [],
        confidence: 0,
        explanation: '未找到匹配的释义'
    };
}
// 查询复合词或短语
async function queryCompoundWord(phrase) {
    const words = phrase.split(' ');
    if (words.length < 2)
        return null;
    try {
        // 尝试查找第一个词
        const firstWordResult = await (0, query_new_1.queryWord)(words[0]);
        if (firstWordResult.meanings.length === 0)
            return null;
        // 尝试查找整个短语作为单词
        const phraseResult = await (0, query_new_1.queryWord)(phrase);
        if (phraseResult.meanings.length > 0) {
            return {
                word: phraseResult.word,
                pronunciation: phraseResult.pronunciation,
                meanings: phraseResult.meanings.map(m => ({
                    ...m,
                    source: 'dictionary'
                })),
                confidence: 0.6,
                explanation: `短语 "${phrase}" 在词典中被找到`
            };
        }
        // 如果都没找到，组合含义
        const meanings = [{
                content: `由 "${words[0]}" (${firstWordResult.meanings[0].content}) 和其他词语组成的短语`,
                type: 'phrase',
                sentence: `这是一个包含 "${words.join(' ')}" 的短语或复合词。`,
                source: 'compound'
            }];
        return {
            word: phrase,
            pronunciation: firstWordResult.pronunciation,
            meanings: meanings,
            confidence: 0.3,
            explanation: `通过分析 "${words[0]}" 的含义推断短语含义`
        };
    }
    catch (error) {
        console.warn('Compound query failed:', error);
        return null;
    }
}
// 生成不同的空格处理方式
function generateSpaceVariations(query) {
    const variations = new Set();
    // 1. 原始查询
    variations.add(query);
    // 2. 去掉空格
    const noSpace = query.replace(/\s+/g, '');
    if (noSpace.length > 0) {
        variations.add(noSpace);
    }
    // 3. 不同的空格数量
    variations.add(query.replace(/\s+/g, ' ')); // 单个空格
    variations.add(query.replace(/\s+/g, '  ')); // 双空格
    // 4. 去掉中间空格，保留首尾
    if (query.length > 2) {
        const parts = query.trim().split(/\s+/);
        if (parts.length >= 2) {
            variations.add(parts[0] + ' ' + parts.slice(1).join(''));
            variations.add(parts[0] + parts.slice(1).join(' '));
        }
    }
    return Array.from(variations);
}
// 同步查询函数 - 用于不需要异步的场景
function syncHybridQuery(query) {
    const trimmedQuery = query.trim().toLowerCase();
    // 1. 尝试短语词典
    const phrasalVerbResult = (0, module_1.queryPhrasalVerb)(trimmedQuery);
    if (phrasalVerbResult) {
        const dictionaryResult = (queryPhrasalVerb) => ({}(phrasalVerbResult));
        return {
            word: dictionaryResult.word,
            pronunciation: dictionaryResult.pronunciation,
            meanings: dictionaryResult.meanings.map(m => ({
                ...m,
                source: 'phrasal-verb'
            })),
            confidence: 0.95,
            explanation: '从短语动词词库中找到精确匹配'
        };
    }
    // 2. 返回一个基础结果
    return {
        word: query,
        pronunciation: '',
        meanings: [],
        confidence: 0,
        explanation: '需要异步查询以获得完整结果'
    };
}
// 获取短语建议
function getPhraseSuggestions(input) {
    const normalized = input.toLowerCase().trim();
    const suggestions = new Set();
    // 如果输入包含空格，检查是否与任何短语部分匹配
    if (normalized.includes(' ')) {
        const [verb, ...particles] = normalized.split(' ');
        // 查找以该动词开头的所有短语
        const phrasalVerbs = getRelatedPhrasalVerbs(verb);
        phrasalVerbs.forEach(pv => {
            suggestions.add(`${pv.verb} ${pv.particle}`);
        });
    }
    else {
        // 查找包含该动词的短语
        const phrasalVerbs = getRelatedPhrasalVerbs(input);
        phrasalVerbs.slice(0, 5).forEach(pv => {
            suggestions.add(`${pv.verb} ${pv.particle}`);
        });
        // 查找以该粒子开头的短语（如果输入看起来像粒子）
        if (input.length <= 5) {
            const phrasalVerbs2 = getPhrasalVerbsWithParticle(input);
            phrasalVerbs2.slice(0, 5).forEach(pv => {
                suggestions.add(`${pv.verb} ${pv.particle}`);
            });
        }
    }
    return Array.from(suggestions).slice(0, 10);
}
