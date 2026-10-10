import { NextRequest, NextResponse } from 'next/server';
import { getRecordsByOrderIds, createEmailBatch, updateRecordEmailStatus } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { EmailBatch, EmailDispatchLog, EventRecord } from '@/lib/types';
import { processEmailBatchStep, getSenderQuota } from '@/lib/emailWorker';
import { normalizeEmail } from '@/lib/emailAddress';

export async function POST(request: NextRequest) {
  try {
    const rateCheck = await checkRateLimit(request, 'api_email_send', { limit: 20, windowSeconds: 60 });
    if (!rateCheck.allowed && rateCheck.response) {
      return rateCheck.response;
    }

    const authCheck = requireAuth(request);
    if (!authCheck.authenticated && authCheck.response) {
      return authCheck.response;
    }

    const body = await request.json();
    const { orderIds, eventId } = body;
    // force = explicit resend: re-deliver even if the pass was already Sent
    const force = body.force === true;

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No orderIds provided' }, { status: 400 });
    }

    // 0. Sender capacity check (also surfaces a missing smtp_account migration before anything is queued)
    let quota: Awaited<ReturnType<typeof getSenderQuota>>;
    try {
      quota = await getSenderQuota();
    } catch (quotaErr) {
      const message = quotaErr instanceof Error ? quotaErr.message : String(quotaErr);
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    if (quota.totalRemaining === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `All ${quota.accounts.length} sender account(s) have reached their daily limit. Try again later (limits reset on a rolling 24h window).`,
          quota,
        },
        { status: 429 }
      );
    }

    // 1. Fetch matching records
    const records = await getRecordsByOrderIds(orderIds);

    // 2. Filter to only PASS records for the event
    const passRecords: EventRecord[] = records.filter(
      (r) =>
        r.record_type === 'PASS' &&
        (!eventId || eventId === 'all' || r.event_id === eventId)
    );

    if (passRecords.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No matching PASS records found for the given IDs.' },
        { status: 404 }
      );
    }

    // 3. Filter out records that are already successfully Sent (Idempotency), unless this is an explicit resend.
    // The worker also skips records marked Sent, so resent records are reset to Pending first.
    if (force) {
      await Promise.all(
        passRecords
          .filter((r) => r.email_status === 'Sent')
          .map((r) => updateRecordEmailStatus(r.order_id, 'Pending'))
      );
    }
    const eligibleRecords = force ? passRecords : passRecords.filter((r) => r.email_status !== 'Sent');
    if (eligibleRecords.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'All selected passes have already been successfully sent.',
          batchId: null,
          queued: 0,
        },
        { status: 200 }
      );
    }

    // 4. Create Batch Model & Dispatch Jobs
    const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const targetEventId = eventId && eventId !== 'all' ? eventId : eligibleRecords[0]?.event_id || 'garba_groove';
    // A batch spanning both events is labelled 'all' (each job still carries its own event_id)
    const batchEventId = new Set(eligibleRecords.map((r) => r.event_id || targetEventId)).size > 1 ? 'all' : targetEventId;
    const nowIso = new Date().toISOString();

    const jobs: EmailDispatchLog[] = eligibleRecords.map((r) => ({
      id: `JOB-${batchId}-${r.order_id}`,
      batch_id: batchId,
      order_id: r.order_id,
      event_id: r.event_id || targetEventId,
      recipient_email: normalizeEmail(r.email),
      status: 'QUEUED',
      attempt_count: 0,
      created_at: nowIso,
      updated_at: nowIso,
    }));

    const batch: EmailBatch = {
      batch_id: batchId,
      event_id: batchEventId,
      requested_by: authCheck.session?.email || 'admin',
      total: jobs.length,
      queued: jobs.length,
      processing: 0,
      sent: 0,
      retrying: 0,
      failed: 0,
      created_at: nowIso,
      completed_at: null,
    };

    await createEmailBatch(batch, jobs);

    // 5. Trigger first worker step non-blocking to advance processing
    processEmailBatchStep(batchId).catch((err) => {
      console.error('Initial background worker step error:', err);
    });

    // 6. Return immediate response
    return NextResponse.json({
      success: true,
      batchId,
      queued: jobs.length,
      skippedAlreadySent: passRecords.length - eligibleRecords.length,
      senderCapacity: quota.totalRemaining,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Email API error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
