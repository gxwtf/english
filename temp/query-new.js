"use strict";
// 查询词典的 API
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryWord = queryWord;
exports.parseHTMLToJSON = parseHTMLToJSON;
const mdict_js_1 = require("mdict-js");
const DICT_PATH = '../src/dict/niujin.mdx';
const dict = new mdict_js_1.default(DICT_PATH);
function parseHTMLToJSON(definition, word) {
    try {
        const result = {
            word: word,
            pronunciation: '',
            meanings: []
        };
        // Extract pronunciation from the HTML
        const phoneticRegex = /<span[^>]*class="phon-[a-z]+"[^>]*>([^<]+)<\/span>/gi;
        const pronunciations = [];
        let match;
        while ((match = phoneticRegex.exec(definition)) !== null) {
            pronunciations.push(match[1].trim());
        }
        result.pronunciation = pronunciations.join(', ');
        // Extract all parts of speech (word types) - try multiple patterns
        const posRegex1 = /<span[^>]*pos="[a-z]?"[^>]*class="[^"]*pos[^"]*"[^>]*>([^<]+)<\/span>/gi;
        const posRegex2 = /<span[^>]*class="[^"]*pos[^"]*"[^>]*>([^<]+)<\/span>/gi;
        const allWordTypes = [];
        // Try first pattern
        while ((match = posRegex1.exec(definition)) !== null) {
            allWordTypes.push(match[1].trim());
        }
        // If not enough, try second pattern
        if (allWordTypes.length < 2) {
            posRegex2.lastIndex = 0;
            while ((match = posRegex2.exec(definition)) !== null) {
                if (match[1].trim().length > 0) {
                    allWordTypes.push(match[1].trim());
                }
            }
        }
        // Extract only English example sentences (class="x")
        const exampleRegex = /<span[^>]*class="[^"]*x"[^>]*>([^<]+)<\/span[^>]*>/gi;
        const examples = [];
        while ((match = exampleRegex.exec(definition)) !== null) {
            const text = match[1].trim();
            // Only keep valid English sentences
            if (text.length >= 3 && /[a-zA-Z]/.test(text) && !/[\u4e00-\u9fff]/.test(text)) {
                examples.push(text);
            }
        }
        // Get all Chinese text
        const chineseContentRegex = />([\u4e00-\u9fff\s\d\(\),、；""'.:!?-]+)<\/span>/g;
        const chineseTexts = [];
        while ((match = chineseContentRegex.exec(definition)) !== null) {
            const chineseText = match[1].trim();
            if (chineseText.length >= 1 && /[\u4e00-\u9fff]/.test(chineseText)) {
                chineseTexts.push(chineseText);
            }
        }
        // Clean and deduplicate Chinese texts
        const uniqueChineseTexts = [...new Set(chineseTexts)];
        const meaningfulTexts = uniqueChineseTexts.filter(text => {
            // Filter out empty strings and whitespace
            if (!text || text.trim().length === 0)
                return false;
            if (text.length === 1 && text !== '的')
                return false;
            // Keep meaningful Chinese text
            if (text.includes('打') || text.includes('招呼') || text.includes('的') ||
                text.includes('了') || text.includes('吗') || text.includes('呢') ||
                text.includes('啊') || text.includes('意思') || text.includes('什么')) {
                return true;
            }
            // Keep longer texts
            if (text.length > 3)
                return true;
            return false;
        }).slice(0, 15); // Limit to 15 meanings
        // Map to WordResult
        const finalMeanings = [];
        const seenContents = new Set();
        let exampleIndex = 0;
        for (let i = 0; i < meaningfulTexts.length && i < 15; i++) {
            const chineseText = meaningfulTexts[i];
            if (!seenContents.has(chineseText)) {
                seenContents.add(chineseText);
                // Get word type (cycle through available types)
                const wordType = i < allWordTypes.length ? allWordTypes[i] : '';
                // Get example (try to find a good English match)
                let example = '';
                if (exampleIndex < examples.length) {
                    example = examples[exampleIndex];
                    exampleIndex++;
                }
                finalMeanings.push({
                    content: chineseText,
                    type: wordType,
                    sentence: example || chineseText
                });
            }
        }
        result.meanings = finalMeanings;
        return result;
    }
    catch (error) {
        console.error('Error parsing HTML:', error);
        return {
            word: word,
            pronunciation: '',
            meanings: [],
            error: error.message
        };
    }
}
async function queryWord(word) {
    try {
        const result = dict.lookup(word);
        if (result && result.definition) {
            const parsed = parseHTMLToJSON(result.definition, word);
            return parsed;
        }
        else {
            console.log('No definition found for:', word);
            return { word, pronunciation: '', meanings: [] };
        }
    }
    catch (error) {
        console.error('Error querying word:', error);
        return { word, pronunciation: '', meanings: [], error: error.message };
    }
}
// Test with multiple words to understand the pattern
async function testMultipleWords() {
    const testWords = ['cook', 'apple', 'computer', 'hello', 'world'];
    for (const word of testWords) {
        console.log(`\n\n=== Testing word: ${word} ===`);
        const result = await queryWord(word);
        console.log(JSON.stringify(result, null, 2));
        console.log('\n' + '='.repeat(50) + '\n');
    }
}
// Run test if this file is executed directly
if (require.main === module) {
    testMultipleWords().catch(console.error);
}
