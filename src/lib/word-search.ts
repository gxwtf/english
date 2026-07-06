import Fuse from 'fuse.js';
import type { TagConfig, Word, WordTag } from '@/types/word';

interface WordSearchRecord {
  word: Word;
  text: string;
  meaningsText: string;
  tagsText: string;
  relatedWordsText: string;
}

const SEARCH_KEYS = [
  { name: 'text', weight: 0.65 },
  { name: 'meaningsText', weight: 0.2 },
  { name: 'tagsText', weight: 0.1 },
  { name: 'relatedWordsText', weight: 0.05 },
];

function compactText(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
}

function buildWordSearchRecord(word: Word, tagConfigs: Record<WordTag, TagConfig>): WordSearchRecord {
  return {
    word,
    text: word.text,
    meaningsText: compactText(word.meanings.map((meaning) => `${meaning.type} ${meaning.content}`)),
    tagsText: compactText(word.tags.flatMap((tag) => {
      const config = tagConfigs[tag];
      return [tag, config?.name, config?.description];
    })),
    relatedWordsText: compactText((word.relatedWords ?? []).map((relatedWord) => relatedWord.text)),
  };
}

export function fuzzySearchWords(
  words: Word[],
  searchTerm: string,
  tagConfigs: Record<WordTag, TagConfig>,
): Word[] {
  const query = searchTerm.trim();

  if (!query) {
    return words;
  }

  const records = words.map((word) => buildWordSearchRecord(word, tagConfigs));
  const fuse = new Fuse(records, {
    keys: SEARCH_KEYS,
    threshold: 0.38,
    ignoreLocation: true,
    ignoreFieldNorm: true,
    minMatchCharLength: 1,
  });

  return fuse.search(query).map((result) => result.item.word);
}
