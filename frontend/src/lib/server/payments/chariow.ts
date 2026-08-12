/**
 * Chariow provider — hosted checkout for Mobile Money (Orange Money, Wave,
 * MTN, Moov…) + card, wired for a SINGLE PLATFORM ACCOUNT (ThèseFacile sells
 * its own Essentiel plan — no per-creator MobileMoneyAccount, unlike the
 * marketplace integration Chariow.md documents; see that file's §1 note on
 * adapting the account model to a SaaS).
 *
 * Contract (endpoints, payload shapes, status mapping) reproduced from
 * Chariow.md §3/§3bis/§7 — a real, previously-shipped integration in a
 * different project. Nothing here is invented.
 *
 * Price is NEVER sent to Chariow: it debits whatever price is configured on
 * `product_id` in the merchant's Chariow dashboard. `charge()` still expects
 * `input.amount` (used only to select which product to charge via
 * `metadata.plan`); the actual anti-fraud amount check happens later against
 * Chariow's own returned amount in `subscriptions/reconcile.ts`.
 */
import { resolveChariowPhone } from '../subscriptions/phone';
import type { WebhookProvider, ParsedIds } from '../webhook/handler';
import type { PaymentProvider, ChargeInput, ChargeResult } from './provider';

export interface ChariowEnv {
  CHARIOW_API_URL: string;
  CHARIOW_API_KEY: string;
  CHARIOW_PRODUCT_ID_ESSENTIEL: string;
}

export interface ChariowSale {
  status: string;
  amount: { value: number; currency: string };
  paidAt: Date | null;
}

export interface ChariowWebhookPayload {
  event_type?: string;
  event?: string;
  data?: {
    sale_id?: string;
    id?: string;
    status?: string;
    custom_metadata?: { orderId?: string; userId?: string; plan?: string };
  };
  [key: string]: unknown;
}

export type ChariowNormalizedStatus = 'succeeded' | 'failed' | 'abandoned' | 'pending';

/**
 * Chariow.md §3.3 — order of tests matters: "unpaid" contains "paid", so it
 * MUST be classified `pending` before the generic `paid` test runs.
 */
export function mapChariowStatus(raw: string | undefined | null): ChariowNormalizedStatus {
  const s = String(raw ?? '').toLowerCase();
  if (/unpaid/.test(s)) return 'pending';
  if (/cancel|abandon|refund/.test(s)) return 'abandoned';
  if (/failed|error/.test(s)) return 'failed';
  if (/settle|complete|paid|success/.test(s)) return 'succeeded';
  return 'pending';
}

const HTTP_TIMEOUT_MS = 30_000;

export interface ChariowProviderHandle extends PaymentProvider {
  getSaleStatus(saleId: string, opts?: { timeoutMs?: number }): Promise<ChariowSale>;
  webhookProvider: WebhookProvider<ChariowWebhookPayload>;
}

/** v1 only has Essentiel — extend when Premium ships (spec's "hors périmètre"). */
function productIdForPlan(env: ChariowEnv, plan: string): string {
  if (plan === 'ESSENTIEL') return env.CHARIOW_PRODUCT_ID_ESSENTIEL;
  throw new Error(`Chariow: no product configured for plan "${plan}"`);
}

export function createChariowProvider(env: ChariowEnv): ChariowProviderHandle {
  if (!env.CHARIOW_API_URL) throw new Error('createChariowProvider: CHARIOW_API_URL is required');
  if (!env.CHARIOW_API_KEY) throw new Error('createChariowProvider: CHARIOW_API_KEY is required');
  if (!env.CHARIOW_PRODUCT_ID_ESSENTIEL) {
    throw new Error('createChariowProvider: CHARIOW_PRODUCT_ID_ESSENTIEL is required');
  }

  const baseUrl = env.CHARIOW_API_URL.replace(/\/+$/, '');

  async function charge(input: ChargeInput): Promise<ChargeResult> {
    const plan = typeof input.metadata?.plan === 'string' ? input.metadata.plan : '';
    if (!plan) throw new Error('Chariow charge: metadata.plan is required');
    const productId = productIdForPlan(env, plan);

    const resolvedPhone = resolveChariowPhone({
      phone: input.customer.phone ?? null,
      phoneCountry: input.customer.phoneCountry ?? null,
      phoneLocal: input.customer.phoneLocal ?? null,
    });
    if (!resolvedPhone) throw new Error('Chariow charge: could not resolve a valid phone number');

    const body: Record<string, unknown> = {
      product_id: productId,
      first_name: input.customer.firstName ?? 'Client',
      last_name: input.customer.lastName ?? 'ThèseFacile',
      phone: { number: resolvedPhone.number, country_code: resolvedPhone.countryCode },
      // Chariow has a single `redirect_url` — no separate failure URL,
      // unlike Bictorys' successRedirectUrl/errorRedirectUrl pair. The
      // return page itself determines outcome by polling, never by URL.
      redirect_url: input.successUrl,
      custom_metadata: { orderId: input.externalRef, plan },
    };
    if (input.customer.email) body.email = input.customer.email;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.CHARIOW_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Chariow network error: ${msg}`);
    }
    clearTimeout(timer);

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Chariow checkout failed: HTTP ${res.status} — ${text.slice(0, 200)}`);
    }
    let json: {
      data?: {
        purchase?: { id?: string; amount?: { value?: number; currency?: string } };
        payment?: { checkout_url?: string };
      };
    };
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Chariow checkout returned non-JSON: ${text.slice(0, 200)}`);
    }
    const providerChargeId = json.data?.purchase?.id ?? '';
    const paymentUrl = json.data?.payment?.checkout_url ?? '';
    if (!providerChargeId || !paymentUrl) {
      // Never construct a redirect from an incomplete response (Chariow.md
      // §11.6 — "jamais de redirect en dur si la réponse est incomplète").
      throw new Error('Chariow checkout returned an incomplete response (missing id/checkout_url)');
    }
    const result: ChargeResult = { providerChargeId, paymentUrl, status: 'PENDING' };
    if (typeof json.data?.purchase?.amount?.value === 'number') {
      result.amount = json.data.purchase.amount.value;
    }
    if (typeof json.data?.purchase?.amount?.currency === 'string') {
      result.currency = json.data.purchase.amount.currency;
    }
    return result;
  }

  async function getSaleStatus(
    saleId: string,
    opts: { timeoutMs?: number } = {},
  ): Promise<ChariowSale> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? HTTP_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/sales/${encodeURIComponent(saleId)}`, {
        headers: { Authorization: `Bearer ${env.CHARIOW_API_KEY}` },
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Chariow network error: ${msg}`);
    }
    clearTimeout(timer);

    const text = await res.text();
    if (!res.ok) {
      throw new Error(
        `Chariow GET /sales/${saleId} failed: HTTP ${res.status} — ${text.slice(0, 200)}`,
      );
    }
    let json: {
      data?: {
        status?: string;
        amount?: { value?: number; currency?: string };
        settled_at?: string;
        paid_at?: string;
        completed_at?: string;
      };
    };
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Chariow GET /sales/${saleId} returned non-JSON: ${text.slice(0, 200)}`);
    }
    const data = json.data ?? {};
    const dateStr = data.settled_at ?? data.paid_at ?? data.completed_at ?? null;
    return {
      status: String(data.status ?? ''),
      amount: {
        value: Number(data.amount?.value ?? 0),
        currency: String(data.amount?.currency ?? ''),
      },
      paidAt: dateStr ? new Date(dateStr) : null,
    };
  }

  const webhookProvider: WebhookProvider<ChariowWebhookPayload> = {
    name: 'chariow',

    // Chariow has no body signature — the shared secret travels in the
    // webhook URL's `?secret=` query param instead (Chariow.md §7). That
    // check happens in the route shim BEFORE this factory ever runs (the
    // shim only reads `req.nextUrl.searchParams`, never the body — no
    // conflict with the raw-body-first invariant). By the time this
    // function is called, the request is already authenticated.
    verifySignature() {
      return { valid: true };
    },

    parsePayload(rawBody) {
      return JSON.parse(rawBody.toString('utf8')) as ChariowWebhookPayload;
    },

    extractIds(payload): ParsedIds {
      const eventType = String(payload.event_type ?? payload.event ?? 'unknown');
      const externalId = String(payload.data?.sale_id ?? payload.data?.id ?? '');
      // Chariow.md §7 — recognized success event names.
      const recognizedPaid = ['successful.sale', 'settled.sale', 'completed.sale'].includes(
        eventType,
      );
      const kind: ParsedIds['kind'] = recognizedPaid ? 'paid' : 'other';
      return { externalId, eventType, kind };
    },
  };

  return { name: 'chariow', charge, getSaleStatus, webhookProvider };
}
