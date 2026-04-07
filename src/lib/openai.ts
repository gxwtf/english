/**
 * OpenAI API 调用工具函数
 *
 * 使用方法:
 * const result = await callOpenAI('你的问题', { prompt: '附加说明' });
 */

const model = 'Qwen3.5-397B-A17B-NVFP4';

interface OpenAIOptions {
  prompt?: string;
  apiKey?: string;
  apiBase?: string;
  maxTokens?: number;
}

/**
 * 从 AI 返回的内容中解析 <think> 标签包裹的思考内容和正文。
 * @param content AI 返回的完整内容
 * @returns { thinking: 思考内容 | null, content: 正文 }
 */
export function parseThinkingContent(content: string): { thinking: string | null; content: string } {
  const match = content.match(/<think>([\s\S]*?)<\/think>([\s\S]*)/);
  if (match) {
    return { thinking: match[1].trim(), content: match[2].trim() };
  }
  return { thinking: null, content };
}

interface OpenAIResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * 从环境变量获取 API 配置
 */
function getApiConfig(): { apiKey: string; apiBase: string } {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

  if (!apiKey) {
    throw new Error('缺少 OPENAI_API_KEY 环境变量配置');
  }

  return { apiKey, apiBase };
}

/**
 * 调用 OpenAI API
 *
 * @param systemPrompt - 系统提示词
 * @param options - 可选配置项
 * @returns Promise<OpenAIResponse>
 *
 * @throws {Error} API 请求失败或返回非 200 状态码时抛出错误
 */
export async function callOpenAI(
  systemPrompt: string,
  options: OpenAIOptions = {}
): Promise<OpenAIResponse> {
  const { apiKey, apiBase } = getApiConfig();

  const {
    prompt = '',
    maxTokens = 2000,
  } = options;

  // 构建请求体
  const requestBody = {
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...(prompt ? [{ role: 'user', content: prompt }] : []),
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
  };

  // 如果 systemPrompt 为空且有 user prompt，调整消息结构
  if (!systemPrompt && prompt) {
    requestBody.messages = [{ role: 'user', content: prompt }];
  }

  // 发送请求
  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  // 检查响应状态
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `OpenAI API 请求失败：${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();

  // 检查 API 错误
  if (data.error) {
    throw new Error(`OpenAI API 错误：${JSON.stringify(data.error)}`);
  }

  return {
    content: data.choices?.[0]?.message?.content || '',
    usage: {
      prompt_tokens: data.usage?.prompt_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0,
    },
  };
}

/**
 * 封装方法：通过用户传入 prompt 调用 OpenAI
 *
 * @param prompt - 用户提示词
 * @param options - 可选配置项
 * @returns Promise<string> AI 回复内容
 */
export async function chat(
  prompt: string,
  options: Omit<OpenAIOptions, 'prompt'> = {}
): Promise<string> {
  const result = await callOpenAI('', { ...options, prompt });
  return result.content;
}

/**
 * 调用 OpenAI API with tool use support.
 * Auto-executes tool calls and returns final content.
 */
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
  const { apiKey, apiBase } = getApiConfig();
  const { prompt = '', maxTokens = 2000, tools } = options;

  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...(prompt ? [{ role: 'user', content: prompt }] : []),
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
  };

  if (tools) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

  const response = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(
      `OpenAI API 请求失败：${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`OpenAI API 错误：${JSON.stringify(data.error)}`);
  }

  const message = data.choices?.[0]?.message;
  let content = message?.content || '';
  const toolCalls = message?.tool_calls;

  // Auto-execute tool calls
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
      return {
        role: 'tool' as const,
        tool_call_id: toolCall.id,
        content: JSON.stringify({ result }),
      };
    });

    const followUpBody = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...(prompt ? [{ role: 'user', content: prompt }] : []),
        { role: 'assistant', content: content, tool_calls: toolCalls },
        ...toolMessages,
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      tool_choice: 'none',
    };

    const followUpResponse = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(followUpBody),
    });

    if (!followUpResponse.ok) {
      const errorText = await followUpResponse.text().catch(() => 'Unknown error');
      throw new Error(
        `OpenAI API 请求失败：${followUpResponse.status} ${followUpResponse.statusText} - ${errorText}`
      );
    }

    const followUpData = await followUpResponse.json();
    if (followUpData.error) {
      throw new Error(`OpenAI API 错误：${JSON.stringify(followUpData.error)}`);
    }
    content = followUpData.choices?.[0]?.message?.content || content;

    // Merge token usage
    const usage = {
      prompt_tokens: (data.usage?.prompt_tokens || 0) + (followUpData.usage?.prompt_tokens || 0),
      completion_tokens: (data.usage?.completion_tokens || 0) + (followUpData.usage?.completion_tokens || 0),
      total_tokens: (data.usage?.total_tokens || 0) + (followUpData.usage?.total_tokens || 0),
    };
    return { content, usage };
  }

  return {
    content,
    usage: {
      prompt_tokens: data.usage?.prompt_tokens || 0,
      completion_tokens: data.usage?.completion_tokens || 0,
      total_tokens: data.usage?.total_tokens || 0,
    },
  };
}
