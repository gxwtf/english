import { prisma } from '@/lib/db';
import { query as queryDict } from '@/lib/dict/query';
import { Meaning } from '@/types/dict';
import fs from 'fs';
import path from 'path';

interface PreviewResult {
  wordId: number;
  wordText: string;
  oldMeanings: string[];
  dictEntry: {
    found: boolean;
    meanings: Meaning[];
  } | null;
  matchedMeanings: Meaning[];
  matchScore: number; // 0-1, 表示匹配质量
}

async function previewUpdate() {
  console.log('🔍 预览词性更新...\n');

  try {
    const words = await prisma.word.findMany({
      select: { id: true, text: true, meanings: true },
      orderBy: { text: 'asc' }
    });

    console.log(`📊 总共 ${words.length} 个单词\n`);

    const results: PreviewResult[] = [];
    let foundCount = 0;
    let notFoundCount = 0;
    let highMatchCount = 0;
    let lowMatchCount = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const oldMeanings = word.meanings as string[];

      console.log(`[${i + 1}/${words.length}] 查询: ${word.text}`);

      const dictEntry = await queryDict(word.text);

      if (!dictEntry) {
        notFoundCount++;
        results.push({
          wordId: word.id,
          wordText: word.text,
          oldMeanings,
          dictEntry: null,
          matchedMeanings: oldMeanings.map(content => ({
            type: '',
            content,
            sentence: ''
          })),
          matchScore: 0
        });
        console.log(`  ⚠️  未找到\n`);
        continue;
      }

      foundCount++;
      const matchedMeanings = matchMeanings(oldMeanings, dictEntry.meaning);
      const matchScore = matchedMeanings.filter(m => m.type).length / matchedMeanings.length;

      if (matchScore >= 0.8) {
        highMatchCount++;
        console.log(`  ✅ 高匹配度: ${(matchScore * 100).toFixed(0)}%\n`);
      } else if (matchScore > 0) {
        lowMatchCount++;
        console.log(`  ⚠️  部分匹配: ${(matchScore * 100).toFixed(0)}%\n`);
      } else {
        console.log(`  ❌ 未匹配\n`);
      }

      results.push({
        wordId: word.id,
        wordText: word.text,
        oldMeanings,
        dictEntry: {
          found: true,
          meanings: dictEntry.meaning
        },
        matchedMeanings,
        matchScore
      });

      await sleep(10);
    }

    // 生成报告
    console.log('\n' + '='.repeat(60));
    console.log('📊 预览报告');
    console.log('='.repeat(60) + '\n');

    console.log('总体统计:');
    console.log(`  📖 字典中找到: ${foundCount}/${words.length} (${((foundCount / words.length) * 100).toFixed(1)}%)`);
    console.log(`  ✅ 高匹配度 (≥80%): ${highMatchCount}`);
    console.log(`  ⚠️  部分匹配 (<80%): ${lowMatchCount}`);
    console.log(`  ❌ 未匹配: ${foundCount - highMatchCount - lowMatchCount}`);
    console.log(`  🔍 字典未找到: ${notFoundCount}\n`);

    // 显示匹配度低的单词
    const lowMatchWords = results.filter(r => r.matchScore > 0 && r.matchScore < 0.8);
    if (lowMatchWords.length > 0) {
      console.log('\n⚠️  部分匹配的单词 (需要人工确认):');
      lowMatchWords.slice(0, 10).forEach(r => {
        console.log(`\n  ${r.wordText} (匹配度: ${(r.matchScore * 100).toFixed(0)}%)`);
        console.log(`    原始释义: ${r.oldMeanings.join('; ')}`);
        r.matchedMeanings.forEach(m => {
          const typeStr = m.type ? `[${m.type}] ` : '[?] ';
          console.log(`    ${typeStr}${m.content}`);
        });
      });

      if (lowMatchWords.length > 10) {
        console.log(`\n  ... 还有 ${lowMatchWords.length - 10} 个单词`);
      }
    }

    // 显示未找到的单词
    const notFoundWords = results.filter(r => !r.dictEntry);
    if (notFoundWords.length > 0) {
      console.log('\n❌ 字典中未找到的单词:');
      console.log(`  ${notFoundWords.map(w => w.wordText).join(', ')}`);
    }

    // 保存详细报告到文件
    const reportPath = path.join(process.cwd(), 'meaning-update-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 详细报告已保存到: ${reportPath}`);

    // 生成 SQL 预览
    const sqlPath = path.join(process.cwd(), 'meaning-update-preview.sql');
    const sqlStatements = results.map(r => {
      const meaningsJson = JSON.stringify(r.matchedMeanings);
      return `-- ${r.wordText}\nUPDATE "Word" SET meanings = '${meaningsJson}'::jsonb WHERE id = ${r.wordId};`;
    }).join('\n\n');

    fs.writeFileSync(sqlPath, sqlStatements);
    console.log(`📄 SQL 预览已保存到: ${sqlPath}`);

  } catch (error) {
    console.error('❌ 预览失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

function matchMeanings(oldMeanings: string[], dictMeanings: Meaning[]): Meaning[] {
  const matched: Meaning[] = [];

  for (const oldMeaning of oldMeanings) {
    const cleanOld = cleanText(oldMeaning);
    let bestMatch: Meaning | null = null;
    let bestScore = 0;

    for (const dictMeaning of dictMeanings) {
      const cleanDict = cleanText(dictMeaning.content);
      const score = calculateMatchScore(cleanOld, cleanDict);

      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = dictMeaning;
      }
    }

    if (bestMatch) {
      matched.push({
        type: bestMatch.type,
        content: oldMeaning,
        sentence: bestMatch.sentence
      });
    } else {
      matched.push({
        type: '',
        content: oldMeaning,
        sentence: ''
      });
    }
  }

  return matched;
}

function calculateMatchScore(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.includes(str2) || str2.includes(str1)) return 0.9;

  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

function cleanText(text: string): string {
  return text.toLowerCase().replace(/[，。；：！？、\s]/g, '').trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

previewUpdate().catch(console.error);
