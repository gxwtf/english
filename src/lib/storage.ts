import { Word } from '@/types/word';

const STORAGE_KEY = 'gxwtf_english_words';

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
  }
};