import 'dotenv/config';
import { prisma } from '../src/lib/db';

async function main() {
  const question = await prisma.questionQueue.findUnique({
    where: { id: 'cmqkf81ii0000u0017xe1b9q1' },
  });

  if (!question) {
    console.log('Question not found');
    return;
  }

  console.log('Question type:', question.questionType);
  console.log('Question content:');
  const content = question.questionContent as any;
  console.log(JSON.stringify(content, null, 2));

  if (content?.questions) {
    console.log('\n=== Analyzing correctAnswer position ===');
    for (const q of content.questions) {
      console.log('\nWord:', q.word);
      console.log('Options:', q.options);
      console.log('correctAnswer:', q.correctAnswer);
      const correctIndex = q.options?.indexOf(q.correctAnswer);
      console.log('correctIndex in options:', correctIndex);
      console.log('Letter:', correctIndex >= 0 ? ['A', 'B', 'C', 'D'][correctIndex] : 'NOT FOUND');
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
  });