import { NextResponse } from 'next/server';

// Liveness probe for the container healthcheck. Deliberately does not touch
// the backend: "is the Next.js server answering?" is the only question here.
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'nextjs.app',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
