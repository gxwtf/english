export interface Meaning {
  content: string;
  type: string;
  sentence?: string;
}

export interface DictionaryEntry {
  word: string;
  pronunciation?: string;
  meaning: Meaning[];
}