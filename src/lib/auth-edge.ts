import { getIronSession } from 'iron-session';
import { NextRequest } from 'next/server';
import { SessionData } from '@/types/auth';
import { Role } from '@prisma/client';

// Types for iron-session compatibility
interface MockRequest {
  headers: {
    cookie: string;
  };
}

interface MockResponse {
  getHeader: () => undefined;
  setHeader: () => void;
  headers: Map<string, string>;
}

// Session configuration for Edge Runtime
const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'soclestack-session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};

// Edge-compatible session retrieval for middleware
export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionData> {
  try {
    const cookieStore = request.cookies;
    const sessionCookie = cookieStore.get(sessionOptions.cookieName);

    if (!sessionCookie) {
      return {
        userId: '',
        email: '',
        role: Role.USER,
        isLoggedIn: false,
      };
    }

    // Create a request-like object for iron-session
    const mockRequest: MockRequest = {
      headers: {
        cookie: `${sessionOptions.cookieName}=${sessionCookie.value}`,
      },
    };

    const mockResponse: MockResponse = {
      getHeader: () => undefined,
      setHeader: () => {},
      headers: new Map(),
    };

    const session = await getIronSession<SessionData>(
      mockRequest as unknown as Parameters<typeof getIronSession>[0],
      mockResponse as unknown as Parameters<typeof getIronSession>[1],
      sessionOptions
    );

    return (
      session || {
        userId: '',
        email: '',
        role: Role.USER,
        isLoggedIn: false,
      }
    );
  } catch (error) {
    console.error('Error getting session from request:', error);
    return {
      userId: '',
      email: '',
      role: Role.USER,
      isLoggedIn: false,
    };
  }
}
