import { Word, WordTag, TagConfig } from '@/types/word';
import { loadWords as loadWordsAction, loadTagConfigs as loadTagConfigsAction, saveTagConfigs as saveTagConfigsAction } from '@/actions/words';

// 缓存
let cachedWords: Word[] | null = null;
let cachedTagConfigs: Record<WordTag, TagConfig> | null = null;

export const storage = {
  // 加载所有单词
  loadWords: async (): Promise<Word[]> => {
    const words = await loadWordsAction();
    cachedWords = words;
    return words;
  },

  // 获取缓存的单词（同步，用于已加载后访问）
  getWords: (): Word[] => {
    return cachedWords || [];
  },

  // 加载标签配置
  loadTagConfigs: async (): Promise<Record<WordTag, TagConfig>> => {
    const configs = await loadTagConfigsAction();
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
    saveTagConfigsAction(newConfigs as any).catch(console.error);
  },
};
