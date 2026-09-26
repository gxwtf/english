export type AiModelMode = 'system' | 'custom';

export interface AiSettings {
  /** system = 使用系统提供的大模型；custom = 使用用户自定义的 API 配置 */
  mode: AiModelMode;
  apiKey?: string;
  apiBase?: string;
  model?: string;
}
