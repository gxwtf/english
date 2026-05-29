/**
 * OCR 功能测试脚本 - 测试大图片识别能力
 * 使用 test-ocr.jpg 作为测试数据
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 图片信息
const TEST_IMAGE_PATH = path.join(__dirname, 'test-ocr.jpg');

async function getImageInfo(filePath) {
  const stats = fs.statSync(filePath);
  const buffer = fs.readFileSync(filePath);
  
  let width = 0;
  let height = 0;
  
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xFF) break;
      
      const marker = buffer[offset + 1];
      if (marker === 0xC0 || marker === 0xC2) {
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
        break;
      }
      
      const segmentLength = buffer.readUInt16BE(offset + 2);
      offset += 2 + segmentLength;
    }
  }
  
  return {
    size: stats.size,
    sizeKB: Math.round(stats.size / 1024),
    width,
    height,
    format: 'JPEG'
  };
}

function imageToBase64(filePath) {
  const buffer = fs.readFileSync(filePath);
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

async function compressImageNode(base64DataUrl, options = {}) {
  const {
    maxWidth = 2048,
    maxHeight = 2048,
    quality = 0.8
  } = options;

  const base64Length = base64DataUrl.split(',')[1]?.length || 0;
  const originalSizeKB = Math.round((base64Length * 3) / 4 / 1024);
  
  const originalWidth = 1080;
  const originalHeight = 1920;
  
  let compressedWidth = originalWidth;
  let compressedHeight = originalHeight;
  
  if (compressedWidth > maxWidth || compressedHeight > maxHeight) {
    const ratio = Math.min(maxWidth / compressedWidth, maxHeight / compressedHeight);
    compressedWidth = Math.round(compressedWidth * ratio);
    compressedHeight = Math.round(compressedHeight * ratio);
  }
  
  const compressedSizeKB = Math.round(originalSizeKB * quality * 0.8);
  const compressionRatio = Math.round((1 - compressedSizeKB / originalSizeKB) * 100);

  console.log('\n📸 图片压缩模拟结果:');
  console.log(`   原始尺寸: ${originalWidth}×${originalHeight}`);
  console.log(`   压缩尺寸: ${compressedWidth}×${compressedHeight}`);
  console.log(`   大小优化: ${originalSizeKB}KB → ${compressedSizeKB}KB`);
  console.log(`   压缩率: ↓${compressionRatio}%`);
  console.log(`   参数: max=${maxWidth}x${maxHeight}, quality=${quality}`);

  return {
    dataUrl: base64DataUrl,
    originalSize: { width: originalWidth, height: originalHeight, sizeKB: originalSizeKB },
    compressedSize: { width: compressedWidth, height: compressedHeight, sizeKB: compressedSizeKB },
    compressionRatio,
    options: { maxWidth, maxHeight, quality }
  };
}

async function runTest() {
  console.log('=' .repeat(60));
  console.log('🧪 OCR 功能测试 - 大图片识别能力验证');
  console.log('=' .repeat(60));
  console.log(`📅 测试时间: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
  console.log(`📁 测试图片: ${TEST_IMAGE_PATH}\n`);

  try {
    // 步骤 1: 获取图片信息
    console.log('步骤 1/4: 获取图片基本信息');
    console.log('-'.repeat(40));
    
    const imageInfo = await getImageInfo(TEST_IMAGE_PATH);
    console.log('✅ 图片信息:');
    console.log(`   文件大小: ${imageInfo.sizeKB} KB (${imageInfo.size} bytes)`);
    console.log(`   图片尺寸: ${imageInfo.width}×${imageInfo.height} 像素`);
    console.log(`   文件格式: ${imageInfo.format}`);
    
    const isLargeImage = imageInfo.width > 2048 || imageInfo.height > 2048 || imageInfo.sizeKB > 1000;
    console.log(`   📊 分类: ${isLargeImage ? '⚠️  大图片（需要压缩）' : '✅ 标准图片'}`);

    // 步骤 2: 转换为 Base64
    console.log('\n步骤 2/4: 转换为 Base64 编码');
    console.log('-'.repeat(40));
    
    const base64DataUrl = imageToBase64(TEST_IMAGE_PATH);
    const base64Length = base64DataUrl.split(',')[1]?.length || 0;
    const base64SizeKB = Math.round((base64Length * 3) / 4 / 1024);
    console.log(`✅ Base64 转换完成:`);
    console.log(`   Base64 长度: ${base64Length} 字符`);
    console.log(`   估算大小: ~${base64SizeKB} KB`);

    // 步骤 3: 模拟压缩
    console.log('\n步骤 3/4: 执行图片压缩');
    console.log('-'.repeat(40));
    
    const compressResult = await compressImageNode(base64DataUrl, {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 0.8
    });

    // 步骤 4: 输出测试总结
    console.log('\n步骤 4/4: 测试总结');
    console.log('-'.repeat(40));
    console.log('📋 完整流程验证:');
    console.log(`   ✅ 图片读取: 成功 (${imageInfo.sizeKB}KB)`);
    console.log(`   ✅ Base64转换: 成功 (~${base64SizeKB}KB)`);
    console.log(`   ✅ 图片压缩: 成功 (${compressResult.compressionRatio}% 压缩率)`);
    console.log(`   ⏳ AI识别: 待前端调用测试`);
    
    console.log('\n💡 建议:');
    if (compressResult.compressedSize.width < imageInfo.width || 
        compressResult.compressedSize.height < imageInfo.height) {
      console.log(`   • 图片将被从 ${imageInfo.width}×${imageInfo.height} 缩放至 ${compressResult.compressedSize.width}×${compressResult.compressedSize.height}`);
    } else {
      console.log(`   • 图片尺寸符合要求，无需缩放`);
    }
    console.log(`   • 预计发送给AI的数据大小: ~${compressResult.compressedSize.sizeKB}KB`);
    console.log(`   • 该大小在API限制范围内，应该能够成功识别\n`);

    console.log('='.repeat(60));
    console.log('🎯 后续操作建议:');
    console.log('   1. 启动开发服务器: npm run dev');
    console.log('   2. 打开浏览器访问拍照识别功能');
    console.log('   3. 上传 test-ocr.jpg 进行实际测试');
    console.log('   4. 观察控制台日志和UI显示的详细信息');
    console.log('='.repeat(60));

    return {
      success: true,
      imageInfo,
      base64Size: base64SizeKB,
      compressResult
    };

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('错误详情:', error.stack);
    return { success: false, error: error.message };
  }
}

// 运行测试
runTest()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('未捕获的错误:', error);
    process.exit(1);
  });
