'use server';

import { callVisionAI } from '@/lib/openai';
import { Meaning } from '@/types/dict';

export interface RecognizedWord {
  text: string;
  meanings: Meaning[];
}

export async function recognizeWordsFromImage(
  base64Image: string,
  annotationStyle: string
): Promise<RecognizedWord[]> {
  const systemPrompt = `你是一个英语学习助手，帮助识别图片中学生标记为"不认识"的英语单词。

任务：识别图片中学生用"${annotationStyle}"方式标记为"不认识"的英语单词。

重要规则：
1. 只识别用"${annotationStyle}"方式标记的单词，其他标记方式的单词不要识别
2. 如果图片中的标记方式与"${annotationStyle}"不一致，则不识别任何单词，返回空数组 {"words":[]}
3. 标记方式说明：
   - "高亮"：单词被荧光笔或高亮笔标记，呈现明显的颜色背景
   - "红笔圈出"：单词被红色笔圈起来，有明显的圆形或椭圆形圈
   - "红下划线"：单词下方有红色的下划线
   - "自定义"：用户自定义的标记方式，请根据用户描述判断
4. 返回JSON格式：{"words":[{"text":"单词"}]}
5. 只返回纯JSON，不要添加任何解释或说明`;

  const userPrompt = `请仔细观察图片中的标记方式，只识别用"${annotationStyle}"方式标记的英语生词。如果标记方式不一致，返回空数组。`;

  try {
    const response = await callVisionAI(systemPrompt, userPrompt, base64Image, {
      enableThinking: true,
      maxReasoningTokens: 512
    });
    let content = response.content;
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
    
    const result = JSON.parse(content);
    return (result.words || []).map((w: any) => ({
      text: w.text,
      meanings: []
    }));
  } catch (error) {
    console.error('识别单词失败:', error);
    throw new Error('识别单词失败，请重试');
  }
}
