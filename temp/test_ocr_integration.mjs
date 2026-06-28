// 测试 Next.js Server Action OCR 集成（在服务端环境调用）
// 模拟 recognizeWordsFromImage -> recognizeHighlightedImage -> PaddleOCR 的完整链路
import { recognizeHighlightedImage } from '../src/lib/ocr.ts';
import fs from 'fs';

async function main() {
  console.log('=== 测试 OCR 集成 (Server Action 链路) ===\n');

  const testCases = [
    { file: 'temp/tests/01.jpg', expected: ['divine', 'divorce', 'beams', 'prism'] },
    { file: 'temp/tests/yellow-highlight-single.jpg', expected: ['spectacular'] },
    { file: 'temp/tests/red-circle-3.jpg', expected: ['important', 'require', 'consideration'] },
  ];

  let pass = 0;
  for (const tc of testCases) {
    try {
      const imageBuffer = fs.readFileSync(tc.file);
      const t0 = Date.now();
      const result = await recognizeHighlightedImage(imageBuffer);
      const t1 = Date.now();

      const highlighted = result.highlightedWords.map(w => w.toLowerCase());
      const matched = tc.expected.filter(w => highlighted.includes(w.toLowerCase()));
      const missing = tc.expected.filter(w => !highlighted.includes(w.toLowerCase()));
      const extra = highlighted.filter(w => !tc.expected.map(e => e.toLowerCase()).includes(w));

      const pass_ = missing.length === 0 && extra.length === 0;
      if (pass_) pass++;

      console.log(`[${pass_ ? 'PASS' : 'FAIL'}] ${tc.file}`);
      console.log(`  期望: ${JSON.stringify(tc.expected)}`);
      console.log(`  实际: ${JSON.stringify(result.highlightedWords)}`);
      console.log(`  统计: totalWords=${result.stats.totalWords}, highlightedCount=${result.stats.highlightedCount}`);
      console.log(`  耗时: ${(t1-t0)/1000}s`);
      if (missing.length > 0) console.log(`  缺失: ${JSON.stringify(missing)}`);
      if (extra.length > 0) console.log(`  多余: ${JSON.stringify(extra)}`);
      console.log();
    } catch (e) {
      console.log(`[ERROR] ${tc.file}: ${e.message}\n`);
    }
  }

  console.log(`\n集成测试结果: ${pass}/${testCases.length} 通过`);
}

main().catch(console.error);
