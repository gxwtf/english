export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
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
