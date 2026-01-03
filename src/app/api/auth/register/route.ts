import { NextRequest, NextResponse } from 'next/server';
import { register } from '@/services/auth.service';
import { getRequestContext, handleServiceError } from '@/lib/api-utils';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const context = getRequestContext(req);
    const body = await req.json();

    const result = await register(body, context);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleServiceError(error);
  }
}
