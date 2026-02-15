"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// 短语动词解决方案测试
const hybrid_query_1 = require("./hybrid-query");
const phrasal_verb_dictionary_1 = require("./phrasal-verb-dictionary");
async function testPhrasalVerbSolution() {
    console.log('=== 短语动词解决方案测试 ===\n');
    // 测试短语词典中的短语
    const testPhrases = [
        'turn on',
        'turn off',
        'put off',
        'take off',
        'look up',
        'give up',
        'run into',
        'break down',
        'call off',
        'make up',
        // 测试词典中没有的短语
        'turn onnx',
        'xyz abc',
        'hello world'
    ];
    console.log('1. 测试已知的短语动词：');
    for (const phrase of testPhrases) {
        console.log(`\n测试短语: "${phrase}"`);
        try {
            const result = await (0, hybrid_query_1.hybridQuery)(phrase);
            console.log(`发音: ${result.pronunciation}`);
            console.log(`置信度: ${(result.confidence * 100).toFixed(1)}%`);
            console.log(`解释: ${result.explanation}`);
            console.log(`找到 ${result.meanings.length} 个含义:`);
            result.meanings.forEach((meaning, i) => {
                const sourceBadge = meaning.source === 'phrasal-verb' ? '🎯' :
                    meaning.source === 'dictionary' ? '📚' :
                        meaning.source === 'compound' ? '🔗' : '❓';
                console.log(`  ${i + 1}. ${sourceBadge} ${meaning.type}: ${meaning.content}`);
                console.log(`     "${meaning.sentence}"`);
            });
            // 检查结果质量
            if (result.confidence >= 0.9) {
                console.log('✅ 高质量结果');
            }
            else if (result.confidence >= 0.5) {
                console.log('⚠️  中等质量结果');
            }
            else {
                console.log('❌ 低质量结果或未找到');
            }
        }
        catch (error) {
            console.log(`❌ 错误: ${error.message}`);
        }
    }
    console.log('\n\n2. 测试短语建议功能：');
    const testInputs = ['turn', 'look', 'up', 'get', 'get out'];
    for (const input of testInputs) {
        const suggestions = (0, hybrid_query_1.getPhraseSuggestions)(input);
        console.log(`输入 "${input}" 的建议:`);
        suggestions.forEach((suggestion, i) => {
            console.log(`  ${i + 1}. ${suggestion}`);
        });
    }
    console.log('\n\n3. 测试不同查询格式：');
    const formatTests = [
        'turnon',
        'turn on',
        'Turn On',
        '  turn on  ',
        'turn  on'
    ];
    for (const format of formatTests) {
        console.log(`\n格式: "${format}"`);
        try {
            const result = await (0, hybrid_query_1.hybridQuery)(format);
            console.log(`结果: ${result.explanation} (${(result.confidence * 100).toFixed(1)}%)`);
        }
        catch (error) {
            console.log(`❌ 错误: ${error.message}`);
        }
    }
    console.log('\n\n4. 短语词典统计：');
    console.log(`总短语数量: ${phrasal_verb_dictionary_1.PHRASAL_VERB_DICTIONARY.length}`);
    // 统计动词分布
    const verbCount = new Map();
    phrasal_verb_dictionary_1.PHRASAL_VERB_DICTIONARY.forEach(entry => {
        verbCount.set(entry.verb, (verbCount.get(entry.verb) || 0) + 1);
    });
    console.log('\n动词分布（前10个）：');
    const sortedVerbs = Array.from(verbCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    sortedVerbs.forEach(([verb, count]) => {
        console.log(`  ${verb}: ${count} 个短语`);
    });
    console.log('\n5. 最复杂的短语：');
    const maxMeanings = phrasal_verb_dictionary_1.PHRASAL_VERB_DICTIONARY.reduce((max, entry) => entry.meanings.length > max ? entry.meanings.length : max, 0);
    const complexPhrases = phrasal_verb_dictionary_1.PHRASAL_VERB_DICTIONARY.filter(entry => entry.meanings.length === maxMeanings);
    complexPhrases.forEach(entry => {
        console.log(`  ${entry.verb} ${entry.particle}: ${entry.meanings.length} 个含义`);
        entry.meanings.forEach(meaning => {
            console.log(`    - ${meaning.content}`);
        });
    });
    console.log('\n=== 测试完成 ===');
}
// 运行测试
testPhrasalVerbSolution().catch(console.error);
