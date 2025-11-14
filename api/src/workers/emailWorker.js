import { setTimeout as sleep } from 'node:timers/promises';
import { sendBrandedEmail, ensureEmailProviderConfigured } from '../services/email/emailService.js';
import { getDueEmails, markEmailFailed, markEmailSent } from '../services/email/emailQueue.js';

const BATCH_SIZE = Number.parseInt(process.env.EMAIL_WORKER_BATCH_SIZE ?? '20', 10);
const POLL_INTERVAL_MS = Number.parseInt(process.env.EMAIL_WORKER_POLL_MS ?? '5000', 10);

async function runWorker() {
  console.log('[email-worker] starting up');
  ensureEmailProviderConfigured();
  while (true) {
    try {
      const due = await getDueEmails(BATCH_SIZE);
      if (!due.length) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }
      for (const entry of due) {
        try {
          const response = await sendBrandedEmail(entry.options);
          await markEmailSent(entry.id, response);
          console.log(`[email-worker] sent ${entry.id} (${response.messageId})`);
        } catch (error) {
          console.error(`[email-worker] failed ${entry.id}:`, error.message);
          await markEmailFailed(entry.id, error);
        }
      }
    } catch (error) {
      console.error('[email-worker] loop error', error);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

runWorker().catch(error => {
  console.error('[email-worker] fatal error', error);
  process.exit(1);
});
