import crypto from 'node:crypto';
import { readJsonFile, writeJsonFile } from '../../utils/jsonStore.js';

const QUEUE_FILE = 'email-queue.json';
const MAX_ATTEMPTS = Number.parseInt(process.env.EMAIL_QUEUE_MAX_ATTEMPTS ?? '3', 10);

export async function enqueueEmail({
  options,
  sendAt,
  channel = 'automation',
  dedupeKey,
  campaign,
  metadata
}) {
  const queue = await readQueue();
  if (dedupeKey) {
    const existing = queue.messages.find(
      entry =>
        entry.dedupeKey === dedupeKey &&
        (entry.status === 'scheduled' || entry.status === 'sending')
    );
    if (existing) {
      return existing;
    }
  }

  const entry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    sendAt: (sendAt ? new Date(sendAt) : new Date()).toISOString(),
    attempts: 0,
    status: 'scheduled',
    channel,
    campaign,
    dedupeKey,
    metadata,
    options
  };
  queue.messages.push(entry);
  await persist(queue);
  return entry;
}

export async function getDueEmails(limit = 20) {
  const queue = await readQueue();
  const now = Date.now();
  const due = [];
  for (const entry of queue.messages) {
    if (due.length >= limit) break;
    if (entry.status !== 'scheduled') continue;
    if (new Date(entry.sendAt).getTime() > now) continue;
    entry.status = 'sending';
    entry.attempts += 1;
    entry.lastAttemptAt = new Date().toISOString();
    due.push(entry);
  }
  if (due.length) {
    await persist(queue);
  }
  return due;
}

export async function markEmailSent(id, providerResponse) {
  const queue = await readQueue();
  const entry = queue.messages.find(message => message.id === id);
  if (!entry) return null;
  entry.status = 'sent';
  entry.completedAt = new Date().toISOString();
  entry.providerResponse = providerResponse;
  await persist(queue);
  return entry;
}

export async function markEmailFailed(id, error) {
  const queue = await readQueue();
  const entry = queue.messages.find(message => message.id === id);
  if (!entry) return null;
  if (entry.attempts < MAX_ATTEMPTS) {
    entry.status = 'scheduled';
    const retryDelayMs = Number.parseInt(process.env.EMAIL_QUEUE_RETRY_DELAY_MS ?? '60000', 10);
    entry.sendAt = new Date(Date.now() + retryDelayMs).toISOString();
  } else {
    entry.status = 'failed';
  }
  entry.lastError = error instanceof Error ? error.message : String(error);
  await persist(queue);
  return entry;
}

export async function getQueueSnapshot() {
  const queue = await readQueue();
  return queue;
}

async function readQueue() {
  return readJsonFile(QUEUE_FILE, { messages: [] });
}

async function persist(queue) {
  await writeJsonFile(QUEUE_FILE, queue);
}
