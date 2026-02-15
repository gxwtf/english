"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.multiStrategyQuery = multiStrategyQuery;
exports.smartQueryPhrase = smartQueryPhrase;
exports.processUserInput = processUserInput;
// 查询增强器 - 支持多种查询策略
const query_new_1 = require("./query-new");
const phrasal_verb_dictionary_1 = require("./phrasal-verb-dictionary");
// 拼写变体生成器
function generateSpellingVariants(word) {
    const variants = [];
    const lowerWord = word.toLowerCase();
    // 1. 原始形式
    variants.push(word);
    // 2. 小写形式
    variants.push(lowerWord);
    // 3. 去掉末尾的空格
    if (word.endsWith(' ')) {
        variants.push(word.trim());
        variants.push(lowerWord.trim());
    }
    // 4. 加空格（针对没有空格的短语）
    if (!word.includes(' ')) {
        const commonPhrasalVerbs = [
            'turn on', 'turn off', 'turn up', 'turn down',
            'put on', 'put off', 'put up with',
            'look up', 'look after', 'look forward to',
            'get up', 'get over', 'get along with',
            'take off', 'take out',
            'give up', 'give in',
            'come across', 'come up with',
            'run into', 'run away',
            'break down', 'break up'
        ];
        for (const phrasalVerb of commonPhrasalVerbs) {
            if (phrasalVerb.toLowerCase().includes(lowerWord)) {
                variants.push(phrasalVerb);
            }
        }
    }
    // 5. 空格处理变体
    const spaceVariants = word.replace(/\s+/g, ' ');
    if (spaceVariants !== word) {
        variants.push(spaceVariants);
        variants.push(spaceVariants.toLowerCase());
    }
    // 6. 连字符形式变体
    const hyphenated = word.replace(/\s+/g, '-');
    if (hyphenated !== word) {
        variants.push(hyphenated);
    }
    return [...new Set(variants)];
}
// 多策略查询
async function multiStrategyQuery(query) {
    var _a, _b;
    const strategies = [];
    const suggestions = [];
    const alternatives = [];
    // 生成所有查询变体
    const queryVariants = generateSpellingVariants(query);
    // Strategy 1: 直接查询短语词库
    for (const variant of queryVariants) {
        const phrasalVerb = (0, phrasal_verb_dictionary_1.queryPhrasalVerb)(variant);
        if (phrasalVerb) {
            const result = {
                word: variant,
                pronunciation: '',
                meanings: [{
                        content: phrasalVerb.meaning,
                        type: phrasalVerb.type,
                        sentence: phrasalVerb.examples[0] || phrasalVerb.meaning
                    }]
            };
            strategies.push({
                name: 'phrase-dictionary-exact',
                query: variant,
                score: 0.95,
                result
            });
            // 如果已经找到最高匹配，可以提前返回
            if (variant === query) {
                return {
                    mainResult: result,
                    strategies,
                    suggestions,
                    alternatives,
                    confidence: 0.95
                };
            }
        }
    }
    // Strategy 2: 尝试每个变体进行词典查询
    for (const variant of queryVariants) {
        try {
            const result = await (0, query_new_1.queryWord)(variant);
            if (result.meanings.length > 0) {
                const score = variant === query ? 0.8 : 0.6;
                strategies.push({
                    name: 'dictionary-lookup',
                    query: variant,
                    score,
                    result
                });
                // 如果是原始查询且有结果，设为主要结果
                if (variant === query) {
                    suggestions.push(`在词典中找到 "${variant}"，但可能不是短语动词`);
                }
            }
        }
        catch (error) {
            console.warn(`Query failed for "${variant}":`, error);
        }
    }
    // Strategy 3: 查询动词 + 介词/副词的组合
    if (query.includes(' ')) {
        const [verb, ...parts] = query.split(' ');
        const particle = parts.join(' ');
        try {
            // 查询动词
            const verbResult = await (0, query_new_1.queryWord)(verb);
            // 查询介词/副词
            const particleResult = await (0, query_new_1.queryWord)(particle);
            if (verbResult.meanings.length > 0 && particleResult.meanings.length > 0) {
                strategies.push({
                    name: 'compound-verbs',
                    query,
                    score: 0.4,
                    result: {
                        word: query,
                        pronunciation: verbResult.pronunciation,
                        meanings: [{
                                content: `由 "${verb}" 和 "${particle}" 组合的短语动词`,
                                type: 'phrase-verb',
                                sentence: `This phrase combines the meanings of "${verb}" and "${particle}".`
                            }]
                    }
                });
                suggestions.push(`考虑分别查询单词: "${verb}" 和 "${particle}"`);
            }
        }
        catch (error) {
            console.warn('Compound analysis failed:', error);
        }
    }
    // Strategy 4: 查找相关短语建议
    if (query.includes(' ')) {
        const [verb, ...parts] = query.split(' ');
        const related = (0, phrasal_verb_dictionary_1.getRelatedPhrasalVerbs)(verb);
        if (related.length > 0) {
            suggestions.push(`考虑查看这些相关短语: ${related.slice(0, 3).map(r => r.phrase).join(', ')}`);
        }
    }
    // Strategy 5: 基于相似度的模糊匹配
    const similarPhrases = findSimilarPhrases(query);
    alternatives.push(...similarPhrases);
    // 排序策略并选择最佳结果
    strategies.sort((a, b) => b.score - a.score);
    const mainResult = (_a = strategies[0]) === null || _a === void 0 ? void 0 : _a.result;
    const confidence = ((_b = strategies[0]) === null || _b === void 0 ? void 0 : _b.score) || 0;
    return {
        mainResult,
        strategies,
        suggestions,
        alternatives,
        confidence
    };
}
// 模糊匹配查找相似短语
function findSimilarPhrases(query) {
    const matches = [];
    const lowerQuery = query.toLowerCase();
    // 查找相似的动词
    const commonVerbs = [
        'turn', 'put', 'look', 'get', 'take', 'give', 'come', 'run', 'break',
        'go', 'make', 'do', 'have', 'say', 'be', 'know', 'think', 'see'
    ];
    // 查找相似的介词/副词
    const commonParticles = [
        'on', 'off', 'up', 'down', 'in', 'out', 'away', 'back', 'through',
        'over', 'under', 'around', 'about', 'across', 'along'
    ];
    // 找出相似的动词
    const verbs = commonVerbs.filter(verb => lowerQuery.startsWith(verb));
    const particles = commonParticles.filter(particle => lowerQuery.includes(' ' + particle));
    // 生成相似短语
    verbs.forEach(verb => {
        particles.forEach(particle => {
            const phrase = verb + ' ' + particle;
            if (phrase !== query && (0, phrasal_verb_dictionary_1.queryPhrasalVerb)(phrase)) {
                matches.push(phrase);
            }
        });
    });
    return matches.slice(0, 5);
}
// 智能短语查询入口
async function smartQueryPhrase(query) {
    // 1. 优先尝试短语词库
    const phrasalVerb = (0, phrasal_verb_dictionary_1.queryPhrasalVerb)(query);
    if (phrasalVerb) {
        return {
            word: query,
            pronunciation: '',
            meanings: [{
                    content: phrasalVerb.meaning,
                    type: phrasalVerb.type,
                    sentence: phrasalVerb.examples[0] || phrasalVerb.meaning
                }]
        };
    }
    // 2. 使用多策略查询
    const result = await multiStrategyQuery(query);
    if (result.confidence > 0.3 && result.mainResult) {
        return result.mainResult;
    }
    return null;
}
// 用户输入处理
function processUserInput(input) {
    // 预处理输入
    const trimmed = input.trim();
    // 空输入检查
    if (!trimmed) {
        return Promise.resolve({
            strategies: [],
            suggestions: [],
            alternatives: [],
            confidence: 0
        });
    }
    // 直接查询
    return multiStrategyQuery(trimmed);
}
