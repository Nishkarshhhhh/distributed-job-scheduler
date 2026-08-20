import { Queue, QueueEvents } from "bullmq";
import { redisOptions } from "../config/redis";

const queues = new Map<string, Queue>();
const queueEvents = new Map<string, QueueEvents>();

export function getQueue(name: string): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: redisOptions });
    queues.set(name, queue);
  }
  return queue;
}

export function getQueueEvents(name: string): QueueEvents {
  let events = queueEvents.get(name);
  if (!events) {
    events = new QueueEvents(name, { connection: redisOptions });
    queueEvents.set(name, events);
  }
  return events;
}

export async function closeAllQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  await Promise.all([...queueEvents.values()].map((e) => e.close()));
  queues.clear();
  queueEvents.clear();
}

export function listActiveQueueNames(): string[] {
  return [...queues.keys()];
}