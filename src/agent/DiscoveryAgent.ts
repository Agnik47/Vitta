import { runSearch } from './gate-spawn';
import { type PurchaseMerchant } from './merchants';

export interface DiscoveryResult {
  merchant: PurchaseMerchant;
  productRef: string;
  productName: string;
  priceInr: number;
}

export class DiscoveryAgent {
  private events: any[] = [];

  constructor(private readonly onEvent?: (event: any) => void) {}

  private emit(step: string, detail: string) {
    const event = { step, detail, timestamp: new Date().toISOString() };
    this.events.push(event);
    this.onEvent?.(event);
  }

  async findBestMatch(query: string, maxPriceInr?: number): Promise<DiscoveryResult | null> {
    const merchants: PurchaseMerchant[] = ['blinkit', 'zepto', 'bigbasket'];
    let bestMatch: DiscoveryResult | null = null;

    this.emit('search', `Searching for "${query}" across merchants...`);

    for (const merchant of merchants) {
      try {
        const result = await runSearch([merchant, 'search', query]);
        const parsed = JSON.parse(result.stdout.trim() || '{}') as { ok?: boolean; rows?: any[] };
        
        if (parsed.ok && parsed.rows && parsed.rows.length > 0) {
          for (const row of parsed.rows) {
            const price = Number(row.price || row.priceInr || 0);
            const ref = String(row.productId || row.product_id || row.url || '');
            const name = String(row.name || row.title || '');
            const available = row.available !== false && row.availability !== 'Out of stock';

            if (!available || !ref || price <= 0) continue;
            if (maxPriceInr !== undefined && price > maxPriceInr) continue;

            if (!bestMatch || price < bestMatch.priceInr) {
              bestMatch = { merchant, productRef: ref, productName: name, priceInr: price };
            }
          }
        }
      } catch (err) {
        // ignore errors from a single merchant
      }
    }

    if (bestMatch) {
      this.emit('found', `Found best match: ${bestMatch.productName} at ${bestMatch.merchant} for ₹${bestMatch.priceInr}`);
    } else {
      this.emit('failed', `No matching product found for "${query}"`);
    }

    return bestMatch;
  }
}
