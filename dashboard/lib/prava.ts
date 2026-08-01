// Server-only Prava sandbox balance lookup. It never exposes PRAVA_SECRET_KEY to client code.
export interface ReserveBalance { balanceInr: number; available: true; }
export interface ReserveBalanceUnavailable { available: false; reason: string; }

const baseUrl = process.env.PRAVA_API_BASE_URL || 'https://sandbox.api.prava.space';

interface PravaMandate {
  id: string;
  status: string;
  remaining: string;
}

function parseSessionRef(reserveRef: string): { sessionId: string; userId: string } | null {
  const match = /^prava-session:([^:]+):(.+)$/.exec(reserveRef);
  if (!match) return null;
  return { sessionId: match[1], userId: match[2] };
}

async function readMandateBalance(mandateId: string): Promise<ReserveBalance | ReserveBalanceUnavailable> {
  try {
    const response = await fetch(`${baseUrl}/v1/mandates/${encodeURIComponent(mandateId)}`, {
      headers: { Authorization: `Bearer ${process.env.PRAVA_SECRET_KEY}` },
      cache: 'no-store',
    });
    const body = await response.json() as { remaining?: string; error?: { message?: string } };
    if (!response.ok || body.remaining === undefined) {
      return { available: false, reason: body.error?.message ?? `Prava API returned HTTP ${response.status}` };
    }
    return { available: true, balanceInr: Number(body.remaining) };
  } catch (err) {
    return { available: false, reason: err instanceof Error ? err.message : 'Unknown error reading Prava balance' };
  }
}

export async function getReserveBalance(reserveRef: string): Promise<ReserveBalance | ReserveBalanceUnavailable> {
  if (!process.env.PRAVA_SECRET_KEY) return { available: false, reason: 'Prava is not configured (missing PRAVA_SECRET_KEY)' };

  if (reserveRef.startsWith('mdt_')) {
    return readMandateBalance(reserveRef);
  }

  const session = parseSessionRef(reserveRef);
  if (!session) {
    return { available: false, reason: 'Awaiting Prava passkey approval; attach the resulting mdt_ mandate reference.' };
  }

  try {
    const response = await fetch(
      `${baseUrl}/v1/mandates?customer_id=${encodeURIComponent(session.userId)}&standing_only=true`,
      {
        headers: { Authorization: `Bearer ${process.env.PRAVA_SECRET_KEY}` },
        cache: 'no-store',
      }
    );
    const body = await response.json() as { mandates?: PravaMandate[]; error?: { message?: string } };
    if (!response.ok || !Array.isArray(body.mandates)) {
      return { available: false, reason: body.error?.message ?? `Prava API returned HTTP ${response.status}` };
    }

    const active = body.mandates.filter((mandate) => mandate.status === 'active');
    if (active.length !== 1) {
      return {
        available: false,
        reason: active.length === 0
          ? `Prava session ${session.sessionId} is still awaiting passkey approval`
          : `Prava session ${session.sessionId} resolved to ${active.length} active mandates`,
      };
    }

    return readMandateBalance(active[0].id);
  } catch (err) {
    return { available: false, reason: err instanceof Error ? err.message : 'Unknown error reading Prava balance' };
  }
}
