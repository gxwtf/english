import { Word, WordTag, TagConfig } from '@/types/word';

// 缓存
let cachedWords: Word[] | null = null;
let cachedTagConfigs: Record<WordTag, TagConfig> | null = null;

export const storage = {
  // 加载所有单词
  loadWords: async (): Promise<Word[]> => {
    const response = await fetch('/api/words', { credentials: 'include' });
    if (!response.ok) return [];
    const words = await response.json();
    cachedWords = words;
    return words;
  },

  // 获取缓存的单词（同步，用于已加载后访问）
  getWords: (): Word[] => {
    return cachedWords || [];
  },

  // 加载标签配置
  loadTagConfigs: async (): Promise<Record<WordTag, TagConfig>> => {
    const response = await fetch('/api/tags/config', { credentials: 'include' });
    if (!response.ok) return {};
    const configs = await response.json();
    cachedTagConfigs = configs;
    return configs;
  },

  // 获取缓存的标签配置（同步，用于已加载后访问）
  getTagConfigs: (): Record<WordTag, TagConfig> => {
    return cachedTagConfigs || {};
  },

  // 更新标签配置（fire-and-forget，本地缓存先行更新）
  updateTagConfigs: (newConfigs: Record<WordTag, TagConfig>): void => {
    cachedTagConfigs = newConfigs;
    fetch('/api/tags/config', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagConfigs: newConfigs }),
    }).catch(console.error);
  },
};
