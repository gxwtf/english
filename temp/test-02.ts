import dotenv from 'dotenv';
import fs from 'fs';
import { findMarkedWords } from '../src/lib/ocr';

dotenv.config({ path: '.env.local' });

async function main() {
  const imageBuffer = fs.readFileSync('./temp/tests/01.jpg');
  const t0 = Date.now();
  const { markedWords, allWords } = await findMarkedWords(imageBuffer, '高亮');
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n=== 第二阶段测试结果 (${elapsed}s) ===`);
  console.log(`总单词数: ${allWords.length}`);
  console.log(`标记单词: ${markedWords.length}`);

  // 目标词检查
  const targets = ['divine', 'divorce', 'beams', 'prism'];
  console.log('\n--- 目标词检查 ---');
  let recall = 0;
  for (const target of targets) {
    const found = markedWords.find(w => w.text.toLowerCase() === target.toLowerCase());
    if (found) {
      recall++;
      console.log(`✓ ${target}: 被标记 (conf: ${found.confidence})`);
    } else {
      const inAll = allWords.find(w => w.text.toLowerCase() === target.toLowerCase());
      console.log(`${inAll ? '✗' : '?'} ${target}: ${inAll ? '识别到但未标记' : '未识别到'}`);
    }
  }

  // 误报检查
  const targetSet = new Set(targets.map(t => t.toLowerCase()));
  const falsePositives = markedWords.filter(w => !targetSet.has(w.text.toLowerCase()));
  const precision = markedWords.length > 0 ? ((markedWords.length - falsePositives.length) / markedWords.length * 100).toFixed(1) : '0';

  console.log('\n--- 准确率指标 ---');
  console.log(`召回率 (Recall): ${recall}/${targets.length} = ${(recall / targets.length * 100).toFixed(1)}%`);
  console.log(`精确率 (Precision): ${precision}% (${markedWords.length - falsePositives.length}/${markedWords.length})`);
  console.log(`误报数: ${falsePositives.length}`);

  if (falsePositives.length > 0) {
    console.log('\n--- 误报词 ---');
    falsePositives.forEach(w => console.log(`  ${w.text} (conf: ${w.confidence})`));
  }

  console.log('\n--- 所有标记词 ---');
  markedWords.forEach(w => console.log(`  ${w.text} (conf: ${w.confidence})`));

  // 全图检测效率分析
  console.log('\n--- 效率分析 ---');
  console.log(`总耗时: ${elapsed}s`);
  console.log(`处理单词数: ${allWords.length}`);
  console.log(`每词平均耗时: ${(parseFloat(elapsed) / allWords.length * 1000).toFixed(1)}ms`);
  console.log(`Qwen 调用次数: 1次全图检测 + 1次补充识别 = 2次`);
}

main().catch(e => console.error(e));
