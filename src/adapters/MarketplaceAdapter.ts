// Unified Marketplace Adapter Architecture (CLAUDE.md / ADR-015 compliant).
// Encapsulates marketplace-specific search, add-to-cart, cart reading, checkout, and order placement
// logic into normalized adapter implementations for Blinkit, Zepto, BigBasket, and future marketplaces.

import { runGate, runSearch } from '../agent/gate-spawn';
import { MERCHANT_PROFILES, type PurchaseMerchant } from '../agent/merchants';
import { parseCommitOutput } from '../agent/parse-commit-output';

export interface NormalizedProduct {
  productId: string;
  merchant: PurchaseMerchant;
  name: string;
  priceInr: number;
  mrpInr?: number;
  imageUrl?: string;
  url?: string;
  brand?: string;
  unitSize?: string;
  available: boolean;
  availabilityLabel?: string;
}

export interface AddToCartResult {
  ok: boolean;
  productId: string;
  quantity: number;
  message?: string;
  raw?: unknown;
}

export interface AdapterCartItem {
  productId?: string;
  name?: string;
  priceInr?: number;
  quantity?: number;
  lineTotalInr?: number;
}

export interface AdapterCartReadResult {
  ok: boolean;
  cartTotalInr?: number;
  cartItemCount?: number;
  items?: AdapterCartItem[];
  message?: string;
}

export interface AdapterCheckoutResult {
  ok: boolean;
  payableInr?: number;
  checkoutBlocked?: boolean;
  blockedReason?: string;
  message?: string;
}

export interface AdapterPlaceOrderResult {
  ok: boolean;
  orderId?: string;
  receiptId?: string;
  commitProof?: string;
  verdict?: 'ALLOW' | 'DENY' | 'STEP_UP';
  denyCode?: string;
  amountInr?: number;
  handoffUrl?: string;
  message?: string;
  raw?: string;
}

export interface MarketplaceAdapter {
  readonly name: PurchaseMerchant;
  readonly minCartInr: number;
  readonly maxQuantity: number;

  search(query: string): Promise<NormalizedProduct[]>;
  addToCart(productRef: string, quantity: number, url?: string): Promise<AddToCartResult>;
  getCart(): Promise<AdapterCartReadResult>;
  checkout(): Promise<AdapterCheckoutResult>;
  placeOrder(options?: { confirm?: boolean }): Promise<AdapterPlaceOrderResult>;
}

/** Base implementation providing common execution wrappers and error formatting. */
export abstract class BaseMarketplaceAdapter implements MarketplaceAdapter {
  abstract readonly name: PurchaseMerchant;
  abstract readonly minCartInr: number;

  get maxQuantity(): number {
    return MERCHANT_PROFILES[this.name]?.maxQuantity ?? 12;
  }

  async search(query: string): Promise<NormalizedProduct[]> {
    const result = await runSearch([this.name, 'search', query]);
    if (!result.ok && !result.stdout) return [];
    try {
      const parsed = JSON.parse(result.stdout.trim() || '{}') as {
        ok?: boolean;
        results?: Array<{ products?: Array<Record<string, unknown>> }>;
        rows?: Array<Record<string, unknown>>;
      };

      const rawProducts: Array<Record<string, unknown>> =
        parsed.results?.[0]?.products ?? parsed.rows ?? [];

      return rawProducts.map((p) => this.normalizeProduct(p));
    } catch {
      return [];
    }
  }

  protected normalizeProduct(raw: Record<string, unknown>): NormalizedProduct {
    const id = String(raw.productId ?? raw.product_id ?? raw.id ?? raw.url ?? '');
    const name = String(raw.name ?? raw.title ?? 'Product');
    const price = Number(raw.priceInr ?? raw.price ?? 0);
    const mrp = raw.mrpInr !== undefined ? Number(raw.mrpInr) : raw.mrp !== undefined ? Number(raw.mrp) : undefined;
    const imageUrl = typeof raw.imageUrl === 'string' ? raw.imageUrl : typeof raw.image_url === 'string' ? raw.image_url : undefined;
    const url = typeof raw.url === 'string' ? raw.url : undefined;
    const brand = typeof raw.brand === 'string' ? raw.brand : undefined;
    const unitSize = typeof raw.pack_size === 'string' ? raw.pack_size : typeof raw.unitSize === 'string' ? raw.unitSize : undefined;
    const available = raw.available !== false && raw.availability !== 'Out of stock';
    const availabilityLabel = typeof raw.availabilityLabel === 'string' ? raw.availabilityLabel : String(raw.availability ?? 'In stock');

    return {
      productId: id,
      merchant: this.name,
      name,
      priceInr: price,
      mrpInr: mrp,
      imageUrl,
      url,
      brand,
      unitSize,
      available,
      availabilityLabel,
    };
  }

  async addToCart(productRef: string, quantity: number, url?: string): Promise<AddToCartResult> {
    const qty = Math.min(Math.max(1, quantity), this.maxQuantity);
    const targetRef = this.name === 'zepto' && url ? url : productRef;

    const result = await runGate([
      'run',
      '--',
      'webcmd',
      this.name,
      'add-to-cart',
      targetRef,
      '--quantity',
      String(qty),
    ]);

    if (!result.ok) {
      return {
        ok: false,
        productId: productRef,
        quantity: qty,
        message: result.stderr.trim() || result.stdout.trim() || `Failed to add ${productRef} to ${this.name} cart`,
      };
    }

    return {
      ok: true,
      productId: productRef,
      quantity: qty,
      raw: result.stdout,
    };
  }

  async getCart(): Promise<AdapterCartReadResult> {
    const result = await runSearch([this.name, 'cart']);
    try {
      const parsed = JSON.parse(result.stdout.trim() || '{}') as {
        ok?: boolean;
        cartTotalInr?: number;
        cartItemCount?: number;
        rows?: Array<Record<string, unknown>>;
        message?: string;
      };
      return {
        ok: Boolean(parsed.ok),
        cartTotalInr: parsed.cartTotalInr,
        cartItemCount: parsed.cartItemCount,
        items: parsed.rows?.map((row) => ({
          productId: String(row.productId ?? row.product_id ?? ''),
          name: String(row.name ?? row.title ?? ''),
          priceInr: Number(row.price ?? 0),
          quantity: Number(row.quantity ?? 1),
          lineTotalInr: Number(row.total ?? row.line_total ?? 0),
        })),
        message: parsed.message,
      };
    } catch {
      return { ok: false, message: result.stderr.trim() || 'Could not parse cart response' };
    }
  }

  async checkout(): Promise<AdapterCheckoutResult> {
    const result = await runGate(['run', '--', 'webcmd', this.name, 'checkout']);
    try {
      const parsed = JSON.parse(result.stdout.trim() || '{}') as {
        ok?: boolean;
        payable?: number;
        checkoutBlocked?: boolean;
        validations?: unknown[];
        message?: string;
      };
      const blocked = Boolean(parsed.checkoutBlocked || (parsed.validations && parsed.validations.length > 0));
      return {
        ok: Boolean(parsed.ok),
        payableInr: parsed.payable,
        checkoutBlocked: blocked,
        blockedReason: blocked ? `Checkout blocked by ${this.name}` : undefined,
        message: parsed.message,
      };
    } catch {
      return { ok: result.ok, message: result.stderr.trim() || 'Checkout read output unparseable' };
    }
  }

  async placeOrder(options?: { confirm?: boolean }): Promise<AdapterPlaceOrderResult> {
    const args = ['run', '--', 'webcmd', this.name, 'place-order'];
    if (options?.confirm !== false) {
      args.push('--confirm');
    }
    const result = await runGate(args);
    const raw = (result.stdout + '\n' + result.stderr).trim();
    const parsed = parseCommitOutput(result.stdout);

    const isSuccess = Boolean(parsed.receiptId) || Boolean(parsed.handoffUrl);

    return {
      ok: result.ok && isSuccess,
      orderId: parsed.orderId,
      receiptId: parsed.receiptId,
      commitProof: parsed.commitProof,
      verdict: parsed.verdict,
      denyCode: parsed.denyCode,
      amountInr: parsed.amountInr,
      handoffUrl: parsed.handoffUrl,
      raw,
      message: isSuccess
        ? 'Order placed successfully'
        : raw || result.stderr.trim() || 'Order placement did not confirm',
    };
  }
}

export class BlinkitAdapter extends BaseMarketplaceAdapter {
  readonly name = 'blinkit';
  readonly minCartInr = 150;
}

export class ZeptoAdapter extends BaseMarketplaceAdapter {
  readonly name = 'zepto';
  readonly minCartInr = 100;
}

export class BigBasketAdapter extends BaseMarketplaceAdapter {
  readonly name = 'bigbasket';
  readonly minCartInr = 200;
}

/** Registry mapping merchant identifiers to adapter instances. */
export class MarketplaceAdapterRegistry {
  private static instance: MarketplaceAdapterRegistry;
  private adapters: Map<PurchaseMerchant, MarketplaceAdapter> = new Map();

  private constructor() {
    this.register(new BlinkitAdapter());
    this.register(new ZeptoAdapter());
    this.register(new BigBasketAdapter());
  }

  static getInstance(): MarketplaceAdapterRegistry {
    if (!MarketplaceAdapterRegistry.instance) {
      MarketplaceAdapterRegistry.instance = new MarketplaceAdapterRegistry();
    }
    return MarketplaceAdapterRegistry.instance;
  }

  register(adapter: MarketplaceAdapter): void {
    this.adapters.set(adapter.name, adapter);
  }

  get(name: PurchaseMerchant): MarketplaceAdapter {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`No marketplace adapter registered for merchant: ${name}`);
    }
    return adapter;
  }

  getAll(): MarketplaceAdapter[] {
    return Array.from(this.adapters.values());
  }
}
