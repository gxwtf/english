/**
 * OpenAI API 调用工具函数
 * 支持多供应商模型配置和降级策略
 */

export interface ModelConfig {
  name: string;
  model: string;
  apiKey?: string;
  apiBase: string;
  maxRetries?: number;
  timeout?: number;
}

function loadModelConfigs(envVarName: string, fallbackEnvPrefix: string): ModelConfig[] {
  const configsJson = process.env[envVarName];

  if (configsJson) {
    try {
      const configs = JSON.parse(configsJson);
      if (Array.isArray(configs) && configs.length > 0) return configs;
    } catch (e) {
      console.error(`解析 ${envVarName} 环境变量失败:`, e);
    }
  }

  const fallbackApiKey = process.env.OPENAI_API_KEY;
  const fallbackApiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

  const models: string[] = [];
  const primaryModel = process.env[`${fallbackEnvPrefix}_MODEL`];
  if (primaryModel) models.push(primaryModel);

  let index = 1;
  while (true) {
    const modelEnv = process.env[`${fallbackEnvPrefix}_MODEL_${index}`];
    if (!modelEnv) break;
    models.push(modelEnv);
    index++;
  }

  if (models.length > 0 && fallbackApiKey) {
    console.log(`使用旧版环境变量配置 ${envVarName}，建议迁移到 JSON 格式`);
    return models.map((model, i) => ({
      name: `model-${i}`,
      model,
      apiKey: fallbackApiKey,
      apiBase: fallbackApiBase,
    }));
  }

  return [];
}

const modelConfigs = loadModelConfigs('LLM_CONFIGS', 'OPENAI');

console.log(`已加载 ${modelConfigs.length} 个文本模型配置: ${modelConfigs.map(c => c.name).join(', ')}`);

interface OpenAIOptions {
  prompt?: string;
  timeout?: number;
  temperature?: number;
  reasoning_effort?: 'low' | 'medium' | 'high' | number; // Deepseek 深度思考模式
  response_format?: { type: 'json_object' }; // 结构化输出
}

export function parseThinkingContent(content: string): { thinking: string | null; content: string } {
  const match = content.match(/<reason>([\s\S]*?)<\/reason>([\s\S]*)/);
  if (match) return { thinking: match[1].trim(), content: match[2].trim() };
  return { thinking: null, content };
}

interface OpenAIResponse {
  content: string;
  thinking: string | null;
  reasoning_content?: string | null; // Deepseek 原生深度思考内容
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ===== 通用重试+降级逻辑 =====

interface CallOptions {
  configs: ModelConfig[];
  buildRequestBody: (config: ModelConfig) => Record<string, unknown>;
  parseResponse: (data: any, config: ModelConfig) => Promise<OpenAIResponse> | OpenAIResponse;
  label?: string;
  timeout?: number;
  defaultTimeout?: number;
  defaultMaxRetries?: number;
}

async function callWithRetry(opts: CallOptions): Promise<OpenAIResponse> {
  const {
    configs, buildRequestBody, parseResponse, label = '模型',
    timeout, defaultTimeout = 300000, defaultMaxRetries = 2,
  } = opts;

  let lastError: Error | null = null;

  for (let configIndex = 0; configIndex < configs.length; configIndex++) {
    const config = configs[configIndex];
    const timeoutMs = timeout ?? config.timeout ?? defaultTimeout;
    const maxRetriesPerModel = config.maxRetries ?? defaultMaxRetries;

    if (!config.apiKey) {
      console.warn(`${label} ${config.name} 未配置 API Key，跳过`);
      continue;
    }

    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const requestBody = buildRequestBody(config);
        const response = await fetch(`${config.apiBase}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`API 请求失败：${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(`API 错误：${JSON.stringify(data.error)}`);

        return await parseResponse(data, config);
      } catch (error) {
        clearTimeout(timeoutId);
        lastError = error as Error;

        if (error instanceof Error && error.name === 'AbortError') {
          console.warn(`${label} ${config.name} 请求超时（第${attempt + 1}次）${attempt < maxRetriesPerModel ? '，重试中...' : '，尝试下一个模型...'}`);
          if (attempt < maxRetriesPerModel) { await new Promise(r => setTimeout(r, 1000)); continue; }
        }

        if (error instanceof Error && (error.message.includes('500') || error.message.includes('503') || error.message.includes('504'))) {
          const errorCode = error.message.includes('500') ? '500' : error.message.includes('503') ? '503' : '504';
          console.warn(`${label} ${config.name} ${errorCode} 错误（第${attempt + 1}次）${attempt < maxRetriesPerModel ? '，重试中...' : '，尝试下一个模型...'}`);
          if (attempt < maxRetriesPerModel) { await new Promise(r => setTimeout(r, 3000)); continue; }
        }

        if (attempt < maxRetriesPerModel) { await new Promise(r => setTimeout(r, 1000)); continue; }
      }
    }

    if (configIndex < configs.length - 1) {
      console.warn(`${label} ${config.name} 多次失败，切换到下一个模型 ${configs[configIndex + 1].name}...`);
    }
  }

  throw lastError || new Error('所有模型调用失败');
}

// ===== 公开 API =====

export async function callOpenAI(
  systemPrompt: string,
  options: OpenAIOptions = {}
): Promise<OpenAIResponse> {
  const { prompt = '', temperature, response_format } = options;

  return callWithRetry({
    configs: modelConfigs,
    timeout: options.timeout,
    buildRequestBody: (config) => {
      const messages = [];
      if (systemPrompt && prompt) {
        messages.push({ role: 'system', content: systemPrompt }, { role: 'user', content: prompt });
      } else if (prompt) {
        messages.push({ role: 'user', content: prompt });
      } else {
        messages.push({ role: 'user', content: systemPrompt });
      }
      const body: Record<string, unknown> = { model: config.model, messages, temperature: temperature ?? 0.7 };
      if (response_format) { body.response_format = response_format; }
      return body;
    },
    parseResponse: (data) => {
      const message = data.choices?.[0]?.message;
      const content = message?.content ?? message?.reasoning ?? '';
      return {
        content,
        thinking: null,
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0,
        },
      };
    },
  });
}

export async function callTextAI(
  systemPrompt: string,
  userPrompt: string,
  options: { timeout?: number; temperature?: number } = {}
): Promise<OpenAIResponse> {
  const allConfigs = [...modelConfigs];
  if (allConfigs.length === 0) throw new Error('未配置任何模型');

  const { timeout, temperature = 0.1 } = options;

  return callWithRetry({
    configs: allConfigs,
    timeout,
    defaultMaxRetries: 1,
    label: '文本模型',
    buildRequestBody: (config) => ({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
    }),
    parseResponse: (data) => {
      const message = data.choices?.[0]?.message;
      const content = message?.content ?? message?.reasoning ?? '';
      const thinkingContent = message?.reasoning_content || null;
      return {
        content,
        thinking: thinkingContent,
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0,
        },
      };
    },
  });
}

export async function chat(
  prompt: string,
  options: Omit<OpenAIOptions, 'prompt'> = {}
): Promise<string> {
  const result = await callOpenAI('', { ...options, prompt });
  return result.content;
}

export async function callOpenAIWithTools(
  systemPrompt: string,
  options: OpenAIOptions & {
    tools?: Array<{
      type: string;
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }>;
  } = {}
): Promise<OpenAIResponse> {
  const { prompt = '', tools, reasoning_effort, response_format } = options;

  return callWithRetry({
    configs: modelConfigs,
    timeout: options.timeout,
    label: '模型 (with tools)',
    buildRequestBody: (config) => {
      const body: Record<string, unknown> = {
        model: config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...(prompt ? [{ role: 'user', content: prompt }] : []),
        ],
        temperature: 0.7,
      };
      if (tools) { body.tools = tools; body.tool_choice = 'auto'; }
      if (reasoning_effort) { body.reasoning_effort = reasoning_effort; } // Deepseek 深度思考模式
      if (response_format) { body.response_format = response_format; } // 结构化输出
      return body;
    },
    parseResponse: async (data, config) => {
      const message = data.choices?.[0]?.message;
      let content = message?.content || '';
      const reasoningContent = message?.reasoning_content || null; // Deepseek 原生深度思考内容
      const toolCalls = message?.tool_calls;

      if (toolCalls && toolCalls.length > 0) {
        const toolMessages = toolCalls.map((toolCall: { id: string; function: { name: string; arguments: string } }) => {
          const args = JSON.parse(toolCall.function.arguments);
          let result: unknown;
          if (toolCall.function.name === 'generateRandomNumber') {
            const min = Math.ceil(args.min || 0);
            const max = Math.floor(args.max || 100);
            result = Math.floor(Math.random() * (max - min + 1)) + min;
          } else {
            result = null;
          }
          return { role: 'tool' as const, tool_call_id: toolCall.id, content: JSON.stringify({ result }) };
        });

        const followUpBody: Record<string, unknown> = {
          model: config.model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...(prompt ? [{ role: 'user', content: prompt }] : []),
            { role: 'assistant', content, tool_calls: toolCalls },
            ...toolMessages,
          ],
          temperature: 0.7,
          tool_choice: 'none',
        };
        if (reasoning_effort) { followUpBody.reasoning_effort = reasoning_effort; } // Deepseek 深度思考模式
        if (response_format) { followUpBody.response_format = response_format; } // 结构化输出（保持与初始请求一致）

        const followUpResponse = await fetch(`${config.apiBase}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` },
          body: JSON.stringify(followUpBody),
        });

        if (!followUpResponse.ok) {
          const errorText = await followUpResponse.text().catch(() => 'Unknown error');
          throw new Error(`API 请求失败：${followUpResponse.status} ${followUpResponse.statusText} - ${errorText}`);
        }

        const followUpData = await followUpResponse.json();
        if (followUpData.error) throw new Error(`API 错误：${JSON.stringify(followUpData.error)}`);
        content = followUpData.choices?.[0]?.message?.content || content;
        const followUpReasoningContent = followUpData.choices?.[0]?.message?.reasoning_content || null;

        return {
          content,
          thinking: null,
          reasoning_content: reasoningContent || followUpReasoningContent,
          usage: {
            prompt_tokens: (data.usage?.prompt_tokens || 0) + (followUpData.usage?.prompt_tokens || 0),
            completion_tokens: (data.usage?.completion_tokens || 0) + (followUpData.usage?.completion_tokens || 0),
            total_tokens: (data.usage?.total_tokens || 0) + (followUpData.usage?.total_tokens || 0),
          },
        };
      }

      return {
        content,
        thinking: null,
        reasoning_content: reasoningContent,
        usage: {
          prompt_tokens: data.usage?.prompt_tokens || 0,
          completion_tokens: data.usage?.completion_tokens || 0,
          total_tokens: data.usage?.total_tokens || 0,
        },
      };
    },
  });
}
