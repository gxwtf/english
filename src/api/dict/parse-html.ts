// 将词典返回的 HTML 字符串解析为 JSON 对象
// Author: wchengk09 + ChatGPT

import * as cheerio from 'cheerio';

// 定义目标 JSON 格式的接口
export interface Meaning {
	content: string;
	type: string;
	sentence: string;
}

export interface DictionaryEntry {
	word: string;
	pronunciation: string;
	meanings: Meaning[];
}

/**
 * 解析词典 HTML 字符串为 JSON 对象
 * @param rawContent 包含头部杂信息的原始 HTML 字符串
 * @returns DictionaryEntry 对象
 */
export default function parseDictionaryEntry(rawContent: string): DictionaryEntry {
	try {
		// 1. 数据清洗：去除头部非 HTML 的内存统计信息
		// 寻找第一个 '<' 符号的开始位置，通常是 <link> 或 <span>
		const startIndex = rawContent.indexOf('<');
		const cleanHtml = startIndex >= 0 ? rawContent.substring(startIndex) : rawContent;

		// 2. 加载 HTML
		const $ = cheerio.load(cleanHtml);

		// 3. 提取基础信息
		// 单词通常在 class="h" 中
		const word = $('.top-g .h').first().text().trim();

		// 音标：优先提取英式 (phon-gb)，如果没有则提取美式 (phon-us)
		// 格式通常为 kʊk，我们需要加上 //
		let pronunciationRaw = $('.phon-gb').first().text().trim();
		if (!pronunciationRaw) {
			pronunciationRaw = $('.phon-us').first().text().trim();
		}
		const pronunciation = pronunciationRaw ? `/${pronunciationRaw}/` : '';

		const meanings: Meaning[] = [];

		// 4. 提取释义
		// 逻辑：遍历所有的 def-g (定义组)，这是最核心的单元
		$('.def-g').each((_, element) => {
			const $def = $(element);

			// --- 提取中文释义 ---
			// 在 OALD 格式中，中文通常在 class="chn" 中
			const cnDefinition = $def.find('.chn').text().trim();

			// 如果没有中文释义，这可能是一个纯英文引用或结构性标签，跳过
			if (!cnDefinition) return;

			// --- 提取词性 (Type) ---
			// 词性通常位于当前定义的父级容器 .p-g (Part of Speech group) 的头部
			// 我们向上查找最近的 .p-g，然后找里面的 .pos
			const $parentGroup = $def.closest('.p-g');
			let type = $parentGroup.find('.pos').first().text().trim();

			// 如果找不到 p-g (比如 idioms 或者是复合词)，尝试在当前层级查找
			if (!type) {
				// 有些词典结构可能没有明确的 p-g，默认为 unknown 或尝试从其他标签获取
				type = 'unknown';
			}

			// --- 提取例句 (Sentence) ---
			// 例句通常在 class="x-g" (Example group) 中
			// 结构通常是: <span class="def-g">...</span> <span class="x-g">...</span>
			// 所以我们查找当前 def-g 紧接着的 x-g 兄弟元素

			let sentenceStr = '';
			// 获取同级所有后续兄弟元素，找到第一个 x-g
			const $exampleGroup = $def.nextAll('.x-g').first();

			if ($exampleGroup.length > 0) {
				const enSentence = $exampleGroup.find('.x').text().trim();
				const cnSentence = $exampleGroup.find('.tx').text().trim();

				// 拼接例句，格式为：英文 (中文)
				if (enSentence && cnSentence) {
					sentenceStr = `${enSentence} (${cnSentence})`;
				} else {
					sentenceStr = enSentence || cnSentence;
				}
			}

			// --- 存入结果 ---
			meanings.push({
				content: cnDefinition,
				type: type,
				sentence: sentenceStr
			});
		});

		return {
			word,
			pronunciation,
			meanings
		};
	} catch (e) {
		console.error('Failed to parse dictionary entry', e);
		return {
			"word": "",
			"pronunciation": "",
			"meanings": []
		};
	}
}