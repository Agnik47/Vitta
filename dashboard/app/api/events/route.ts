// GET-only. Reads events.jsonl, supports ?since=<event_id> for incremental polling.
// See docs/06-DASHBOARD-SPEC.md § /events.
import { type NextRequest } from 'next/server';
import { readEventsSince } from '@/lib/read';

export async function GET(request: NextRequest) {
  const since = request.nextUrl.searchParams.get('since');
  const events = readEventsSince(since);
  return Response.json(events);
}
