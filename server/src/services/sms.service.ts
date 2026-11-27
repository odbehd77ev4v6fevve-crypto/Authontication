import { env } from '../config/env.ts';
import { SmsDeliveryRecordModel, type ISmsDeliveryRecord } from '../modules/users/user.model.ts';

export async function sendTransactionalSms(params: {
  userId?: string;
  phone: string;
  purpose: ISmsDeliveryRecord['purpose'];
  message: string;
}): Promise<{ delivered: boolean; status: ISmsDeliveryRecord['status']; errorMessage?: string }> {
  if (!env.sms.isConfigured) {
    try {
      await SmsDeliveryRecordModel.create({
        userId: params.userId || undefined,
        phone: params.phone,
        purpose: params.purpose,
        status: 'skipped_unconfigured',
        errorMessage: 'SMS gateway environment variables (SMS_API_URL, SMS_API_KEY) are not configured.',
        attempts: 0,
      });
    } catch {
      // Avoid masking the unconfigured response if audit logging fails
    }
    return {
      delivered: false,
      status: 'skipped_unconfigured',
      errorMessage: 'SMS gateway is not configured in this environment.',
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(env.sms.apiUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.sms.apiKey}`,
      },
      body: JSON.stringify({
        provider: env.sms.provider || 'generic_http',
        senderId: env.sms.senderId,
        to: params.phone,
        message: params.message,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      messageId?: string;
      error?: string;
      message?: string;
    };

    if (!response.ok) {
      const errMsg = data.error || data.message || `SMS gateway HTTP ${response.status}`;
      await SmsDeliveryRecordModel.create({
        userId: params.userId || undefined,
        phone: params.phone,
        purpose: params.purpose,
        status: 'failed',
        errorMessage: errMsg,
        attempts: 1,
      });
      return { delivered: false, status: 'failed', errorMessage: errMsg };
    }

    await SmsDeliveryRecordModel.create({
      userId: params.userId || undefined,
      phone: params.phone,
      purpose: params.purpose,
      status: 'sent',
      providerMessageId: data.id || data.messageId || undefined,
      attempts: 1,
    });

    return { delivered: true, status: 'sent' };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'SMS gateway network error';
    try {
      await SmsDeliveryRecordModel.create({
        userId: params.userId || undefined,
        phone: params.phone,
        purpose: params.purpose,
        status: 'failed',
        errorMessage: errMsg,
        attempts: 1,
      });
    } catch {
      // No-op
    }
    return { delivered: false, status: 'failed', errorMessage: errMsg };
  } finally {
    clearTimeout(timeout);
  }
}
