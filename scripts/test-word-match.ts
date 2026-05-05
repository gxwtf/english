import { query as queryDict } from '@/lib/dict/query';

async function testWordMatch(wordText: string, userMeanings: string[]) {
  console.log(`\n🔍 测试单词: ${wordText}\n`);

  console.log('用户保存的含义:');
  userMeanings.forEach((m, i) => console.log(`  ${i + 1}. ${m}`));

  console.log('\n查询字典...');
  const dictEntry = await queryDict(wordText);

  if (!dictEntry) {
    console.log('❌ 字典中未找到该单词\n');
    return;
  }

  console.log('\n字典释义:');
  dictEntry.meaning.forEach((m, i) => {
    console.log(`  ${i + 1}. [${m.type}] ${m.content}`);
  });

  console.log('\n匹配结果:');
  const matched = matchMeanings(userMeanings, dictEntry.meaning);

  matched.forEach((m, i) => {
    const typeStr = m.type ? `[${m.type}]` : '[?]';
    console.log(`  ${i + 1}. ${typeStr} ${m.content}`);
  });

  const matchScore = matched.filter(m => m.type).length / matched.length;
  console.log(`\n匹配度: ${(matchScore * 100).toFixed(0)}%\n`);
}

function matchMeanings(userMeanings: string[], dictMeanings: any[]) {
  return userMeanings.map(userMeaning => {
    const cleanUser = cleanText(userMeaning);
    let bestMatch = null;
    let bestScore = 0;

    for (const dictMeaning of dictMeanings) {
      const cleanDict = cleanText(dictMeaning.content);
      const score = calculateSimilarity(cleanUser, cleanDict);

      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = dictMeaning;
      }
    }

    if (bestMatch) {
      return {
        type: bestMatch.type,
        content: userMeaning,
        sentence: bestMatch.sentence || ''
      };
    }

    return {
      type: '',
      content: userMeaning,
      sentence: ''
    };
  });
}

function cleanText(text: string): string {
  return text.toLowerCase().replace(/[，。；：！？、\s]/g, '').trim();
}

function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.includes(str2) || str2.includes(str1)) return 0.9;

  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

// 测试示例
async function runTests() {
  console.log('🧪 单词匹配测试\n');
  console.log('='.repeat(60));

  await testWordMatch('apple', ['苹果', '苹果树']);
  await testWordMatch('book', ['书', '预订']);
  await testWordMatch('run', ['跑', '运行', '经营']);
  await testWordMatch('bank', ['银行', '河岸']);

  console.log('='.repeat(60));
  console.log('\n✅ 测试完成\n');
}

runTests().catch(console.error);
