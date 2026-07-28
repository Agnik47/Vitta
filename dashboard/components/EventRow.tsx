import type { GateEvent } from '@/lib/types';
import { StatusBadge } from './StatusBadge';

export function EventRow({ event }: { event: GateEvent }) {
  return (
    <tr className="border-b border-zinc-200 dark:border-zinc-800">
      <td className="px-3 py-2 whitespace-nowrap text-xs text-zinc-500">{new Date(event.ts).toLocaleTimeString()}</td>
      <td className="px-3 py-2 font-mono text-sm">{event.command}</td>
      <td className="px-3 py-2 text-xs uppercase text-zinc-500">{event.access}</td>
      <td className="px-3 py-2">
        <StatusBadge verdict={event.verdict} />
      </td>
      <td className="px-3 py-2 text-sm">{event.code ?? '—'}</td>
      <td className="px-3 py-2 text-sm">{event.amount_inr != null ? `₹${event.amount_inr}` : '—'}</td>
      <td className="px-3 py-2 font-mono text-xs text-zinc-500">{event.run_id ?? '—'}</td>
    </tr>
  );
}
