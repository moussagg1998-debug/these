import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChariowProvider, mapChariowStatus } from './chariow';

describe('mapChariowStatus', () => {
  it('maps settle/complete/paid/success to succeeded', () => {
    expect(mapChariowStatus('settled')).toBe('succeeded');
    expect(mapChariowStatus('complete')).toBe('succeeded');
    expect(mapChariowStatus('paid')).toBe('succeeded');
    expect(mapChariowStatus('success')).toBe('succeeded');
  });

  it('maps failed/error to failed', () => {
    expect(mapChariowStatus('failed')).toBe('failed');
    expect(mapChariowStatus('error')).toBe('failed');
  });

  it('maps cancel/abandon/refund to abandoned', () => {
    expect(mapChariowStatus('cancelled')).toBe('abandoned');
    expect(mapChariowStatus('abandoned')).toBe('abandoned');
    expect(mapChariowStatus('refunded')).toBe('abandoned');
  });

  it('maps unknown strings to pending', () => {
    expect(mapChariowStatus('processing')).toBe('pending');
    expect(mapChariowStatus(undefined)).toBe('pending');
    expect(mapChariowStatus(null)).toBe('pending');
  });

  // Chariow.md §3.3 pitfall — "unpaid" contains "paid" and MUST classify
  // as pending, never succeeded.
  it('maps "unpaid" to pending, never succeeded (order-of-tests pitfall)', () => {
    expect(mapChariowStatus('unpaid')).toBe('pending');
    expect(mapChariowStatus('UNPAID')).toBe('pending');
  });
});

describe('createChariowProvider', () => {
  const env = {
    CHARIOW_API_URL: 'https://api.chariow.test',
    CHARIOW_API_KEY: 'test-key',
    CHARIOW_PRODUCT_ID_ESSENTIEL: 'prod_essentiel_test',
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws synchronously when required env is missing', () => {
    expect(() => createChariowProvider({ ...env, CHARIOW_API_KEY: '' })).toThrow(/CHARIOW_API_KEY/);
  });

  it('charge() posts to /checkout with product_id, phone, redirect_url, custom_metadata', async () => {
    const provider = createChariowProvider(env);
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            purchase: { id: 'sale_123', amount: { value: 5900, currency: 'XOF' } },
            payment: { checkout_url: 'https://chariow.test/pay/sale_123' },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await provider.charge({
      amount: 5900,
      currency: 'XOF',
      customer: {
        email: 'a@b.com',
        firstName: 'Ruth',
        lastName: 'Thiala',
        phone: '+221771234567',
        phoneCountry: 'SN',
        phoneLocal: '771234567',
      },
      metadata: { plan: 'ESSENTIEL' },
      successUrl: 'https://app.test/subscribe/return?orderId=o1',
      failureUrl: 'https://app.test/subscribe/return?orderId=o1&status=failed',
      externalRef: 'o1',
    });

    expect(result).toEqual({
      providerChargeId: 'sale_123',
      paymentUrl: 'https://chariow.test/pay/sale_123',
      status: 'PENDING',
      amount: 5900,
      currency: 'XOF',
    });

    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[0]).toBe('https://api.chariow.test/checkout');
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({
      product_id: 'prod_essentiel_test',
      first_name: 'Ruth',
      last_name: 'Thiala',
      phone: { number: '771234567', country_code: 'SN' },
      redirect_url: 'https://app.test/subscribe/return?orderId=o1',
      custom_metadata: { orderId: 'o1', plan: 'ESSENTIEL' },
    });
    expect(call[1].headers.Authorization).toBe('Bearer test-key');
  });

  it('charge() rejects when metadata.plan is missing', async () => {
    const provider = createChariowProvider(env);
    await expect(
      provider.charge({
        amount: 5900,
        currency: 'XOF',
        customer: { phone: '+221771234567' },
        successUrl: 'https://app.test/return',
        failureUrl: 'https://app.test/return',
        externalRef: 'o1',
      }),
    ).rejects.toThrow(/plan/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('charge() rejects when the phone cannot be resolved', async () => {
    const provider = createChariowProvider(env);
    await expect(
      provider.charge({
        amount: 5900,
        currency: 'XOF',
        customer: { phone: 'not-a-number' },
        metadata: { plan: 'ESSENTIEL' },
        successUrl: 'https://app.test/return',
        failureUrl: 'https://app.test/return',
        externalRef: 'o1',
      }),
    ).rejects.toThrow(/phone/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('charge() throws on an incomplete Chariow response (no dead redirect)', async () => {
    const provider = createChariowProvider(env);
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { purchase: {}, payment: {} } }), { status: 200 }),
    );
    await expect(
      provider.charge({
        amount: 5900,
        currency: 'XOF',
        customer: { phone: '+221771234567' },
        metadata: { plan: 'ESSENTIEL' },
        successUrl: 'https://app.test/return',
        failureUrl: 'https://app.test/return',
        externalRef: 'o1',
      }),
    ).rejects.toThrow(/incomplete/);
  });

  it('getSaleStatus() reads GET /sales/{id} and normalizes the response', async () => {
    const provider = createChariowProvider(env);
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            status: 'settled',
            amount: { value: 5900, currency: 'XOF' },
            settled_at: '2026-08-11T10:00:00.000Z',
          },
        }),
        { status: 200 },
      ),
    );
    const sale = await provider.getSaleStatus('sale_123');
    expect(sale).toEqual({
      status: 'settled',
      amount: { value: 5900, currency: 'XOF' },
      paidAt: new Date('2026-08-11T10:00:00.000Z'),
    });
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(call[0]).toBe('https://api.chariow.test/sales/sale_123');
    expect(call[1].headers.Authorization).toBe('Bearer test-key');
  });

  it('webhookProvider.verifySignature always returns valid — secret check happens in the route shim', () => {
    const provider = createChariowProvider(env);
    expect(provider.webhookProvider.verifySignature(Buffer.from('{}'), {})).toEqual({
      valid: true,
    });
  });

  it('webhookProvider.extractIds recognizes settled.sale/successful.sale/completed.sale as paid', () => {
    const provider = createChariowProvider(env);
    for (const eventType of ['settled.sale', 'successful.sale', 'completed.sale']) {
      const ids = provider.webhookProvider.extractIds({
        event_type: eventType,
        data: { sale_id: 'sale_123' },
      });
      expect(ids).toEqual({ externalId: 'sale_123', eventType, kind: 'paid' });
    }
  });

  it('webhookProvider.extractIds maps unrecognized event types to "other"', () => {
    const provider = createChariowProvider(env);
    const ids = provider.webhookProvider.extractIds({
      event_type: 'sale.pending',
      data: { sale_id: 'sale_123' },
    });
    expect(ids.kind).toBe('other');
  });
});
