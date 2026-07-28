import type { Receipt } from '@/lib/types';
import type { ChainVerification } from '@/lib/read';

export function ReceiptCard({ receipt, verification }: { receipt: Receipt; verification: ChainVerification | null }) {
  const valid = verification?.chain_link_valid ?? false;
  return (
    <div className="rounded border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold">{receipt.receipt_id}</span>
        <span
          className={`rounded px-2 py-0.5 text-xs font-semibold ${
            valid
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}
        >
          {valid ? 'chain valid' : 'chain INVALID'}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-zinc-500">Merchant</dt>
        <dd>{receipt.cart.merchant}</dd>
        <dt className="text-zinc-500">Total</dt>
        <dd>₹{receipt.cart.total_inr}</dd>
        <dt className="text-zinc-500">Run ID</dt>
        <dd className="font-mono text-xs">{receipt.execution.run_id}</dd>
        <dt className="text-zinc-500">Signed at</dt>
        <dd>{new Date(receipt.signed_at).toLocaleString()}</dd>
        <dt className="text-zinc-500">Signature</dt>
        <dd className="text-xs text-zinc-500">
          {verification?.signature_valid === null || verification?.signature_valid === undefined
            ? 'pending (gate public key not yet available, see docs/agent-b/WORKSPACE.md)'
            : verification.signature_valid
              ? 'valid'
              : 'INVALID'}
        </dd>
      </dl>
    </div>
  );
}
