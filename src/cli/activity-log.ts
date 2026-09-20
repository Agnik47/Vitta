// Writes ActivityEvents to the decision log (events.jsonl, the same file the gate's verdicts go to).
//
// Recording is best-effort by design: it must never break, slow or change the action it describes. A
// payment that succeeded does not become a failure because a log line could not be written.
import { generateId } from '../mandate/id';
import type { ActivityEvent } from '../events/ActivityEvent';
import { appendEvent } from './store';

export type ActivityFields = Omit<ActivityEvent, 'event_id' | 'ts' | 'kind'>;

/** Longest error text kept in the log: enough to diagnose, not a stack trace or a page of stdout. */
const MAX_ERROR_CHARS = 400;

export function recordActivity(fields: ActivityFields): void {
  try {
    const event: ActivityEvent = {
      event_id: generateId('evt'),
      ts: new Date().toISOString(),
      kind: 'ACTIVITY',
      ...fields,
      ...(fields.error ? { error: fields.error.replace(/\s+/g, ' ').trim().slice(0, MAX_ERROR_CHARS) } : {}),
    };
    appendEvent(event);
  } catch {
    // Deliberately swallowed — see the header.
  }
}
