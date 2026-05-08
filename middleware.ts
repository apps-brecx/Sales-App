import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const SALESMAN_BLOCKED = ['/dashboard', '/parse-email', '/trash', '/users', '/settings'];

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path === '/login' || path.startsWith('/api') || path.startsWith('/_next') || path === '/favicon.ico' || path === '/logo.png') {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.next();

  const role = (token as any).role;
  if (role === 'salesman' && SALESMAN_BLOCKED.some(p => path === p || path.startsWith(p + '/'))) {
    return NextResponse.redirect(new URL('/my', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.png).*)'],
};
