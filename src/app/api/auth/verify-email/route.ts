import { NextRequest, NextResponse } from 'next/server';
import { verifyEmail } from '@/services/auth.service';
import { handleServiceError } from '@/lib/api-utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await verifyEmail(body);

    return NextResponse.json({
      message: 'Email verified successfully. You can now log in.',
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
