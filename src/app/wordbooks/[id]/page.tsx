import { WordbookDetailPageContent } from '@/components/WordbookDetailPageContent';

export const metadata = {
  title: '单词本 | 广学英语',
};

export default function WordbookDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <WordbookDetailPageContent params={params} />;
}
