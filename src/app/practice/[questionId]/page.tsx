import { PracticeQuestionPageContent } from '@/components/PracticeQuestionPageContent';

export const metadata = {
  title: '练习答题 | 广学英语',
};

export default function PracticeQuestionPage({ params }: { params: Promise<{ questionId: string }> }) {
  return <PracticeQuestionPageContent params={params} />;
}
