export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export interface CompressResult {
  dataUrl: string;
  originalSize: {
    width: number;
    height: number;
    sizeKB: number;
  };
  compressedSize: {
    width: number;
    height: number;
    sizeKB: number;
  };
  compressionRatio: number;
  options: {
    maxWidth: number;
    maxHeight: number;
    quality: number;
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

function doCompress(img: HTMLImageElement, originalSizeKB: number, options: CompressImageOptions): CompressResult {
  const { maxWidth = 2048, maxHeight = 2048, quality = 0.8 } = options;
  const originalWidth = img.naturalWidth;
  const originalHeight = img.naturalHeight;

  let { width, height } = { width: originalWidth, height: originalHeight };
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法获取 Canvas 2D 上下文');

  ctx.drawImage(img, 0, 0, width, height);
  const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);

  const base64Length = compressedDataUrl.split(',')[1]?.length || 0;
  const compressedSizeKB = Math.round((base64Length * 3) / 4 / 1024);
  const compressionRatio = originalSizeKB > 0
    ? Math.round((1 - compressedSizeKB / originalSizeKB) * 100)
    : 0;

  return {
    dataUrl: compressedDataUrl,
    originalSize: { width: originalWidth, height: originalHeight, sizeKB: originalSizeKB },
    compressedSize: { width, height, sizeKB: compressedSizeKB },
    compressionRatio,
    options: { maxWidth, maxHeight, quality },
  };
}

export async function compressImage(
  file: File | Blob,
  options: CompressImageOptions = {}
): Promise<CompressResult> {
  const originalSizeKB = Math.round(file.size / 1024);

  // 先尝试 Object URL 方式
  try {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImage(objectUrl);
      return doCompress(img, originalSizeKB, options);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (objectUrlError) {
    // 回退到 FileReader 方式
    const errorMsg = objectUrlError instanceof Error ? objectUrlError.message : String(objectUrlError);
    console.warn('Object URL 方法失败，尝试使用 FileReader 回退:', errorMsg);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsDataURL(file);
      });
      const img = await loadImage(dataUrl);
      return doCompress(img, originalSizeKB, options);
    } catch (fileReaderError) {
      const error2Msg = fileReaderError instanceof Error ? fileReaderError.message : String(fileReaderError);
      throw new Error(`图片压缩失败: ${errorMsg} -> ${error2Msg}`);
    }
  }
}

export function getImageInfo(base64DataUrl: string): Promise<{
  width: number;
  height: number;
  sizeKB: number;
}> {
  const base64Length = base64DataUrl.split(',')[1]?.length || 0;
  const sizeInBytes = (base64Length * 3) / 4;
  const sizeKB = Math.round(sizeInBytes / 1024);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, sizeKB });
    img.onerror = () => resolve({ width: 0, height: 0, sizeKB });
    img.src = base64DataUrl;
  });
}
