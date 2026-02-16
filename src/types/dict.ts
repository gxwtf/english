export interface DictionaryMeaning {
  content: string;
  type: string;
  sentence?: string;
}

export interface DictionaryEntry {
  word: string;
  pronunciation?: string;
  meanings: DictionaryMeaning[];
}