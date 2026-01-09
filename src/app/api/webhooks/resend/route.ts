import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { EmailStatus } from '@prisma/client';

export const runtime = 'nodejs';

/**
 * Resend webhook event types we handle.
 * See: https://resend.com/docs/dashboard/webhooks/event-types
 */
type ResendEventType =
  | 'email.sent'
  | 'email.delivered'
  | 'email.delivery_delayed'
  | 'email.complained'
  | 'email.bounced'
  | 'email.opened'
  | 'email.clicked';

interface ResendWebhookPayload {
  type: ResendEventType;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // Additional fields vary by event type
    bounce?: {
      message: string;
      type: string;
    };
    complaint?: {
      complaint_type: string;
    };
  };
}

/**
 * Map Resend event types to EmailStatus.
 */
function mapEventToStatus(eventType: ResendEventType): EmailStatus | null {
  switch (eventType) {
    case 'email.delivered':
      return EmailStatus.DELIVERED;
    case 'email.bounced':
      return EmailStatus.BOUNCED;
    // email.sent is already handled when we send - status is SENT
    // email.complained could be treated as BOUNCED for practical purposes
    case 'email.complained':
      return EmailStatus.BOUNCED;
    default:
      return null;
  }
}

/**
 * Verify the webhook signature using Svix.
 */
function verifyWebhookSignature(
  payload: string,
  headers: {
    'svix-id': string | null;
    'svix-timestamp': string | null;
    'svix-signature': string | null;
  }
): boolean {
  const secret = env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    console.warn(
      '[Resend Webhook] No webhook secret configured, skipping verification'
    );
    return true; // Allow in development without secret
  }

  if (
    !headers['svix-id'] ||
    !headers['svix-timestamp'] ||
    !headers['svix-signature']
  ) {
    console.error('[Resend Webhook] Missing Svix headers');
    return false;
  }

  try {
    const wh = new Webhook(secret);
    wh.verify(payload, {
      'svix-id': headers['svix-id'],
      'svix-timestamp': headers['svix-timestamp'],
      'svix-signature': headers['svix-signature'],
    });
    return true;
  } catch (error) {
    console.error('[Resend Webhook] Signature verification failed:', error);
    return false;
  }
}

/**
 * POST /api/webhooks/resend
 * Handle Resend webhook events for email delivery status updates.
 *
 * Events handled:
 * - email.delivered → DELIVERED
 * - email.bounced → BOUNCED
 * - email.complained → BOUNCED (spam complaint)
 */
export async function POST(req: NextRequest) {
  try {
    // Get raw body for signature verification
    const payload = await req.text();

    // Verify webhook signature
    const svixHeaders = {
      'svix-id': req.headers.get('svix-id'),
      'svix-timestamp': req.headers.get('svix-timestamp'),
      'svix-signature': req.headers.get('svix-signature'),
    };

    if (!verifyWebhookSignature(payload, svixHeaders)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the payload
    let event: ResendWebhookPayload;
    try {
      event = JSON.parse(payload);
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { type, data } = event;
    const emailId = data.email_id;

    console.log(`[Resend Webhook] Received ${type} for email ${emailId}`);

    // Map event to status
    const newStatus = mapEventToStatus(type);

    if (!newStatus) {
      // Event type we don't handle (e.g., opened, clicked)
      // Return 200 to acknowledge receipt
      return NextResponse.json({ received: true, handled: false });
    }

    // Find the email log by provider ID
    const emailLog = await prisma.emailLog.findFirst({
      where: {
        providerId: emailId,
        provider: 'resend',
      },
      select: { id: true, status: true },
    });

    if (!emailLog) {
      console.warn(
        `[Resend Webhook] No email log found for provider ID: ${emailId}`
      );
      // Return 200 anyway - we don't want Resend to retry
      return NextResponse.json({ received: true, found: false });
    }

    // Build update data
    const updateData: { status: EmailStatus; lastError?: string } = {
      status: newStatus,
    };

    // Add error details for bounces
    if (type === 'email.bounced' && data.bounce) {
      updateData.lastError = `${data.bounce.type}: ${data.bounce.message}`;
    }

    // Add complaint info
    if (type === 'email.complained' && data.complaint) {
      updateData.lastError = `Spam complaint: ${data.complaint.complaint_type}`;
    }

    // Update the email log
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: updateData,
    });

    console.log(
      `[Resend Webhook] Updated email ${emailLog.id} to ${newStatus}`
    );

    return NextResponse.json({
      received: true,
      handled: true,
      emailId: emailLog.id,
      newStatus,
    });
  } catch (error) {
    console.error('[Resend Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/resend
 * Health check endpoint for webhook configuration verification.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    webhook: 'resend',
    configured: !!env.RESEND_WEBHOOK_SECRET,
  });
}
