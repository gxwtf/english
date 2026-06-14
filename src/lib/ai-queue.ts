type QueueTask = () => Promise<void>;

interface QueueItem {
  id: string;
  task: QueueTask;
  addedAt: Date;
}

class AIRequestQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private currentTask: QueueItem | null = null;

  addTask(id: string, task: QueueTask): void {
    const existingIndex = this.queue.findIndex(item => item.id === id);
    if (existingIndex !== -1) {
      console.log(`[AI Queue] 任务 ${id} 已在队列中，跳过添加`);
      return;
    }

    this.queue.push({ id, task, addedAt: new Date() });
    console.log(`[AI Queue] 添加任务 ${id}，队列长度: ${this.queue.length}`);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;
    const item = this.queue.shift()!;
    this.currentTask = item;

    console.log(`[AI Queue] 开始处理任务 ${item.id}，剩余队列长度: ${this.queue.length}`);

    try {
      await item.task();
      console.log(`[AI Queue] 任务 ${item.id} 处理完成`);
    } catch (error) {
      console.error(`[AI Queue] 任务 ${item.id} 处理失败:`, error);
    } finally {
      this.isProcessing = false;
      this.currentTask = null;
      if (this.queue.length > 0) {
        console.log(`[AI Queue] 准备处理下一个任务，队列长度: ${this.queue.length}`);
        this.processNext();
      }
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isTaskInQueue(id: string): boolean {
    return this.queue.some(item => item.id === id) || this.currentTask?.id === id;
  }

  getCurrentTask(): QueueItem | null {
    return this.currentTask;
  }
}

export const aiQueue = new AIRequestQueue();
