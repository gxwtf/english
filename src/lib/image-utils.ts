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

async function compressWithObjectUrl(
  file: File | Blob,
  options: CompressImageOptions
): Promise<CompressResult> {
  const { maxWidth = 2048, maxHeight = 2048, quality = 0.8 } = options;
  const originalSizeKB = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      try {
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
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('无法获取 Canvas 2D 上下文'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        
        URL.revokeObjectURL(objectUrl);
        
        const base64Length = compressedDataUrl.split(',')[1]?.length || 0;
        const compressedSizeKB = Math.round((base64Length * 3) / 4 / 1024);
        
        const compressionRatio = originalSizeKB > 0 
          ? Math.round((1 - compressedSizeKB / originalSizeKB) * 100) 
          : 0;

        resolve({
          dataUrl: compressedDataUrl,
          originalSize: {
            width: originalWidth,
            height: originalHeight,
            sizeKB: originalSizeKB
          },
          compressedSize: {
            width,
            height,
            sizeKB: compressedSizeKB
          },
          compressionRatio,
          options: {
            maxWidth,
            maxHeight,
            quality
          }
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片加载失败 (Object URL)'));
    };

    img.src = objectUrl;
  });
}

async function compressWithFileReader(
  file: File | Blob,
  options: CompressImageOptions
): Promise<CompressResult> {
  const { maxWidth = 2048, maxHeight = 2048, quality = 0.8 } = options;
  const originalSizeKB = Math.round(file.size / 1024);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      
      img.onload = () => {
        try {
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
          if (!ctx) {
            reject(new Error('无法获取 Canvas 2D 上下文'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          
          const base64Length = compressedDataUrl.split(',')[1]?.length || 0;
          const compressedSizeKB = Math.round((base64Length * 3) / 4 / 1024);
          
          const compressionRatio = originalSizeKB > 0 
            ? Math.round((1 - compressedSizeKB / originalSizeKB) * 100) 
            : 0;

          resolve({
            dataUrl: compressedDataUrl,
            originalSize: {
              width: originalWidth,
              height: originalHeight,
              sizeKB: originalSizeKB
            },
            compressedSize: {
              width,
              height,
              sizeKB: compressedSizeKB
            },
            compressionRatio,
            options: {
              maxWidth,
              maxHeight,
              quality
            }
          });
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error('图片加载失败 (FileReader)'));
      };

      img.src = event.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsDataURL(file);
  });
}

export async function compressImage(
  file: File | Blob,
  options: CompressImageOptions = {}
): Promise<CompressResult> {
  try {
    return await compressWithObjectUrl(file, options);
  } catch (objectUrlError) {
    const errorMsg = objectUrlError instanceof Error ? objectUrlError.message : String(objectUrlError);
    console.warn('Object URL 方法失败，尝试使用 FileReader 回退:', errorMsg);
    
    try {
      return await compressWithFileReader(file, options);
    } catch (fileReaderError) {
      const error2Msg = fileReaderError instanceof Error ? fileReaderError.message : String(fileReaderError);
      console.error('FileReader 方法也失败:', error2Msg);
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
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        sizeKB
      });
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0, sizeKB });
    };
    img.src = base64DataUrl;
  });
}
