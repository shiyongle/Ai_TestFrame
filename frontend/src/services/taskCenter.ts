export type TaskStatus = 'pending' | 'running' | 'success' | 'failed';

export interface TaskItem {
  id: string;
  type: string;
  title: string;
  detail?: string;
  status: TaskStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
  meta?: Record<string, any>;
}

const STORAGE_KEY = 'testframe_task_center';
const EVENT_NAME = 'task-center-updated';

const inMemoryTimers: Record<string, number> = {};

const nowIso = () => new Date().toISOString();

const readTasks = (): TaskItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeTasks = (tasks: TaskItem[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
};

const sortTasks = (tasks: TaskItem[]) =>
  [...tasks].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));

const genTaskId = () => `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const taskCenter = {
  getTasks(): TaskItem[] {
    return sortTasks(readTasks());
  },

  getRunningCount(): number {
    return readTasks().filter(t => t.status === 'running' || t.status === 'pending').length;
  },

  subscribe(listener: () => void): () => void {
    window.addEventListener(EVENT_NAME, listener);
    return () => window.removeEventListener(EVENT_NAME, listener);
  },

  createTask(input: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>): string {
    const tasks = readTasks();
    const id = genTaskId();
    const newTask: TaskItem = {
      id,
      title: input.title,
      detail: input.detail,
      type: input.type,
      status: input.status,
      progress: Math.max(0, Math.min(100, input.progress)),
      meta: input.meta,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    tasks.push(newTask);
    writeTasks(tasks);
    return id;
  },

  updateTask(id: string, patch: Partial<Omit<TaskItem, 'id' | 'createdAt'>>) {
    const tasks = readTasks();
    const idx = tasks.findIndex(t => t.id === id);
    if (idx < 0) return;
    tasks[idx] = {
      ...tasks[idx],
      ...patch,
      progress: patch.progress !== undefined ? Math.max(0, Math.min(100, patch.progress)) : tasks[idx].progress,
      updatedAt: nowIso(),
    };
    writeTasks(tasks);
  },

  markSuccess(id: string, detail?: string) {
    this.updateTask(id, {
      status: 'success',
      progress: 100,
      detail,
    });
    if (inMemoryTimers[id]) {
      clearInterval(inMemoryTimers[id]);
      delete inMemoryTimers[id];
    }
  },

  markFailed(id: string, detail?: string) {
    this.updateTask(id, {
      status: 'failed',
      detail,
    });
    if (inMemoryTimers[id]) {
      clearInterval(inMemoryTimers[id]);
      delete inMemoryTimers[id];
    }
  },

  startAutoProgress(id: string, options?: { max?: number; step?: number; intervalMs?: number }) {
    const max = options?.max ?? 90;
    const step = options?.step ?? 7;
    const intervalMs = options?.intervalMs ?? 1000;

    if (inMemoryTimers[id]) {
      clearInterval(inMemoryTimers[id]);
    }

    inMemoryTimers[id] = window.setInterval(() => {
      const tasks = readTasks();
      const task = tasks.find(t => t.id === id);
      if (!task || task.status !== 'running') {
        clearInterval(inMemoryTimers[id]);
        delete inMemoryTimers[id];
        return;
      }
      const next = Math.min(max, task.progress + step);
      this.updateTask(id, { progress: next });
    }, intervalMs);
  },

  clearFinished() {
    const tasks = readTasks().filter(t => t.status === 'running' || t.status === 'pending');
    writeTasks(tasks);
  },
};

