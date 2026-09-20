const { useState, useEffect, useMemo, useRef } = React;
const { createRoot } = ReactDOM;

/* ------------------------------------------------------------------------------------------------
   Data — a snapshot of Vitta's own records (runs exported from Vitta's run store on 2026-09-20;
   agents as registered in Nasiko; rules as coded in Vitta's policy engine). Nothing here is invented.
------------------------------------------------------------------------------------------------ */

const RUNS = [
  {
    "run_id": "req_00e3c6af6adc8c0a",
    "started_at": "2026-09-20T06:19:46.750Z",
    "completed_at": "2026-09-20T06:19:46.943Z",
    "status": "NO_PURCHASE",
    "mode": "TEST",
    "request_text": "find the cheapest 2kg atta under ₹300",
    "trace_id": "48c53fa4218640dae45f0b8e1acd77a3",
    "routed": true,
    "direct": [
      "vitta-purchase-agent"
    ],
    "stages": [
      {
        "agent": "vitta-shopping-planner",
        "status": "done",
        "summary": "\"2kg atta\" ×1 ≤ ₹300",
        "ms": 49
      },
      {
        "agent": "vitta-deal-discovery",
        "status": "done",
        "summary": "30 candidate(s), 1 merchant(s) failed",
        "ms": 122
      },
      {
        "agent": "vitta-deal-evaluator",
        "status": "done",
        "summary": "No eligible product among 30 candidate(s) — 17× pack size not stated on the listing, 9× different pack size than requested, 4× does not look like \"2kg atta\".",
        "ms": 17
      },
      {
        "agent": "vitta-purchase-agent",
        "status": "skipped",
        "summary": "nothing to buy — No eligible product among 30 candidate(s) — 17× pack size not stated on the listing, 9× different pack size than requested, 4× does not look like \"2kg atta\".",
        "ms": null
      }
    ],
    "error": null,
    "intent": {
      "product_query": "2kg atta",
      "quantity": 1,
      "max_price_inr": 300,
      "purchase_required": false
    },
    "proposal": {
      "action": "none",
      "considered": 30,
      "reason": "No eligible product among 30 candidate(s) — 17× pack size not stated on the listing, 9× different pack size than requested, 4× does not look like \"2kg atta\"."
    }
  },
  {
    "run_id": "req_62b1a611980f8fa2",
    "started_at": "2026-09-20T06:17:10.031Z",
    "completed_at": "2026-09-20T06:18:10.142Z",
    "status": "FAILED",
    "mode": "TEST",
    "request_text": "find the cheapest 2kg atta under ₹300",
    "trace_id": "b7f45a64c119f2d6f4cbf335f8bb6412",
    "routed": true,
    "direct": [
      "vitta-purchase-agent"
    ],
    "stages": [
      {
        "agent": "vitta-shopping-planner",
        "status": "done",
        "summary": "\"2kg atta\" ×1 ≤ ₹300",
        "ms": 71
      },
      {
        "agent": "vitta-deal-discovery",
        "status": "failed",
        "summary": "AGENT_UNREACHABLE: vitta-deal-discovery answered HTTP 500 at http://localhost:8080/api/orchestrator/a2a",
        "ms": 60035
      },
      {
        "agent": "vitta-deal-evaluator",
        "status": "pending",
        "summary": null,
        "ms": null
      },
      {
        "agent": "vitta-purchase-agent",
        "status": "pending",
        "summary": null,
        "ms": null
      }
    ],
    "error": {
      "code": "AGENT_UNREACHABLE",
      "message": "vitta-deal-discovery answered HTTP 500 at http://localhost:8080/api/orchestrator/a2a"
    },
    "intent": {
      "product_query": "2kg atta",
      "quantity": 1,
      "max_price_inr": 300,
      "purchase_required": false
    },
    "proposal": null
  },
  {
    "run_id": "req_068eebcb6f44fb23",
    "started_at": "2026-09-20T06:15:36.156Z",
    "completed_at": "2026-09-20T06:15:36.728Z",
    "status": "FAILED",
    "mode": "TEST",
    "request_text": "find the cheapest 2kg atta under ₹300",
    "trace_id": "1432d150d36c2e909934e261e6418b37",
    "routed": true,
    "direct": [
      "vitta-purchase-agent"
    ],
    "stages": [
      {
        "agent": "vitta-shopping-planner",
        "status": "done",
        "summary": "\"2kg atta\" ×1 ≤ ₹300",
        "ms": 53
      },
      {
        "agent": "vitta-deal-discovery",
        "status": "failed",
        "summary": "ANAKIN_ERROR: No merchant could be searched: blinkit: spawn webcmd ENOENT; zepto: Anakin HTTP 402; bigbasket: Anakin HTTP 402",
        "ms": 515
      },
      {
        "agent": "vitta-deal-evaluator",
        "status": "pending",
        "summary": null,
        "ms": null
      },
      {
        "agent": "vitta-purchase-agent",
        "status": "pending",
        "summary": null,
        "ms": null
      }
    ],
    "error": {
      "code": "ANAKIN_ERROR",
      "message": "No merchant could be searched: blinkit: spawn webcmd ENOENT; zepto: Anakin HTTP 402; bigbasket: Anakin HTTP 402"
    },
    "intent": {
      "product_query": "2kg atta",
      "quantity": 1,
      "max_price_inr": 300,
      "purchase_required": false
    },
    "proposal": null
  },
  {
    "run_id": "req_ee92896dbf50840c",
    "started_at": "2026-09-20T06:06:30.916Z",
    "completed_at": "2026-09-20T06:06:31.450Z",
    "status": "FAILED",
    "mode": "TEST",
    "request_text": "find the cheapest 2kg atta under ₹300",
    "trace_id": "ebc80dca401164e1a62a9088071cd95a",
    "routed": true,
    "direct": [
      "vitta-purchase-agent"
    ],
    "stages": [
      {
        "agent": "vitta-shopping-planner",
        "status": "done",
        "summary": "\"2kg atta\" ×1 ≤ ₹300",
        "ms": 48
      },
      {
        "agent": "vitta-deal-discovery",
        "status": "failed",
        "summary": "ANAKIN_ERROR: No merchant could be searched: blinkit: spawn webcmd ENOENT; bigbasket: Anakin HTTP 402; zepto: Anakin HTTP 402",
        "ms": 483
      },
      {
        "agent": "vitta-deal-evaluator",
        "status": "pending",
        "summary": null,
        "ms": null
      },
      {
        "agent": "vitta-purchase-agent",
        "status": "pending",
        "summary": null,
        "ms": null
      }
    ],
    "error": {
      "code": "ANAKIN_ERROR",
      "message": "No merchant could be searched: blinkit: spawn webcmd ENOENT; bigbasket: Anakin HTTP 402; zepto: Anakin HTTP 402"
    },
    "intent": {
      "product_query": "2kg atta",
      "quantity": 1,
      "max_price_inr": 300,
      "purchase_required": false
    },
    "proposal": null
  },
  {
    "run_id": "req_fdd87464915aeb31",
    "started_at": "2026-09-20T06:02:51.597Z",
    "completed_at": "2026-09-20T06:02:51.672Z",
    "status": "FAILED",
    "mode": "TEST",
    "request_text": "find the cheapest 2kg atta under ₹300",
    "trace_id": "f41885aad8d73f6b778193dd5995c10b",
    "routed": true,
    "direct": [
      "vitta-purchase-agent"
    ],
    "stages": [
      {
        "agent": "vitta-shopping-planner",
        "status": "failed",
        "summary": "AGENT_UNREACHABLE: vitta-shopping-planner returned a non-JSON response",
        "ms": 73
      },
      {
        "agent": "vitta-deal-discovery",
        "status": "pending",
        "summary": null,
        "ms": null
      },
      {
        "agent": "vitta-deal-evaluator",
        "status": "pending",
        "summary": null,
        "ms": null
      },
      {
        "agent": "vitta-purchase-agent",
        "status": "pending",
        "summary": null,
        "ms": null
      }
    ],
    "error": {
      "code": "AGENT_UNREACHABLE",
      "message": "vitta-shopping-planner returned a non-JSON response"
    },
    "intent": null,
    "proposal": null
  },
  {
    "run_id": "req_052c0d16cedf7190",
    "started_at": "2026-09-20T06:01:48.846Z",
    "completed_at": "2026-09-20T06:01:48.878Z",
    "status": "FAILED",
    "mode": "TEST",
    "request_text": "find the cheapest 2kg atta under ₹300",
    "trace_id": "a7fcda3aa06f19fc7944634e2a2f4138",
    "routed": true,
    "direct": [
      "vitta-purchase-agent"
    ],
    "stages": [
      {
        "agent": "vitta-shopping-planner",
        "status": "failed",
        "summary": "AGENT_UNREACHABLE: vitta-shopping-planner answered HTTP 400 at http://localhost:8080/api/orchestrator/a2a",
        "ms": 30
      },
      {
        "agent": "vitta-deal-discovery",
        "status": "pending",
        "summary": null,
        "ms": null
      },
      {
        "agent": "vitta-deal-evaluator",
        "status": "pending",
        "summary": null,
        "ms": null
      },
      {
        "agent": "vitta-purchase-agent",
        "status": "pending",
        "summary": null,
        "ms": null
      }
    ],
    "error": {
      "code": "AGENT_UNREACHABLE",
      "message": "vitta-shopping-planner answered HTTP 400 at http://localhost:8080/api/orchestrator/a2a"
    },
    "intent": null,
    "proposal": null
  }
];

const AGENTS = [
  {
    key: 'vitta-shopping-planner',
    label: 'Planner',
    role: 'Understands the request',
    does: 'Turns a plain request into a structured shopping intent: what to find, how many, the price ceiling, and whether to buy.',
    never: 'Never searches, buys or touches money.',
    home: 'nasiko',
    version: '0.1.1',
  },
  {
    key: 'vitta-deal-discovery',
    label: 'Discovery',
    role: 'Finds candidates',
    does: 'Searches Blinkit, Zepto and BigBasket for live products and prices, using web access with a read-only browser fallback.',
    never: 'Read-only: it cannot place an order.',
    home: 'nasiko',
    version: '0.1.3',
  },
  {
    key: 'vitta-deal-evaluator',
    label: 'Evaluator',
    role: 'Chooses the best deal',
    does: 'Compares the candidates with what was asked for and proposes one, or explains why none qualifies. Same input, same answer.',
    never: 'Only proposes. It has no way to spend.',
    home: 'nasiko',
    version: '0.1.1',
  },
  {
    key: 'vitta-purchase-agent',
    label: 'Purchase',
    role: 'Attempts the purchase',
    does: 'Hands the proposal to the spending gate, which prices the real cart and either refuses or authorizes.',
    never: 'Cannot add money to a reserve, and cannot reach a merchant except through the gate.',
    home: 'gate',
    version: null,
  },
];

const RULES = [
  { order: 1, code: 'BAD_SIGNATURE', meaning: 'The mandate’s signature does not verify.' },
  { order: 2, code: 'EXPIRED', meaning: 'The mandate has expired.' },
  { order: 3, code: 'UNKNOWN_COMMAND', meaning: 'The action is not in the merchant command list. Anything unknown is refused.' },
  { order: 4, code: 'MERCHANT_NOT_ALLOWED', meaning: 'The merchant is outside what the mandate allows.' },
  { order: 5, code: 'AMOUNT_UNPARSEABLE', meaning: 'No numeric amount could be read from the real cart.' },
  { order: 6, code: 'OVER_PER_TXN_CAP', meaning: 'The cart total is above the per-purchase limit.' },
  { order: 7, code: 'OVER_TOTAL_CAP', meaning: 'The cart total is above what is left of the mandate’s overall cap.' },
  { order: 8, code: 'TXN_LIMIT_REACHED', meaning: 'The mandate’s maximum number of purchases has been used.' },
];

const STATUS = {
  RUNNING: { label: 'Running', tone: 'gate' },
  PURCHASED: { label: 'Purchased', tone: 'ok' },
  HANDOFF: { label: 'Handed off', tone: 'hold' },
  DENIED: { label: 'Refused by gate', tone: 'bad' },
  STEP_UP_REQUIRED: { label: 'Needs approval', tone: 'hold' },
  NO_PRODUCTS: { label: 'No products found', tone: 'idle' },
  NO_PURCHASE: { label: 'Nothing to buy', tone: 'idle' },
  FAILED: { label: 'Failed', tone: 'bad' },
};

const STAGE_STATUS = {
  done: { label: 'Done', tone: 'ok' },
  failed: { label: 'Failed', tone: 'bad' },
  skipped: { label: 'Skipped', tone: 'idle' },
  pending: { label: 'Not reached', tone: 'idle' },
  running: { label: 'Running', tone: 'gate' },
};

const TONE_BADGE = {
  ok: 'bg-okSoft text-ok',
  bad: 'bg-badSoft text-bad',
  hold: 'bg-holdSoft text-hold',
  idle: 'bg-idleSoft text-mute',
  gate: 'bg-gateSoft text-gate',
};

const TONE_DOT = {
  ok: 'bg-ok',
  bad: 'bg-bad',
  hold: 'bg-hold',
  idle: 'bg-rule',
  gate: 'bg-gate',
};

const AGENT_LABEL = Object.fromEntries(AGENTS.map((a) => [a.key, a.label]));

const ERROR_PLAIN = {
  AGENT_UNREACHABLE: 'An agent could not be reached, or did not send back a usable answer.',
  AGENT_TIMEOUT: 'An agent took too long to answer.',
  ANAKIN_ERROR: 'Web search failed, so no merchant could be searched.',
  DISCOVERY_ERROR: 'No merchant could be searched.',
  NO_PRODUCTS_FOUND: 'The search finished but found no products.',
};

const PAGE_SIZE = 5;

/* ------------------------------------------------------------------------------------------------
   Helpers
------------------------------------------------------------------------------------------------ */

function fmtWhen(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

function fmtMs(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return ms + ' ms';
  return (ms / 1000).toFixed(1) + ' s';
}

function runMs(run) {
  if (!run.started_at || !run.completed_at) return null;
  return new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
}

function shortId(id) {
  return String(id).replace(/^req_/, '').slice(0, 8);
}

function useDebounced(value, delay) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return settled;
}

/* ------------------------------------------------------------------------------------------------
   UI primitives
------------------------------------------------------------------------------------------------ */

function Badge({ tone, children }) {
  return (
    <span className={'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ' + TONE_BADGE[tone]}>
      {children}
    </span>
  );
}

function StageDots({ stages }) {
  return (
    <span className="inline-flex items-center gap-1.5" aria-label="Progress through the four agents">
      {stages.map((s) => {
        const meta = STAGE_STATUS[s.status] || STAGE_STATUS.pending;
        return (
          <span
            key={s.agent}
            title={(AGENT_LABEL[s.agent] || s.agent) + ': ' + meta.label}
            className={'h-2.5 w-2.5 rounded-full ' + TONE_DOT[meta.tone]}
          />
        );
      })}
    </span>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-rule bg-panel px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-mute">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-ink">{value}</div>
      {hint ? <div className="mt-0.5 text-xs text-mute">{hint}</div> : null}
    </div>
  );
}

function EmptyState({ title, body, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="text-base font-medium text-ink">{title}</div>
      {body ? <div className="mt-1 max-w-sm text-sm text-mute">{body}</div> : null}
      {action}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.5 13.5L17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------------------------------------
   Runs
------------------------------------------------------------------------------------------------ */

function RunDrawer({ run, onClose }) {
  const closeRef = useRef(null);
  const [showDetail, setShowDetail] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (closeRef.current) closeRef.current.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const status = STATUS[run.status] || { label: run.status, tone: 'idle' };
  const failedStage = run.stages.find((s) => s.status === 'failed');

  const copyTrace = async () => {
    try {
      await navigator.clipboard.writeText(run.trace_id);
      setCopied('done');
    } catch (e) {
      setCopied('manual');
    }
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Run details">
      <button type="button" aria-label="Close details" className="absolute inset-0 bg-ink/40" onClick={onClose} tabIndex={-1} />
      <aside className="relative flex h-full w-full max-w-lg flex-col bg-panel shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-rule px-5 py-4">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wide text-mute">Run {shortId(run.run_id)}</div>
            <h2 className="mt-1 text-base font-semibold text-ink">{run.request_text}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={status.tone}>{status.label}</Badge>
              <span className="text-xs text-mute">{fmtWhen(run.started_at)}</span>
              <span className="text-xs text-mute">· {fmtMs(runMs(run))} in total</span>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-mute hover:bg-canvas hover:text-ink focus:outline-none focus:ring-2 focus:ring-gate"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4">
          {run.status === 'FAILED' && run.error ? (
            <div className="mb-5 rounded-lg border border-badSoft bg-badSoft/60 px-4 py-3">
              <div className="text-sm font-medium text-bad">
                Stopped at the {failedStage ? AGENT_LABEL[failedStage.agent] : 'pipeline'}
              </div>
              <p className="mt-1 text-sm text-ink">{ERROR_PLAIN[run.error.code] || 'The run stopped with an error.'}</p>
              <button
                type="button"
                onClick={() => setShowDetail((v) => !v)}
                className="mt-2 text-xs font-medium text-gate hover:underline focus:outline-none focus:ring-2 focus:ring-gate"
                aria-expanded={showDetail}
              >
                {showDetail ? 'Hide full message' : 'Show full message'}
              </button>
              {showDetail ? <p className="mt-2 break-words font-mono text-xs text-mute">{run.error.message}</p> : null}
            </div>
          ) : null}

          {run.proposal ? (
            <div className="mb-5 rounded-lg border border-rule bg-canvas px-4 py-3">
              <div className="text-sm font-medium text-ink">Outcome</div>
              <p className="mt-1 text-sm text-mute">{run.proposal.reason}</p>
            </div>
          ) : null}

          <h3 className="text-sm font-semibold text-ink">Steps</h3>
          <ol className="mt-3 space-y-3">
            {run.stages.map((s, i) => {
              const meta = STAGE_STATUS[s.status] || STAGE_STATUS.pending;
              return (
                <li key={s.agent} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={'mt-1 h-3 w-3 rounded-full ' + TONE_DOT[meta.tone]} />
                    {i < run.stages.length - 1 ? <span className="mt-1 w-px flex-1 bg-rule" /> : null}
                  </div>
                  <div className="min-w-0 flex-1 pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-ink">{AGENT_LABEL[s.agent] || s.agent}</span>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      <span className="text-xs text-mute">{fmtMs(s.ms)}</span>
                      {run.direct.includes(s.agent) ? <span className="text-xs text-mute">· ran beside the gate</span> : null}
                    </div>
                    {s.summary && s.status !== 'failed' ? <p className="mt-1 text-sm text-mute">{s.summary}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>

          {run.intent ? (
            <>
              <h3 className="mt-5 text-sm font-semibold text-ink">What was asked for</h3>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-mute">Product</dt>
                <dd className="text-ink">{run.intent.product_query}</dd>
                <dt className="text-mute">Quantity</dt>
                <dd className="text-ink">{run.intent.quantity}</dd>
                <dt className="text-mute">Price ceiling</dt>
                <dd className="text-ink">{run.intent.max_price_inr ? '₹' + run.intent.max_price_inr : 'None'}</dd>
                <dt className="text-mute">Buy it?</dt>
                <dd className="text-ink">{run.intent.purchase_required ? 'Yes' : 'No, search only'}</dd>
              </dl>
            </>
          ) : null}

          <h3 className="mt-5 text-sm font-semibold text-ink">Reference</h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-mute">Mode</dt>
            <dd className="text-ink">{run.mode === 'TEST' ? 'Test — no real order' : 'Live'}</dd>
            <dt className="text-mute">Routing</dt>
            <dd className="text-ink">{run.routed ? 'Through Nasiko' : 'Direct to each agent'}</dd>
            <dt className="text-mute">Trace ID</dt>
            <dd className="min-w-0">
              <span className="break-all font-mono text-xs text-ink">{run.trace_id}</span>
              <button
                type="button"
                onClick={copyTrace}
                className="ml-2 text-xs font-medium text-gate hover:underline focus:outline-none focus:ring-2 focus:ring-gate"
              >
                {copied === 'done' ? 'Copied' : copied === 'manual' ? 'Select and copy' : 'Copy'}
              </button>
            </dd>
          </dl>
        </div>
      </aside>
    </div>
  );
}

function RunsScreen() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  const q = useDebounced(query.trim().toLowerCase(), 300);

  const statuses = useMemo(() => Array.from(new Set(RUNS.map((r) => r.status))), []);

  const filtered = useMemo(() => {
    const rows = RUNS.filter((r) => {
      if (status !== 'ALL' && r.status !== status) return false;
      if (!q) return true;
      const hay = [r.request_text, r.run_id, r.error ? r.error.message : '', r.proposal ? r.proposal.reason : ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
    const byStart = (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
    if (sort === 'oldest') rows.sort(byStart);
    else if (sort === 'slowest') rows.sort((a, b) => (runMs(b) || 0) - (runMs(a) || 0));
    else rows.sort((a, b) => byStart(b, a));
    return rows;
  }, [q, status, sort]);

  useEffect(() => setPage(1), [q, status, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const open = RUNS.find((r) => r.run_id === openId) || null;

  const completed = RUNS.filter((r) => r.status !== 'FAILED').length;
  const failed = RUNS.filter((r) => r.status === 'FAILED').length;
  const purchases = RUNS.filter((r) => r.status === 'PURCHASED').length;
  const clear = () => {
    setQuery('');
    setStatus('ALL');
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Recorded runs" value={RUNS.length} />
        <Stat label="Ran to the end" value={completed} />
        <Stat label="Failed" value={failed} />
        <Stat label="Purchases made" value={purchases} hint="All runs were in test mode" />
      </div>

      <div className="mt-6 rounded-lg border border-rule bg-panel">
        <div className="flex flex-col gap-3 border-b border-rule p-3 sm:flex-row sm:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search runs</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute">
              <SearchIcon />
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by request, run ID or message"
              className="w-full rounded-md border border-rule bg-panel py-2 pl-9 pr-3 text-sm text-ink placeholder-mute focus:border-gate focus:outline-none focus:ring-2 focus:ring-gate/30"
            />
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Filter by outcome"
            className="rounded-md border border-rule bg-panel px-3 py-2 text-sm text-ink focus:border-gate focus:outline-none focus:ring-2 focus:ring-gate/30"
          >
            <option value="ALL">All outcomes</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {(STATUS[s] || { label: s }).label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort runs"
            className="rounded-md border border-rule bg-panel px-3 py-2 text-sm text-ink focus:border-gate focus:outline-none focus:ring-2 focus:ring-gate/30"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="slowest">Slowest first</option>
          </select>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="No runs match"
            body="Try a different search or outcome."
            action={
              <button
                type="button"
                onClick={clear}
                className="mt-4 rounded-md border border-rule px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas focus:outline-none focus:ring-2 focus:ring-gate"
              >
                Clear filters
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-rule text-xs uppercase tracking-wide text-mute">
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Request</th>
                  <th className="px-4 py-2.5 font-medium">Outcome</th>
                  <th className="px-4 py-2.5 font-medium">Agents</th>
                  <th className="px-4 py-2.5 text-right font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const meta = STATUS[r.status] || { label: r.status, tone: 'idle' };
                  return (
                    <tr
                      key={r.run_id}
                      onClick={() => setOpenId(r.run_id)}
                      className="cursor-pointer border-b border-rule last:border-b-0 hover:bg-canvas"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-mute">{fmtWhen(r.started_at)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(r.run_id);
                          }}
                          className="text-left font-medium text-ink hover:text-gate focus:outline-none focus:ring-2 focus:ring-gate"
                        >
                          {r.request_text}
                        </button>
                        <div className="text-xs text-mute">Run {shortId(r.run_id)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <StageDots stages={r.stages} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-ink">{fmtMs(runMs(r))}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-rule px-4 py-3 text-sm text-mute">
          <span>
            {filtered.length === 0
              ? 'No runs'
              : 'Showing ' + ((page - 1) * PAGE_SIZE + 1) + '–' + Math.min(page * PAGE_SIZE, filtered.length) + ' of ' + filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-rule px-3 py-1 text-ink hover:bg-canvas focus:outline-none focus:ring-2 focus:ring-gate disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span>
              Page {page} of {pages}
            </span>
            <button
              type="button"
              disabled={page >= pages}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="rounded-md border border-rule px-3 py-1 text-ink hover:bg-canvas focus:outline-none focus:ring-2 focus:ring-gate disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {open ? <RunDrawer run={open} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
   Agents
------------------------------------------------------------------------------------------------ */

function AgentsScreen() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <p className="max-w-2xl text-sm text-mute">
        Four agents share one shopping request. Nasiko registers and routes three of them; the Purchase agent runs beside
        the spending gate, because it needs the signed mandates and merchant sessions that live on that machine.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {AGENTS.map((a) => {
          const done = RUNS.filter((r) => r.stages.some((s) => s.agent === a.key && s.status === 'done')).length;
          const failed = RUNS.filter((r) => r.stages.some((s) => s.agent === a.key && s.status === 'failed')).length;
          const skipped = RUNS.filter((r) => r.stages.some((s) => s.agent === a.key && s.status === 'skipped')).length;
          return (
            <section key={a.key} className="rounded-lg border border-rule bg-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-ink">{a.label}</h2>
                  <div className="text-sm text-mute">{a.role}</div>
                </div>
                {a.home === 'nasiko' ? <Badge tone="ok">Running in Nasiko · v{a.version}</Badge> : <Badge tone="hold">Beside the gate</Badge>}
              </div>
              <p className="mt-3 text-sm text-ink">{a.does}</p>
              <p className="mt-2 text-sm text-mute">{a.never}</p>
              <div className="mt-4 flex gap-4 border-t border-rule pt-3 text-xs text-mute">
                <span>
                  <span className="font-semibold text-ok">{done}</span> completed
                </span>
                <span>
                  <span className="font-semibold text-bad">{failed}</span> failed
                </span>
                <span>
                  <span className="font-semibold text-ink">{skipped}</span> skipped
                </span>
                <span className="text-mute">across {RUNS.length} runs</span>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
   Spending rules
------------------------------------------------------------------------------------------------ */

function RulesScreen() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <p className="max-w-2xl text-sm text-mute">
        Agents can propose a purchase; only the spending gate can allow one. It prices the real cart, then checks these rules
        in order and stops at the first that fails. A refused purchase never reaches the merchant and draws no money.
      </p>

      <div className="mt-5 overflow-hidden rounded-lg border border-rule bg-panel">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-rule text-xs uppercase tracking-wide text-mute">
              <th className="w-16 px-4 py-2.5 font-medium">Order</th>
              <th className="px-4 py-2.5 font-medium">Reason code</th>
              <th className="px-4 py-2.5 font-medium">What it means</th>
            </tr>
          </thead>
          <tbody>
            {RULES.map((r) => (
              <tr key={r.code} className="border-b border-rule last:border-b-0">
                <td className="px-4 py-3 text-mute">{r.order}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-gateSoft px-2 py-0.5 font-mono text-xs text-gate">{r.code}</span>
                </td>
                <td className="px-4 py-3 text-ink">{r.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-rule bg-panel p-4">
          <div className="text-sm font-semibold text-ink">Looking is always allowed</div>
          <p className="mt-1 text-sm text-mute">Searching and reading a cart need no mandate, so an expired mandate never blocks browsing.</p>
        </div>
        <div className="rounded-lg border border-rule bg-panel p-4">
          <div className="text-sm font-semibold text-ink">Needs approval</div>
          <p className="mt-1 text-sm text-mute">If a merchant blocks checkout, or the mandate must be signed again, the purchase pauses. Nothing is executed or drawn.</p>
        </div>
        <div className="rounded-lg border border-rule bg-panel p-4">
          <div className="text-sm font-semibold text-ink">Agents cannot add money</div>
          <p className="mt-1 text-sm text-mute">The Purchase agent never tops up a reserve. Funding is a separate step for a person.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
   Shell
------------------------------------------------------------------------------------------------ */

const TABS = [
  { id: 'runs', label: 'Runs' },
  { id: 'agents', label: 'Agents' },
  { id: 'rules', label: 'Spending rules' },
];

function App() {
  const [tab, setTab] = useState('runs');
  const latest = RUNS.reduce((m, r) => (r.completed_at && r.completed_at > m ? r.completed_at : m), '');

  return (
    <div className="h-[100dvh] overflow-hidden flex flex-col bg-canvas text-ink font-sans">
      <header className="sticky top-0 z-40 border-b border-rule bg-panel">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 sm:px-6">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-ink">Vitta Agent Ops</h1>
              <div className="text-sm text-mute">Shopping agents, their runs, and the spending rules behind them</div>
            </div>
            <div className="hidden text-right text-xs text-mute sm:block">Latest run {fmtWhen(latest)}</div>
          </div>
          <nav role="tablist" aria-label="Sections" className="-mb-px flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={
                  'border-b-2 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gate ' +
                  (tab === t.id ? 'border-gate text-gate' : 'border-transparent text-mute hover:text-ink')
                }
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="min-h-0 flex-1 overflow-auto">
        {tab === 'runs' ? <RunsScreen /> : tab === 'agents' ? <AgentsScreen /> : <RulesScreen />}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
