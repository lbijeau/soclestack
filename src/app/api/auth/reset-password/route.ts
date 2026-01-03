import { NextRequest, NextResponse } from 'next/server';
import { resetPassword } from '@/services/auth.service';
import { getRequestContext, handleServiceError } from '@/lib/api-utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const context = getRequestContext(req);

    await resetPassword(body, context);

    return NextResponse.json({
      message:
        'Password reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    return handleServiceError(error);
  }
}
