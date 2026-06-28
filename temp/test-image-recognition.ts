import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

import fs from 'fs';
import { findMarkedWords } from '../src/lib/ocr';

const TESTS_DIR = path.join(process.cwd(), 'temp', 'tests');
const MANIFEST_PATH = path.join(TESTS_DIR, 'manifest.json');
const TIMEOUT_MS = 120_000;

interface TestCase {
  filename: string;
  name: string;
  style: string;
  expectedWords: string[];
}

interface TestResult {
  name: string;
  filename: string;
  style: string;
  expectedWords: string[];
  detectedWords: string[];
  truePositives: string[];
  falsePositives: string[];
  falseNegatives: string[];
  precision: number;
  recall: number;
  f1: number;
  durationMs: number;
  error?: string;
}

function matchWord(detected: string, expected: string): boolean {
  const d = detected.toLowerCase().replace(/[^a-z]/g, '');
  const e = expected.toLowerCase().replace(/[^a-z]/g, '');
  if (d === e) return true;
  if (d.includes(e) || e.includes(d)) return true;
  if (d.length >= 4 && e.length >= 4) {
    const maxDist = Math.floor(Math.max(d.length, e.length) * 0.3);
    let dist = 0;
    if (Math.abs(d.length - e.length) > maxDist) return false;
    const shorter = d.length < e.length ? d : e;
    const longer = d.length < e.length ? e : d;
    let j = 0;
    for (let i = 0; i < longer.length && dist <= maxDist; i++) {
      if (j < shorter.length && longer[i] === shorter[j]) {
        j++;
      } else {
        dist++;
      }
    }
    dist += shorter.length - j;
    return dist <= maxDist;
  }
  return false;
}

async function runSingleTest(testCase: TestCase): Promise<TestResult> {
  const imagePath = path.join(TESTS_DIR, testCase.filename);
  const imageBuffer = fs.readFileSync(imagePath);

  const t0 = Date.now();

  const { markedWords, allWords } = await findMarkedWords(imageBuffer, testCase.style);
  console.log(`  OCR: ${allWords.length} 个单词, 标记: ${markedWords.length} 个`);
  console.log(`  所有OCR单词: ${allWords.map(w => `${w.text}(${w.confidence.toFixed(0)}%)`).join(', ')}`);

  const detectedWords = markedWords.map(w => w.text);
  const durationMs = Date.now() - t0;

  const truePositives: string[] = [];
  const falsePositives: string[] = [];
  const matchedExpected = new Set<number>();

  for (const detected of detectedWords) {
    let found = false;
    for (let i = 0; i < testCase.expectedWords.length; i++) {
      if (matchedExpected.has(i)) continue;
      if (matchWord(detected, testCase.expectedWords[i])) {
        truePositives.push(testCase.expectedWords[i]);
        matchedExpected.add(i);
        found = true;
        break;
      }
    }
    if (!found) {
      falsePositives.push(detected);
    }
  }

  const falseNegatives = testCase.expectedWords.filter((_, i) => !matchedExpected.has(i));

  const precision = detectedWords.length > 0 ? truePositives.length / detectedWords.length : 0;
  const recall = testCase.expectedWords.length > 0 ? truePositives.length / testCase.expectedWords.length : (detectedWords.length === 0 ? 1 : 0);
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  return {
    name: testCase.name,
    filename: testCase.filename,
    style: testCase.style,
    expectedWords: testCase.expectedWords,
    detectedWords,
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1,
    durationMs,
  };
}

async function main() {
  console.log('🧪 图像单词识别算法测试 (纯CV路径)\n');
  console.log('='.repeat(80));

  const manifestRaw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
  const testCases: TestCase[] = JSON.parse(manifestRaw);

  const results: TestResult[] = [];

  for (const testCase of testCases) {
    console.log(`\n📋 测试: ${testCase.name} (${testCase.filename})`);
    console.log(`   标注方式: ${testCase.style}`);
    console.log(`   期望单词: ${testCase.expectedWords.join(', ') || '(无)'}`);

    try {
      const result = await Promise.race([
        runSingleTest(testCase),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('测试超时')), TIMEOUT_MS)
        ),
      ]);
      results.push(result);

      console.log(`   检测单词: ${result.detectedWords.join(', ') || '(无)'}`);
      console.log(`   ✅ 正确: ${result.truePositives.join(', ') || '(无)'}`);
      console.log(`   ❌ 误报: ${result.falsePositives.join(', ') || '(无)'}`);
      console.log(`   ⚠️ 漏报: ${result.falseNegatives.join(', ') || '(无)'}`);
      console.log(`   📊 精确率: ${(result.precision * 100).toFixed(1)}% | 召回率: ${(result.recall * 100).toFixed(1)}% | F1: ${(result.f1 * 100).toFixed(1)}% | 耗时: ${(result.durationMs / 1000).toFixed(1)}s`);
    } catch (err) {
      console.log(`   💥 测试失败: ${err instanceof Error ? err.message : err}`);
      results.push({
        name: testCase.name,
        filename: testCase.filename,
        style: testCase.style,
        expectedWords: testCase.expectedWords,
        detectedWords: [],
        truePositives: [],
        falsePositives: [],
        falseNegatives: [...testCase.expectedWords],
        precision: 0,
        recall: 0,
        f1: 0,
        durationMs: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 测试总结\n');

  const validResults = results.filter(r => !r.error);
  const avgPrecision = validResults.length > 0 ? validResults.reduce((s, r) => s + r.precision, 0) / validResults.length : 0;
  const avgRecall = validResults.length > 0 ? validResults.reduce((s, r) => s + r.recall, 0) / validResults.length : 0;
  const avgF1 = validResults.length > 0 ? validResults.reduce((s, r) => s + r.f1, 0) / validResults.length : 0;

  const totalTP = validResults.reduce((s, r) => s + r.truePositives.length, 0);
  const totalFP = validResults.reduce((s, r) => s + r.falsePositives.length, 0);
  const totalFN = validResults.reduce((s, r) => s + r.falseNegatives.length, 0);
  const microPrecision = totalTP + totalFP > 0 ? totalTP / (totalTP + totalFP) : 0;
  const microRecall = totalTP + totalFN > 0 ? totalTP / (totalTP + totalFN) : 0;
  const microF1 = microPrecision + microRecall > 0 ? (2 * microPrecision * microRecall) / (microPrecision + microRecall) : 0;

  console.log(`宏平均 - 精确率: ${(avgPrecision * 100).toFixed(1)}% | 召回率: ${(avgRecall * 100).toFixed(1)}% | F1: ${(avgF1 * 100).toFixed(1)}%`);
  console.log(`微平均 - 精确率: ${(microPrecision * 100).toFixed(1)}% | 召回率: ${(microRecall * 100).toFixed(1)}% | F1: ${(microF1 * 100).toFixed(1)}%`);
  console.log(`总 TP: ${totalTP} | FP: ${totalFP} | FN: ${totalFN}`);

  console.log('\n各测试详情:');
  results.forEach(r => {
    const status = r.error ? '💥' : r.f1 >= 0.8 ? '✅' : r.f1 >= 0.5 ? '⚠️' : '❌';
    console.log(`  ${status} ${r.name}: P=${(r.precision * 100).toFixed(0)}% R=${(r.recall * 100).toFixed(0)}% F1=${(r.f1 * 100).toFixed(0)}% | 检测:[${r.detectedWords.join(',')}] 期望:[${r.expectedWords.join(',')}]`);
  });

  const reportPath = path.join(TESTS_DIR, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ results, macroAvg: { precision: avgPrecision, recall: avgRecall, f1: avgF1 }, microAvg: { precision: microPrecision, recall: microRecall, f1: microF1 } }, null, 2));
  console.log(`\n📄 测试报告已保存到: ${reportPath}`);
}

main().catch(err => {
  console.error('测试脚本异常:', err);
  process.exit(1);
});
