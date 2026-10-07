import { NextRequest, NextResponse } from 'next/server';
import { getEmailBatch } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { processEmailBatchStep } from '@/lib/emailWorker';

export async function GET(request: NextRequest) {
  try {
    const authCheck = requireAuth(request);
    if (!authCheck.authenticated && authCheck.response) {
      return authCheck.response;
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId');

    if (!batchId) {
      return NextResponse.json({ success: false, error: 'batchId query parameter is required' }, { status: 400 });
    }

    let batch = await getEmailBatch(batchId);
    if (!batch) {
      return NextResponse.json({ success: false, error: `Batch '${batchId}' not found` }, { status: 404 });
    }

    // If batch is not completed, trigger a worker tick step to drive execution forward
    const isCompleted = Boolean(batch.completed_at) || (batch.total > 0 && batch.queued === 0 && batch.processing === 0 && batch.retrying === 0);
    if (!isCompleted) {
      try {
        // 8 emails per poll, 4 at a time: spread over the rotated accounts this stays gentle per Gmail account
        await processEmailBatchStep(batchId, 8, 4);
        // Re-read updated stats
        const refreshed = await getEmailBatch(batchId);
        if (refreshed) batch = refreshed;
      } catch (workerErr) {
        console.warn('Worker step execution during status poll:', workerErr);
      }
    }

    const completedFinal = Boolean(batch.completed_at) || (batch.total > 0 && batch.queued === 0 && batch.processing === 0 && batch.retrying === 0);

    return NextResponse.json({
      success: true,
      batchId: batch.batch_id,
      eventId: batch.event_id,
      total: batch.total,
      queued: batch.queued,
      processing: batch.processing,
      sent: batch.sent,
      retrying: batch.retrying,
      failed: batch.failed,
      // DEFERRED jobs aren't a stored counter: whatever isn't in another state was parked for daily limits
      deferred: Math.max(
        0,
        batch.total - batch.queued - batch.processing - batch.sent - batch.retrying - batch.failed
      ),
      completed: completedFinal,
      createdAt: batch.created_at,
      completedAt: batch.completed_at || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('Email status API error:', error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
