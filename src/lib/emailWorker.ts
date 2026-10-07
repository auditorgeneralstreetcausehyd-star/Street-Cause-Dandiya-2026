import {
  claimNextEmailJobs,
  getEmailBatch,
  updateEmailDispatchJob,
  updateEmailBatchCounts,
  resetStaleProcessingJobs,
  getRecordByCode,
  updateRecordEmailStatus,
  getSmtpSentCounts,
  deferQueuedEmailJobs,
  countProcessingEmailJobs,
  getLatestSentLogs,
} from './db';
import { sendPassEmail, getSmtpAccounts, SmtpAccount } from './emailService';
import { EmailDispatchLog, EventRecord } from './types';
import { invalidateCache } from './cache';

// Backoff delays: attempt 1 -> 2s, attempt 2 -> 8s, attempt 3 -> 30s
const RETRY_DELAYS_MS = [2000, 8000, 30000];
const MAX_ATTEMPTS = 3;
const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;
const DEFERRED_REASON = 'Deferred: all sender accounts reached their daily limit. Still Pending; send again later.';

export interface SenderQuota {
  user: string;
  dailyLimit: number;
  sent: number;
  remaining: number;
}

/** Per-account sends in the rolling 24h window and how many each can still send */
export async function getSenderQuota(): Promise<{ accounts: SenderQuota[]; totalRemaining: number }> {
  const accounts = getSmtpAccounts();
  if (accounts.length === 0) {
    throw new Error('SMTP credentials not configured (set SMTP_USER and SMTP_PASS)');
  }
  const sinceIso = new Date(Date.now() - QUOTA_WINDOW_MS).toISOString();
  const [counts, inFlight] = await Promise.all([
    getSmtpSentCounts(
      accounts.map((a) => a.user),
      accounts[0].user,
      sinceIso
    ),
    countProcessingEmailJobs(),
  ]);
  const quota = accounts.map((a) => {
    const sent = counts.get(a.user) || 0;
    return { user: a.user, dailyLimit: a.dailyLimit, sent, remaining: Math.max(0, a.dailyLimit - sent) };
  });

  // Overlapping worker steps (send request + status polls) must not reuse quota already claimed by
  // in-flight sends; their account isn't known yet, so take it from the accounts with the most room
  let unassigned = inFlight;
  while (unassigned > 0) {
    const roomiest = quota.reduce((best, q) => (q.remaining > best.remaining ? q : best), quota[0]);
    if (roomiest.remaining === 0) break;
    roomiest.remaining--;
    unassigned--;
  }
  return { accounts: quota, totalRemaining: quota.reduce((sum, q) => sum + q.remaining, 0) };
}

/** Fill email_sent_from on Sent records with the account that delivered them */
export async function attachEmailSenders(records: EventRecord[]): Promise<EventRecord[]> {
  const sent = records.filter((r) => r.email_status === 'Sent');
  if (sent.length === 0) return records;
  const primary = getSmtpAccounts()[0]?.user || null;
  const logs = await getLatestSentLogs(sent.map((r) => r.order_id));
  return records.map((r) => {
    if (r.email_status !== 'Sent') return r;
    const log = logs.get(r.order_id);
    // Logs without an account predate per-account tracking, when only the primary account sent
    return { ...r, email_sent_from: log ? log.smtp_account || primary : null };
  });
}

/**
 * Executes a durable worker step:
 * 1. Resets stale jobs (> 90s in PROCESSING).
 * 2. Checks sender quota; defers the batch if every account is at its daily limit.
 * 3. Claims up to the remaining quota of QUEUED or RETRYING jobs atomically.
 * 4. Sends each job from the account with the most quota left, rotating on limit errors.
 * 5. Updates batch progress and selectively invalidates cache.
 */
type StepResult = { processed: number; completed: boolean; quotaExhausted?: boolean };

// Steps in this process run one at a time: the send request and the status polls all trigger steps, and
// overlapping steps would each read the same remaining quota before either records its sends.
let stepChain: Promise<unknown> = Promise.resolve();

export function processEmailBatchStep(batchId?: string, limit = 6, concurrency = 2): Promise<StepResult> {
  const run = stepChain.then(() => runEmailBatchStep(batchId, limit, concurrency));
  stepChain = run.catch(() => undefined);
  return run;
}

async function runEmailBatchStep(batchId: string | undefined, limit: number, concurrency: number): Promise<StepResult> {
  // 1. Recover any stale processing jobs (> 90 seconds)
  await resetStaleProcessingJobs(1.5);

  // 2. Sender capacity for this step; reserved synchronously per send so concurrent jobs can't overshoot
  const accounts = getSmtpAccounts();
  const quota = await getSenderQuota();
  const remaining = new Map<string, number>(quota.accounts.map((q) => [q.user, q.remaining]));

  const deferRest = async () => {
    if (!batchId) return { processed: 0, completed: true, quotaExhausted: true };
    await deferQueuedEmailJobs(batchId, DEFERRED_REASON);
    const updated = await updateEmailBatchCounts(batchId);
    return { processed: 0, completed: Boolean(updated?.completed_at), quotaExhausted: true };
  };

  if (quota.totalRemaining === 0) {
    return deferRest();
  }

  // 3. Claim next available jobs, never more than the accounts can still send
  const jobs = await claimNextEmailJobs(batchId, Math.min(limit, quota.totalRemaining));
  if (jobs.length === 0) {
    if (batchId) {
      const batch = await getEmailBatch(batchId);
      return { processed: 0, completed: Boolean(batch?.completed_at) };
    }
    return { processed: 0, completed: true };
  }

  const reserveAccount = (): SmtpAccount | null => {
    let best: SmtpAccount | null = null;
    let bestRemaining = 0;
    for (const account of accounts) {
      const left = remaining.get(account.user) || 0;
      if (left > bestRemaining) {
        best = account;
        bestRemaining = left;
      }
    }
    if (best) remaining.set(best.user, bestRemaining - 1);
    return best;
  };

  // 4. Process individual job with idempotency & error classification
  const processJob = async (job: EmailDispatchLog) => {
    const nowIso = new Date().toISOString();
    try {
      const record = await getRecordByCode(job.order_id);
      if (!record) {
        await updateEmailDispatchJob(job.id, {
          status: 'FAILED',
          error_message: `Pass record not found for order_id: ${job.order_id}`,
          updated_at: nowIso,
        });
        await updateRecordEmailStatus(job.order_id, 'Failed', null, nowIso, 'Pass record not found');
        return;
      }

      // Idempotency: If the attendee record was already marked Sent, skip SMTP
      if (record.email_status === 'Sent') {
        await updateEmailDispatchJob(job.id, {
          status: 'SENT',
          sent_at: record.email_sent_at || nowIso,
          updated_at: nowIso,
        });
        return;
      }

      // Mark record as 'Sending' in DB
      await updateRecordEmailStatus(job.order_id, 'Sending', null, nowIso, null);

      // Dispatch email, moving to the next account if Gmail reports this one is at its daily limit
      let result: Awaited<ReturnType<typeof sendPassEmail>> | null = null;
      for (;;) {
        const account = reserveAccount();
        if (!account) break;
        result = await sendPassEmail(record, undefined, account);
        if (!result.isQuotaExceeded) break;
        console.warn(`Sender ${account.user} is at its daily limit or its login was rejected; rotating to next account`);
        remaining.set(account.user, 0);
        result = null;
      }

      const finishIso = new Date().toISOString();

      if (!result) {
        // Every account is exhausted: park the job, give back the attempt, keep the pass Pending
        await updateEmailDispatchJob(job.id, {
          status: 'DEFERRED',
          attempt_count: Math.max(0, (job.attempt_count || 1) - 1),
          error_message: DEFERRED_REASON,
          updated_at: finishIso,
        });
        await updateRecordEmailStatus(job.order_id, 'Pending', null, finishIso, null);
        return;
      }

      if (result.success) {
        // Success -> SENT
        await updateEmailDispatchJob(job.id, {
          status: 'SENT',
          smtp_message_id: result.messageId || null,
          smtp_code: result.smtpCode ? String(result.smtpCode) : '250',
          smtp_account: result.smtpAccount || null,
          sent_at: finishIso,
          updated_at: finishIso,
          error_message: null,
        });
        await updateRecordEmailStatus(job.order_id, 'Sent', finishIso, finishIso, null);
      } else {
        // Failure classification
        const isTemporary = Boolean(result.isTemporary);
        const currentAttempts = job.attempt_count || 1;

        if (isTemporary && currentAttempts < MAX_ATTEMPTS) {
          // Temporary 4xx or socket drop -> Schedule retry with exponential backoff
          const delayMs = RETRY_DELAYS_MS[currentAttempts - 1] || 30000;
          const nextRetryAt = new Date(Date.now() + delayMs).toISOString();

          await updateEmailDispatchJob(job.id, {
            status: 'RETRYING',
            smtp_code: result.smtpCode ? String(result.smtpCode) : undefined,
            error_message: `[Attempt ${currentAttempts}/${MAX_ATTEMPTS}]: ${result.error}`,
            next_retry_at: nextRetryAt,
            updated_at: finishIso,
          });
          await updateRecordEmailStatus(
            job.order_id,
            'Failed',
            null,
            finishIso,
            `Temporary error (Retrying in ${Math.round(delayMs / 1000)}s): ${result.error}`
          );
        } else {
          // Permanent 5xx or exhausted attempts -> Mark FAILED
          const reason = !isTemporary
            ? `Permanent failure: ${result.error}`
            : `Exhausted ${MAX_ATTEMPTS} attempts: ${result.error}`;

          await updateEmailDispatchJob(job.id, {
            status: 'FAILED',
            smtp_code: result.smtpCode ? String(result.smtpCode) : undefined,
            error_message: reason,
            updated_at: finishIso,
          });
          await updateRecordEmailStatus(job.order_id, 'Failed', null, finishIso, reason);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const errIso = new Date().toISOString();
      await updateEmailDispatchJob(job.id, {
        status: 'FAILED',
        error_message: `Unhandled worker exception: ${msg}`,
        updated_at: errIso,
      });
      await updateRecordEmailStatus(job.order_id, 'Failed', null, errIso, msg);
    }
  };

  // Run in chunks based on concurrency
  for (let i = 0; i < jobs.length; i += concurrency) {
    const chunk = jobs.slice(i, i + concurrency);
    await Promise.all(chunk.map(processJob));
  }

  // 5. If this step used up the last of the quota, park the rest of the batch instead of leaving it queued
  const quotaExhausted = Array.from(remaining.values()).every((left) => left <= 0);
  if (batchId && quotaExhausted) {
    await deferQueuedEmailJobs(batchId, DEFERRED_REASON);
  }

  // Update batch aggregation counts
  if (batchId) {
    const updatedBatch = await updateEmailBatchCounts(batchId);
    if (updatedBatch?.event_id) {
      invalidateCache(`records_${updatedBatch.event_id}`);
    }
    return { processed: jobs.length, completed: Boolean(updatedBatch?.completed_at), quotaExhausted };
  }

  return { processed: jobs.length, completed: false, quotaExhausted };
}
