import { Word, WordTag, TagConfig, ColorConfig, IconConfig } from '@/types/word';
import { COLOR_PRESETS, ICON_PRESETS } from '@/constants/word-tags';

const STORAGE_KEY = 'gxwtf_english_words';
const TAGS_CONFIG_KEY = 'gxwtf_english_tags';

export const storage = {
  getWords: (): Word[] => {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  },

  saveWords: (words: Word[]): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  },

  addWord: (word: Word): void => {
    const words = storage.getWords();
    words.push(word);
    storage.saveWords(words);
  },

  updateWord: (id: number, updatedWord: Partial<Word>): void => {
    const words = storage.getWords();
    const index = words.findIndex(w => w.id === id);
    if (index !== -1) {
      words[index] = { ...words[index], ...updatedWord };
      storage.saveWords(words);
    }
  },

  deleteWord: (id: number): void => {
    const words = storage.getWords();
    const filtered = words.filter(w => w.id !== id);
    storage.saveWords(filtered);
  },

  deleteWordsByIds: (ids: number[]): void => {
    const words = storage.getWords();
    const filtered = words.filter(w => !ids.includes(w.id));
    storage.saveWords(filtered);
  },

  // 标签配置相关方法
  getTagConfigs: (): Record<WordTag, TagConfig> => {
    if (typeof window === 'undefined') return {};
    const stored = localStorage.getItem(TAGS_CONFIG_KEY);
    let tagConfigs: Record<WordTag, TagConfig> = stored ? JSON.parse(stored) : {};

    // 迁移旧格式到新格式
    tagConfigs = storage.migrateTagConfigs(tagConfigs);

    return tagConfigs;
  },

  // 迁移标签配置从旧格式到新格式
  migrateTagConfigs: (oldConfigs: Record<WordTag, any>): Record<WordTag, TagConfig> => {
    const migrated: Record<WordTag, TagConfig> = {};

    for (const [key, oldConfig] of Object.entries(oldConfigs)) {
      // 如果已经是新格式，直接使用
      if (oldConfig.iconId && oldConfig.colorId) {
        migrated[key] = oldConfig as TagConfig;
        continue;
      }

      // 旧格式迁移：从 color 和 icon 属性推断对应的 ID
      let colorId = 'blue'; // 默认
      let iconId = 'dot'; // 默认

      // 根据颜色类名推断颜色 ID
      for (const color of COLOR_PRESETS) {
        if (oldConfig.color === color.className) {
          colorId = color.id;
          break;
        }
      }

      // 根据图标符号推断图标 ID
      for (const icon of ICON_PRESETS) {
        if (oldConfig.icon === icon.symbol) {
          iconId = icon.id;
          break;
        }
      }

      migrated[key] = {
        id: key,
        name: oldConfig.name || key,
        iconId: iconId,
        colorId: colorId,
        description: oldConfig.description || oldConfig.name || key
      };
    }

    return migrated;
  },

  saveTagConfigs: (tagConfigs: Record<WordTag, TagConfig>): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(TAGS_CONFIG_KEY, JSON.stringify(tagConfigs));
  },

  updateTagConfigs: (newConfigs: Record<WordTag, TagConfig>): void => {
    storage.saveTagConfigs(newConfigs);
  }
};