export type ReviewScopeMode = 'all' | 'custom';

export interface ReviewSettings {
  /** all = 复习全部单词本；custom = 只复习选中的单词本 */
  mode: ReviewScopeMode;
  /** 选中复习的单词本 ID 列表（mode=custom 时生效） */
  wordbookIds: number[];
}
