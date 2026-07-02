type QueueTask = () => Promise<void>;

interface QueueItem {
  id: string;
  task: QueueTask;
  addedAt: Date;
}

class AIRequestQueue {
  private queue: QueueItem[] = [];
  private runningCount = 0;
  private readonly concurrency: number;
  private runningTasks = new Set<string>();

  constructor(concurrency = 3) {
    this.concurrency = concurrency;
  }

  addTask(id: string, task: QueueTask): void {
    const existingIndex = this.queue.findIndex(item => item.id === id);
    if (existingIndex !== -1 || this.runningTasks.has(id)) {
      console.log(`[AI Queue] 任务 ${id} 已在队列或执行中，跳过添加`);
      return;
    }

    this.queue.push({ id, task, addedAt: new Date() });
    console.log(`[AI Queue] 添加任务 ${id}，队列长度: ${this.queue.length}，运行中: ${this.runningCount}`);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.runningCount >= this.concurrency || this.queue.length === 0) return;

    const item = this.queue.shift()!;
    this.runningTasks.add(item.id);
    this.runningCount++;

    console.log(`[AI Queue] 开始处理任务 ${item.id}，运行中: ${this.runningCount}，剩余队列长度: ${this.queue.length}`);

    // 启动任务但不 await，以便同时启动其他任务
    item.task().then(
      () => {
        console.log(`[AI Queue] 任务 ${item.id} 处理完成`);
      },
      (error) => {
        console.error(`[AI Queue] 任务 ${item.id} 处理失败:`, error);
      }
    ).finally(() => {
      this.runningTasks.delete(item.id);
      this.runningCount--;
      console.log(`[AI Queue] 任务 ${item.id} 结束，运行中: ${this.runningCount}，剩余队列长度: ${this.queue.length}`);
      this.processNext();
    });

    // 继续尝试启动更多任务，直到达到并发上限
    this.processNext();
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isTaskInQueue(id: string): boolean {
    return this.queue.some(item => item.id === id) || this.runningTasks.has(id);
  }

  getCurrentTask(): QueueItem | null {
    // 兼容旧接口，返回任意一个运行中的任务
    for (const id of this.runningTasks) {
      return { id, task: async () => {}, addedAt: new Date() };
    }
    return null;
  }
}

export const aiQueue = new AIRequestQueue();
