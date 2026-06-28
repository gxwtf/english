import dotenv from 'dotenv';
import fs from 'fs';
import { findMarkedWords } from '../src/lib/ocr';

dotenv.config({ path: '.env.local' });

async function main() {
  const imageBuffer = fs.readFileSync('./temp/tests/01.jpg');
  const t0 = Date.now();
  const { markedWords, allWords } = await findMarkedWords(imageBuffer, '高亮');
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n=== 测试结果 (${elapsed}s) ===`);
  console.log(`总单词数: ${allWords.length}`);
  console.log(`标记单词: ${markedWords.length}`);

  const targets = ['divine', 'divorce', 'beams', 'prism'];
  console.log('\n--- 目标词检查 ---');
  for (const target of targets) {
    const found = markedWords.find(w => w.text.toLowerCase() === target.toLowerCase());
    if (found) {
      console.log(`✓ ${target}: 被标记 (confidence: ${found.confidence})`);
    } else {
      const inAll = allWords.find(w => w.text.toLowerCase() === target.toLowerCase());
      console.log(`${inAll ? '✗' : '?'} ${target}: ${inAll ? '识别到但未标记' : '未识别到'}`);
    }
  }

  console.log('\n--- 所有标记词 (含 confidence) ---');
  markedWords.forEach(w => console.log(`  ${w.text} (conf: ${w.confidence})`));
}

main().catch(e => console.error(e)).finally(() => process.exit(0));
