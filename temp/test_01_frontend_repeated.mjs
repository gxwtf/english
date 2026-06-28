// 前端集成反复测试 01.jpg - 通过 Server Action 链路（recognizeHighlightedImage）
// 排除偶然因素对识别结果的影响
import { recognizeHighlightedImage } from '../src/lib/ocr.ts';
import fs from 'fs';

const IMG_PATH = 'temp/tests/01.jpg';
const N = 10;
const EXPECTED = ['divine', 'divorce', 'beams', 'prism'];

async function main() {
  console.log(`=== 前端集成反复测试: 01.jpg x ${N} 次 ===\n`);
  const imageBuffer = fs.readFileSync(IMG_PATH);

  const results = [];
  const errors = [];

  for (let i = 1; i <= N; i++) {
    try {
      const t0 = Date.now();
      const result = await recognizeHighlightedImage(imageBuffer);
      const t1 = Date.now();

      const highlighted = result.highlightedWords.map(w => w.toLowerCase());
      const allTexts = result.words.map(w => w.text.toLowerCase());

      results.push({
        run: i,
        highlighted: [...new Set(highlighted)].sort(),
        allTexts: new Set(allTexts),
        totalWords: result.stats.totalWords,
        highlightedCount: result.stats.highlightedCount,
        elapsed: (t1 - t0) / 1000,
      });

      console.log(`[Run ${String(i).padStart(2, ' ')}] 高亮=[${[...new Set(highlighted)].sort().join(', ')}]  总词数=${result.stats.totalWords}  耗时=${((t1 - t0) / 1000).toFixed(2)}s`);
    } catch (e) {
      errors.push(`Run ${i}: ${e.message}`);
      console.log(`[Run ${String(i).padStart(2, ' ')}] EXCEPTION: ${e.message}`);
    }
  }

  // 分析
  console.log(`\n=== 稳定性分析 ===`);
  console.log(`成功: ${results.length}/${N}`);
  if (errors.length > 0) {
    console.log(`错误: ${errors.length}`);
    errors.forEach(e => console.log(`  - ${e}`));
  }

  if (results.length > 0) {
    // 高亮词组合分布
    const combos = {};
    for (const r of results) {
      const key = r.highlighted.join(',');
      combos[key] = (combos[key] || 0) + 1;
    }
    console.log(`\n高亮词组合分布:`);
    for (const [combo, cnt] of Object.entries(combos)) {
      const pct = Math.round(cnt * 100 / results.length);
      console.log(`  [${combo}]: ${cnt}/${results.length} (${pct}%)`);
    }

    // 总词数稳定性
    const wordCounts = results.map(r => r.totalWords);
    const minW = Math.min(...wordCounts);
    const maxW = Math.max(...wordCounts);
    const avgW = wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length;
    console.log(`\n总词数: min=${minW} max=${maxW} avg=${avgW.toFixed(1)}`);

    // 耗时稳定性
    const times = results.map(r => r.elapsed);
    const minT = Math.min(...times);
    const maxT = Math.max(...times);
    const avgT = times.reduce((a, b) => a + b, 0) / times.length;
    console.log(`耗时: min=${minT.toFixed(2)}s max=${maxT.toFixed(2)}s avg=${avgT.toFixed(2)}s`);

    // 关键词出现率
    console.log(`\n关键词出现率:`);
    for (const kw of EXPECTED) {
      const cnt = results.filter(r => r.highlighted.includes(kw.toLowerCase())).length;
      const pct = Math.round(cnt * 100 / results.length);
      console.log(`  ${kw}: ${cnt}/${results.length} (${pct}%)`);
    }

    // neprsmofa 复现检查
    const badCnt = results.filter(r => r.allTexts.has('neprsmofa')).length;
    console.log(`\nneprsmofa 误识别复现: ${badCnt}/${results.length}`);

    // Jaccard 相似度
    if (results.length >= 2) {
      const base = results[0].allTexts;
      const sims = results.slice(1).map(r => {
        const union = new Set([...base, ...r.allTexts]);
        let inter = 0;
        for (const w of base) if (r.allTexts.has(w)) inter++;
        return union.size > 0 ? inter / union.size : 1.0;
      });
      const minJ = Math.min(...sims);
      const maxJ = Math.max(...sims);
      const avgJ = sims.reduce((a, b) => a + b, 0) / sims.length;
      console.log(`\n词集合 Jaccard 相似度 (vs Run 1): min=${minJ.toFixed(3)} max=${maxJ.toFixed(3)} avg=${avgJ.toFixed(3)}`);
    }

    // 最终结论
    console.log(`\n=== 最终结论 ===`);
    const expectedSet = new Set(EXPECTED);
    const allPass = results.every(r => {
      const actual = new Set(r.highlighted);
      return actual.size === expectedSet.size && [...actual].every(w => expectedSet.has(w));
    });
    if (allPass && badCnt === 0) {
      console.log(`PASS: ${results.length}/${results.length} 次运行结果完全一致 = {divine, divorce, beams, prism}，无 neprsmofa 误识别`);
    } else if (badCnt > 0) {
      console.log(`FAIL: neprsmofa 误识别复现 ${badCnt}/${results.length} 次`);
    } else {
      console.log(`WARN: 结果存在波动，详见上方分布`);
    }
  }
}

main().catch(console.error);
