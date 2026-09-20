// GET-only. Reads events.jsonl, supports ?since=<event_id> for incremental polling.
// Gate verdicts only by default; `?include=activity` adds the activity entries (payments, mandates,
// purchase outcomes…) that the Decisions page shows alongside them.
// See docs/06-DASHBOARD-SPEC.md § /events.
import { type NextRequest } from 'next/server';
import { readEventsSince } from '@/lib/read';

export async function GET(request: NextRequest) {
  const since = request.nextUrl.searchParams.get('since');
  const includeActivity = request.nextUrl.searchParams.get('include') === 'activity';
  const events = readEventsSince(since, includeActivity);
  return Response.json(events);
}
