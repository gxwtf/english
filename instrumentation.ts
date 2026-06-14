import { spawn, ChildProcess } from 'child_process';
import path from 'path';

let pythonProcess: ChildProcess | null = null;

function startPaddleOCR() {
  const scriptPath = path.join(process.cwd(), 'scripts', 'paddleocr-server.py');
  const port = process.env.PADDLEOCR_PORT || '9800';

  console.log(`[PaddleOCR] 启动 Python OCR 服务 (端口 ${port})...`);

  pythonProcess = spawn('python3', [scriptPath, port], {
    stdio: ['pipe', 'inherit', 'inherit'], // stdin=pipe 用于管道断裂检测
  });

  pythonProcess.on('error', (err) => {
    console.error('[PaddleOCR] 启动失败:', err.message);
  });

  pythonProcess.on('exit', (code) => {
    console.log(`[PaddleOCR] Python 进程已退出 (code=${code})`);
    pythonProcess = null;
  });

  // Node.js 优雅关闭时 kill Python
  const shutdown = () => {
    if (pythonProcess && !pythonProcess.killed) {
      console.log('[PaddleOCR] 正在关闭 Python 服务...');
      pythonProcess.kill('SIGTERM');
    }
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 启动 PaddleOCR Python 服务
    startPaddleOCR();

    const { prisma } = await import('./src/lib/db');

    try {
      const generatingResult = await prisma.questionQueue.updateMany({
        where: {
          status: 'GENERATING',
        },
        data: {
          status: 'FAILED',
        },
      });

      const gradingResult = await prisma.questionQueue.updateMany({
        where: {
          status: 'GRADING',
        },
        data: {
          status: 'GRADING_FAILED',
        },
      });

      console.log(
        `[Startup] Reset question statuses: ${generatingResult.count} GENERATING -> FAILED, ${gradingResult.count} GRADING -> GRADING_FAILED`
      );
    } catch (error) {
      console.error('[Startup] Failed to reset question statuses:', error);
    }
  }
}
