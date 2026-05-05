export interface BatchUpdateConfig {
  // 批量更新配置
  batchSize: number;          // 每批处理的单词数量
  delayBetweenQueries: number; // 字典查询之间的延迟（毫秒）

  // 匹配配置
  matchThreshold: number;      // 匹配阈值（0-1）
  enableFuzzyMatch: boolean;   // 是否启用模糊匹配

  // 更新策略
  updateStrategy: 'all' | 'missing-only' | 'preview-only';

  // 日志配置
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  saveReport: boolean;         // 是否保存详细报告
  reportPath: string;          // 报告保存路径

  // 错误处理
  continueOnError: boolean;    // 遇到错误是否继续
  maxRetries: number;          // 最大重试次数
}

export const defaultConfig: BatchUpdateConfig = {
  batchSize: 50,
  delayBetweenQueries: 10,

  matchThreshold: 0.6,
  enableFuzzyMatch: true,

  updateStrategy: 'preview-only',

  logLevel: 'info',
  saveReport: true,
  reportPath: './meaning-update-report.json',

  continueOnError: true,
  maxRetries: 3
};
