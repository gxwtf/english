// constants/word-tags.ts
import { CircleQuestionMark, Layers, Tag } from 'lucide-react';
import { TagConfig, WordTag } from '@/types/word';

export const WORD_TAGS: Record<WordTag, TagConfig> = {
  COMMON: {
    id: 'COMMON',
    name: '常用义',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: <CircleQuestionMark className="h-3.5 w-3.5" />,
    description: '最常用的单词含义'
  },
  MULTIPLE: {
    id: 'MULTIPLE',
    name: '一词多义',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: <Layers className="h-3.5 w-3.5" />,
    description: '该单词具有多个不同的含义或用法'
  },
  FORMS: {
    id: 'FORMS',
    name: '形式变形',
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: <Tag className="h-3.5 w-3.5" />,
    description: '该单词存在时态、单复数等形态变化'
  }
};