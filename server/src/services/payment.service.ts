import crypto from 'node:crypto';
import { env } from '../config/env.ts';
import type { IOrder } from '../modules/orders/order.model.ts';

export interface PaymentInitiationResult {
  initiated: boolean;
  provider: 'cod' | 'sslcommerz';
  transactionRef: string;
  gatewayUrl?: string;
  message?: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  transactionRef: string;
  providerValId?: string;
  bankTranId?: string;
  amount: number;
  storeAmount?: number;
  riskLevel?: number;
  channel?: string;
  rawSummary?: Record<string, unknown>;
  reason?: string;
}

export interface SslCommerzRefundResult {
  success: boolean;
  status: 'processed' | 'pending' | 'failed';
  providerStatus: string;
  refundRefId?: string;
  bankTranId?: string;
  errorReason?: string;
}

interface SslCommerzValidationPayload {
  status?: string;
  store_id?: string;
  tran_id?: string;
  val_id?: string;
  bank_tran_id?: string;
  amount?: string;
  store_amount?: string;
  currency?: string;
  card_type?: string;
  risk_level?: string | number;
}

interface SslCommerzRefundApiPayload {
  APIConnect?: string;
  bank_tran_id?: string;
  refund_ref_id?: string;
  status?: string;
  errorReason?: string;
}

export function getActiveSslCommerzCredentials() {
  return {
    sandbox: env.payment.sandbox,
    storeId: env.payment.storeId,
    storePassword: env.payment.storePassword,
    isConfigured: env.payment.isGatewayConfigured,
  };
}

export function getPaymentGatewayStatus(codEnabled = true) {
  const active = getActiveSslCommerzCredentials();
  return {
    provider: env.payment.provider,
    mode: active.sandbox ? ('sandbox' as const) : ('live' as const),
    sandbox: active.sandbox,
    codAvailable: codEnabled,
    codEnabled,
    gatewayConfigured: active.isConfigured,
    sslcommerzConfigured: active.isConfigured,
    webhookSecretConfigured: Boolean(env.payment.webhookSecret),
    reservationTtlMinutes: env.payment.reservationTtlMinutes,
    supportedMethods: active.isConfigured
      ? [
          ...(codEnabled ? ['Cash on Delivery (COD)'] : []),
          'Cards (VISA / Mastercard)',
          'bKash / Nagad / Rocket (via SSLCommerz)',
        ]
      : codEnabled
        ? ['Cash on Delivery (COD)']
        : [],
  };
}

function getValidatorApiBase(sandbox: boolean): string {
  return sandbox
    ? 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
    : 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';
}

function getRefundApiBase(sandbox: boolean): string {
  return sandbox
    ? 'https://sandbox.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php'
    : 'https://securepay.sslcommerz.com/validator/api/merchantTransIDvalidationAPI.php';
}

export async function initiateOrderPayment(order: IOrder): Promise<PaymentInitiationResult> {
  const transactionRef = `NVX-${order.orderNumber}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  if (order.paymentMethod === 'cod') {
    return {
      initiated: true,
      provider: 'cod',
      transactionRef,
      message: 'Cash on Delivery selected. Payment will be collected upon delivery.',
    };
  }

  const active = getActiveSslCommerzCredentials();
  if (!active.isConfigured) {
    throw Object.assign(
      new Error(
        'Online payment gateway (SSLCommerz) credentials are not configured for the active environment mode. Please choose Cash on Delivery or configure SSLCommerz store credentials.'
      ),
      { statusCode: 503, code: 'PAYMENT_GATEWAY_UNCONFIGURED' }
    );
  }

  const endpoint = active.sandbox
    ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
    : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

  const body = new URLSearchParams({
    store_id: active.storeId,
    store_passwd: active.storePassword,
    total_amount: String(order.totalAmount),
    currency: 'BDT',
    tran_id: transactionRef,
    success_url: `${env.appUrl}/api/payments/sslcommerz/success`,
    fail_url: `${env.appUrl}/api/payments/sslcommerz/fail`,
    cancel_url: `${env.appUrl}/api/payments/sslcommerz/cancel`,
    ipn_url: `${env.appUrl}/api/payments/sslcommerz/ipn`,
    shipping_method: order.deliveryMethod === 'express' ? 'YES' : 'NO',
    product_name: `NOVARA Order ${order.orderNumber}`,
    product_category: 'Retail',
    product_profile: 'general',
    cus_name: order.customerName,
    cus_email: order.customerEmail,
    cus_add1: order.shippingAddress.houseAddress,
    cus_city: order.shippingAddress.districtName,
    cus_state: order.shippingAddress.divisionName,
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    cus_phone: order.customerPhone,
    ship_name: order.shippingAddress.recipientName,
    ship_add1: order.shippingAddress.houseAddress,
    ship_city: order.shippingAddress.districtName,
    ship_country: 'Bangladesh',
  });

  if (order.paymentChannel === 'bkash') {
    body.set('multi_card_name', 'bkash');
  } else if (order.paymentChannel === 'nagad') {
    body.set('multi_card_name', 'nagad');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const rawText = await response.text();
  let payload: {
    status?: string;
    GatewayPageURL?: string;
    failedreason?: string;
  } | null = null;
  try {
    payload = JSON.parse(rawText) as {
      status?: string;
      GatewayPageURL?: string;
      failedreason?: string;
    };
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || payload.status !== 'SUCCESS' || !payload.GatewayPageURL) {
    throw Object.assign(
      new Error(payload?.failedreason || 'Unable to initialize SSLCommerz payment session.'),
      { statusCode: 502, code: payload ? 'PAYMENT_INIT_FAILED' : 'PAYMENT_GATEWAY_INVALID_RESPONSE' }
    );
  }

  return {
    initiated: true,
    provider: 'sslcommerz',
    transactionRef,
    gatewayUrl: payload.GatewayPageURL,
  };
}

export async function verifySslCommerzCallback(params: {
  valId?: string;
  tranId?: string;
  expectedAmount: number;
}): Promise<PaymentVerificationResult> {
  const active = getActiveSslCommerzCredentials();
  if (!active.isConfigured) {
    return {
      verified: false,
      transactionRef: params.tranId || '',
      amount: 0,
      reason: 'Payment gateway credentials not configured.',
    };
  }
  if (!params.valId || !params.tranId) {
    return {
      verified: false,
      transactionRef: params.tranId || '',
      amount: 0,
      reason: 'Missing val_id or tran_id from payment callback.',
    };
  }

  const url = new URL(getValidatorApiBase(active.sandbox));
  url.searchParams.set('val_id', params.valId);
  url.searchParams.set('store_id', active.storeId);
  url.searchParams.set('store_passwd', active.storePassword);
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString());
  const rawValidationText = await res.text();
  let data: SslCommerzValidationPayload | null = null;
  try {
    data = JSON.parse(rawValidationText) as SslCommerzValidationPayload;
  } catch {
    data = null;
  }

  if (!res.ok || !data) {
    return {
      verified: false,
      transactionRef: params.tranId,
      providerValId: params.valId,
      amount: 0,
      reason: 'Payment gateway returned an invalid verification response.',
    };
  }

  const paidAmount = Number(data.amount || 0);
  const storeAmount = Number(data.store_amount || 0);
  const riskLevel = data.risk_level !== undefined ? Number(data.risk_level) : undefined;
  const statusValid = data.status === 'VALID' || data.status === 'VALIDATED';
  const tranValid = data.tran_id === params.tranId;
  const storeValid = !data.store_id || data.store_id === active.storeId;
  const amountValid = Math.abs(paidAmount - params.expectedAmount) < 0.01 && data.currency === 'BDT';

  if (!statusValid || !tranValid || !storeValid || !amountValid) {
    return {
      verified: false,
      transactionRef: params.tranId,
      providerValId: params.valId,
      amount: paidAmount,
      reason: 'Gateway validation mismatch on status, store, transaction ID, or BDT amount.',
      rawSummary: {
        status: data.status,
        store_id: data.store_id,
        amount: data.amount,
        currency: data.currency,
      },
    };
  }

  return {
    verified: true,
    transactionRef: params.tranId,
    providerValId: data.val_id || params.valId,
    bankTranId: data.bank_tran_id || undefined,
    amount: paidAmount,
    storeAmount: Number.isFinite(storeAmount) ? storeAmount : undefined,
    riskLevel: riskLevel !== undefined && Number.isFinite(riskLevel) ? riskLevel : undefined,
    channel: data.card_type || 'SSLCommerz',
    rawSummary: {
      status: data.status,
      card_type: data.card_type,
      amount: data.amount,
      store_amount: data.store_amount,
      bank_tran_id: data.bank_tran_id,
      risk_level: data.risk_level,
      val_id: data.val_id || params.valId,
    },
  };
}

export async function initiateSslCommerzRefund(params: {
  bankTranId: string;
  refundAmount: number;
  refundRemarks: string;
  refId: string;
}): Promise<SslCommerzRefundResult> {
  const active = getActiveSslCommerzCredentials();
  if (!active.isConfigured) {
    return {
      success: false,
      status: 'failed',
      providerStatus: 'UNCONFIGURED',
      bankTranId: params.bankTranId,
      errorReason: 'SSLCommerz credentials are not configured on the server.',
    };
  }

  const url = new URL(getRefundApiBase(active.sandbox));
  url.searchParams.set('bank_tran_id', params.bankTranId);
  url.searchParams.set('refund_amount', params.refundAmount.toFixed(2));
  url.searchParams.set('refund_remarks', params.refundRemarks.slice(0, 200));
  url.searchParams.set('refe_id', params.refId);
  url.searchParams.set('store_id', active.storeId);
  url.searchParams.set('store_passwd', active.storePassword);
  url.searchParams.set('v', '1');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString());
  const rawText = await res.text();
  let data: SslCommerzRefundApiPayload | null = null;
  try {
    data = JSON.parse(rawText) as SslCommerzRefundApiPayload;
  } catch {
    data = null;
  }

  if (!res.ok || !data || data.APIConnect !== 'DONE') {
    return {
      success: false,
      status: 'failed',
      providerStatus: data?.status || 'API_ERROR',
      bankTranId: params.bankTranId,
      errorReason: data?.errorReason || 'SSLCommerz refund API request failed.',
    };
  }

  const normalized = String(data.status || '').toLowerCase();
  if (normalized === 'success') {
    return {
      success: true,
      status: 'processed',
      providerStatus: data.status || 'success',
      refundRefId: data.refund_ref_id,
      bankTranId: data.bank_tran_id || params.bankTranId,
    };
  }
  if (normalized === 'processing') {
    return {
      success: true,
      status: 'pending',
      providerStatus: data.status || 'processing',
      refundRefId: data.refund_ref_id,
      bankTranId: data.bank_tran_id || params.bankTranId,
    };
  }

  return {
    success: false,
    status: 'failed',
    providerStatus: data.status || 'failed',
    refundRefId: data.refund_ref_id,
    bankTranId: data.bank_tran_id || params.bankTranId,
    errorReason: data.errorReason || 'SSLCommerz rejected the refund request.',
  };
}

export async function querySslCommerzRefundStatus(refundRefId: string): Promise<SslCommerzRefundResult> {
  const active = getActiveSslCommerzCredentials();
  if (!active.isConfigured) {
    return {
      success: false,
      status: 'failed',
      providerStatus: 'UNCONFIGURED',
      refundRefId,
      errorReason: 'SSLCommerz credentials are not configured on the server.',
    };
  }

  const url = new URL(getRefundApiBase(active.sandbox));
  url.searchParams.set('refund_ref_id', refundRefId);
  url.searchParams.set('store_id', active.storeId);
  url.searchParams.set('store_passwd', active.storePassword);
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString());
  const rawText = await res.text();
  let data: SslCommerzRefundApiPayload | null = null;
  try {
    data = JSON.parse(rawText) as SslCommerzRefundApiPayload;
  } catch {
    data = null;
  }

  if (!res.ok || !data || data.APIConnect !== 'DONE') {
    return {
      success: false,
      status: 'failed',
      providerStatus: data?.status || 'API_ERROR',
      refundRefId,
      errorReason: data?.errorReason || 'Unable to query SSLCommerz refund status.',
    };
  }

  const normalized = String(data.status || '').toLowerCase();
  if (normalized === 'refunded' || normalized === 'success') {
    return {
      success: true,
      status: 'processed',
      providerStatus: data.status || 'refunded',
      refundRefId: data.refund_ref_id || refundRefId,
      bankTranId: data.bank_tran_id,
    };
  }
  if (normalized === 'processing' || normalized === 'initiated') {
    return {
      success: true,
      status: 'pending',
      providerStatus: data.status || 'processing',
      refundRefId: data.refund_ref_id || refundRefId,
      bankTranId: data.bank_tran_id,
    };
  }

  return {
    success: false,
    status: 'failed',
    providerStatus: data.status || 'cancelled',
    refundRefId: data.refund_ref_id || refundRefId,
    bankTranId: data.bank_tran_id,
    errorReason: data.errorReason || `Gateway refund reported status: ${data.status || 'unknown'}`,
  };
}

export function verifySslCommerzIpnSignature(
  payload: Record<string, unknown>,
  storePassword: string
): boolean {
  const verifySign = typeof payload.verify_sign === 'string' ? payload.verify_sign.trim() : '';
  const verifyKeyRaw = typeof payload.verify_key === 'string' ? payload.verify_key.trim() : '';
  if (!verifySign || !verifyKeyRaw || !storePassword) {
    return false;
  }

  const keys = verifyKeyRaw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  if (keys.length === 0) return false;

  const storePasswdMd5 = crypto.createHash('md5').update(storePassword).digest('hex');
  const map: Record<string, string> = { store_passwd: storePasswdMd5 };
  for (const key of keys) {
    if (key === 'store_passwd') continue;
    const rawVal = payload[key];
    map[key] = rawVal === undefined || rawVal === null ? '' : String(rawVal);
  }

  const sortedQuery = Object.keys(map)
    .sort()
    .map((k) => `${k}=${map[k]}`)
    .join('&');
  const expectedHash = crypto.createHash('md5').update(sortedQuery).digest('hex');

  return (
    expectedHash.length === verifySign.length &&
    crypto.timingSafeEqual(Buffer.from(expectedHash.toLowerCase()), Buffer.from(verifySign.toLowerCase()))
  );
}
