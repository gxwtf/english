import { config } from 'dotenv';
config({ path: '.env.local' });

const model = process.env.OPENAI_MODEL || 'Qwen3.5-397B-A17B-NVFP4';
const apiKey = process.env.OPENAI_API_KEY;
const apiBase = process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';

interface BaseTestResult {
  name: string;
  success: boolean;
  duration: number;
  error?: string;
}

interface JsonTestResult extends BaseTestResult {
  rawResponse?: string;
  parsedJson?: object;
}

interface VisionTestResult extends BaseTestResult {
  rawResponse?: string;
  imageAnalyzed: boolean;
}

interface ReasoningTestResult extends BaseTestResult {
  rawResponse?: string;
  reasoningContent?: string;
  hasReasoning: boolean;
  reasoningInResponse: boolean;
}

async function testJsonMode(
  name: string,
  responseFormat?: { type: string; json_schema?: object }
): Promise<JsonTestResult> {
  const startTime = Date.now();

  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'system',
        content: '请以 JSON 格式返回数据。',
      },
      {
        role: 'user',
        content: '请返回一个包含 name 和 age 字段的 JSON 对象，name 为 "张三"，age 为 25。',
      },
    ],
    temperature: 0.1,
  };

  if (responseFormat) {
    requestBody.response_format = responseFormat;
  }

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        name,
        success: false,
        duration,
        error: `HTTP ${response.status}: ${errorText.slice(0, 500)}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    let parsedJson: object | undefined;
    let parseError: string | undefined;

    try {
      parsedJson = JSON.parse(content);
    } catch (e) {
      parseError = e instanceof Error ? e.message : String(e);
    }

    return {
      name,
      success: true,
      duration,
      rawResponse: content.slice(0, 500),
      parsedJson,
      error: parseError ? `JSON 解析失败: ${parseError}` : undefined,
    };
  } catch (error) {
    return {
      name,
      success: false,
      duration: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testVision(): Promise<VisionTestResult> {
  const startTime = Date.now();
  const testName = '图片输入 (Vision)';

  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '请用一句话描述这张图片的内容。',
          },
          {
            type: 'image_url',
            image_url: {
              url: 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png',
            },
          },
        ],
      },
    ],
    max_tokens: 100,
  };

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      const isVisionNotSupported =
        response.status === 400 &&
        (errorText.includes('image') ||
          errorText.includes('vision') ||
          errorText.includes('multimodal') ||
          errorText.includes('does not support'));

      return {
        name: testName,
        success: false,
        duration,
        imageAnalyzed: false,
        error: isVisionNotSupported
          ? '模型不支持图片输入'
          : `HTTP ${response.status}: ${errorText.slice(0, 300)}`,
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const imageAnalyzed =
      content.length > 0 &&
      (content.toLowerCase().includes('google') ||
        content.toLowerCase().includes('logo') ||
        content.toLowerCase().includes('图片') ||
        content.toLowerCase().includes('图像') ||
        content.toLowerCase().includes('标志'));

    return {
      name: testName,
      success: true,
      duration,
      rawResponse: content.slice(0, 300),
      imageAnalyzed,
    };
  } catch (error) {
    return {
      name: testName,
      success: false,
      duration: Date.now() - startTime,
      imageAnalyzed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function testReasoning(): Promise<ReasoningTestResult> {
  const startTime = Date.now();
  const testName = '深度思考 (Reasoning)';

  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'user',
        content: '请计算 123 * 456 等于多少？请展示你的思考过程。',
      },
    ],
    temperature: 0.1,
  };

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        name: testName,
        success: false,
        duration,
        hasReasoning: false,
        reasoningInResponse: false,
        error: `HTTP ${response.status}: ${errorText.slice(0, 300)}`,
      };
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message;
    const content = message?.content || '';
    const reasoningContent = message?.reasoning_content || data.choices?.[0]?.reasoning || null;

    const hasReasoningField = !!reasoningContent;

    const thinkingPatterns = [
      /<think[\s\S]*?>[\s\S]*?<\/think>/i,
      /<reason[\s\S]*?>[\s\S]*?<\/reason>/i,
      /<thinking[\s\S]*?>[\s\S]*?<\/thinking>/i,
      /思考[过程：:]/,
      /推理[过程：:]/,
      /分析[：:]/,
    ];

    const reasoningInResponse = thinkingPatterns.some((pattern) => pattern.test(content));

    return {
      name: testName,
      success: true,
      duration,
      rawResponse: content.slice(0, 500),
      reasoningContent: reasoningContent ? String(reasoningContent).slice(0, 300) : undefined,
      hasReasoning: hasReasoningField,
      reasoningInResponse,
    };
  } catch (error) {
    return {
      name: testName,
      success: false,
      duration: Date.now() - startTime,
      hasReasoning: false,
      reasoningInResponse: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function printSeparator() {
  console.log('\n' + '-'.repeat(70));
}

function printHeader(title: string) {
  console.log('\n' + '='.repeat(70));
  console.log(title);
  console.log('='.repeat(70));
}

async function main() {
  printHeader('🧪 大模型能力测试');

  console.log(`\n📋 配置信息:`);
  console.log(`   模型: ${model}`);
  console.log(`   API Base: ${apiBase}`);
  console.log(`   API Key: ${apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}` : '未设置'}`);

  if (!apiKey) {
    console.error('\n❌ 错误: 未设置 OPENAI_API_KEY 环境变量');
    process.exit(1);
  }

  console.log('\n开始测试...');

  const jsonResults: JsonTestResult[] = [];
  const featureResults: { vision?: VisionTestResult; reasoning?: ReasoningTestResult } = {};

  console.log('\n📌 第一部分：结构化输出测试');
  printSeparator();

  console.log('\n测试 1/3: 普通模式...');
  jsonResults.push(await testJsonMode('1. 普通模式（无 response_format）'));
  await delay(1500);

  console.log('测试 2/3: JSON Mode...');
  jsonResults.push(await testJsonMode('2. JSON Mode', { type: 'json_object' }));
  await delay(1500);

  const jsonSchema = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
    },
    required: ['name', 'age'],
  };

  console.log('测试 3/3: Structured Outputs...');
  jsonResults.push(
    await testJsonMode('3. Structured Outputs (JSON Schema)', {
      type: 'json_schema',
      json_schema: {
        name: 'person',
        strict: true,
        schema: jsonSchema,
      },
    })
  );
  await delay(1500);

  console.log('\n📌 第二部分：多模态能力测试');
  printSeparator();

  console.log('\n测试: 图片输入 (Vision)...');
  featureResults.vision = await testVision();
  await delay(1500);

  console.log('\n📌 第三部分：推理能力测试');
  printSeparator();

  console.log('\n测试: 深度思考 (Reasoning)...');
  featureResults.reasoning = await testReasoning();

  printHeader('📊 测试结果汇总');

  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                      结构化输出测试结果                              │');
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  for (const result of jsonResults) {
    const status = result.success ? '✅ 成功' : '❌ 失败';
    const jsonStatus = result.parsedJson
      ? '✅ 有效 JSON'
      : result.error?.includes('JSON 解析')
        ? '⚠️ JSON 无效'
        : '';

    console.log(`\n${result.name}`);
    console.log(`   状态: ${status}`);
    console.log(`   耗时: ${result.duration}ms`);
    if (jsonStatus) console.log(`   JSON: ${jsonStatus}`);
    if (result.error && !result.error.includes('JSON 解析')) {
      console.log(`   错误: ${result.error}`);
    }
    if (result.rawResponse) {
      console.log(`   响应: ${result.rawResponse}`);
    }
    if (result.parsedJson) {
      console.log(`   解析结果: ${JSON.stringify(result.parsedJson)}`);
    }
  }

  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                      多模态能力测试结果                              │');
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  const vision = featureResults.vision;
  if (vision) {
    const status = vision.success ? '✅ 成功' : '❌ 失败';
    const supportStatus = vision.imageAnalyzed ? '✅ 支持图片输入' : '⚠️ 可能不支持';

    console.log(`\n${vision.name}`);
    console.log(`   状态: ${status}`);
    console.log(`   图片理解: ${supportStatus}`);
    console.log(`   耗时: ${vision.duration}ms`);
    if (vision.error) {
      console.log(`   错误: ${vision.error}`);
    }
    if (vision.rawResponse) {
      console.log(`   响应: ${vision.rawResponse}`);
    }
  }

  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                      推理能力测试结果                                │');
  console.log('└─────────────────────────────────────────────────────────────────────┘');

  const reasoning = featureResults.reasoning;
  if (reasoning) {
    const status = reasoning.success ? '✅ 成功' : '❌ 失败';
    const reasoningFieldStatus = reasoning.hasReasoning ? '✅ 有 reasoning_content 字段' : '❌ 无 reasoning_content 字段';
    const thinkingTagStatus = reasoning.reasoningInResponse ? '✅ 响应中包含思考标签' : '❌ 响应中无思考标签';

    console.log(`\n${reasoning.name}`);
    console.log(`   状态: ${status}`);
    console.log(`   耗时: ${reasoning.duration}ms`);
    console.log(`   reasoning_content 字段: ${reasoningFieldStatus}`);
    console.log(`   思考标签检测: ${thinkingTagStatus}`);
    if (reasoning.error) {
      console.log(`   错误: ${reasoning.error}`);
    }
    if (reasoning.reasoningContent) {
      console.log(`   推理内容: ${reasoning.reasoningContent}...`);
    }
    if (reasoning.rawResponse) {
      console.log(`   响应: ${reasoning.rawResponse}`);
    }
  }

  printHeader('📝 结论');

  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                        能力支持情况                                  │');
  console.log('└─────────────────────────────────────────────────────────────────────┘\n');

  const normalSuccess = jsonResults[0].success;
  const jsonModeSuccess = jsonResults[1].success && jsonResults[1].parsedJson;
  const structuredSuccess = jsonResults[2].success && jsonResults[2].parsedJson;
  const visionSupported = featureResults.vision?.imageAnalyzed ?? false;
  const reasoningSupported = featureResults.reasoning?.hasReasoning || featureResults.reasoning?.reasoningInResponse;

  console.log(`  普通模式:           ${normalSuccess ? '✅ 支持' : '❌ 不支持'}`);
  console.log(`  JSON Mode:          ${jsonModeSuccess ? '✅ 支持' : jsonResults[1].success ? '⚠️ 部分支持' : '❌ 不支持'}`);
  console.log(`  Structured Outputs: ${structuredSuccess ? '✅ 支持' : jsonResults[2].success ? '⚠️ 部分支持' : '❌ 不支持'}`);
  console.log(`  图片输入 (Vision):  ${visionSupported ? '✅ 支持' : '❌ 不支持'}`);
  console.log(`  深度思考 (Reasoning): ${reasoningSupported ? '✅ 支持' : '❌ 不支持'}`);

  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│                          使用建议                                    │');
  console.log('└─────────────────────────────────────────────────────────────────────┘\n');

  if (jsonModeSuccess) {
    console.log('  ✅ 推荐使用 JSON Mode (`response_format: { type: "json_object" }`)');
    console.log('     可大幅减少 JSON 解析错误，提高稳定性');
  }
  if (structuredSuccess) {
    console.log('  ✅ Structured Outputs 支持完整的 JSON Schema 校验');
    console.log('     可确保输出完全符合预期格式');
  }
  if (visionSupported) {
    console.log('  ✅ 支持图片输入，可用于多模态应用场景');
  }
  if (reasoningSupported) {
    console.log('  ✅ 支持深度思考，可用于复杂推理任务');
    if (featureResults.reasoning?.hasReasoning) {
      console.log('     可通过 message.reasoning_content 获取推理过程');
    }
  }
  if (!jsonModeSuccess && !structuredSuccess) {
    console.log('  ⚠️ 当前模型不支持结构化输出，需要继续使用手动解析方式');
  }

  console.log('\n');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
