import { Resend } from 'resend';
import { env } from '../config/env.ts';
import { StoreSettingsModel } from '../modules/cms/cms.model.ts';
import { NotificationRecordModel, type INotificationRecord } from '../modules/users/user.model.ts';

const resendClient = env.resend.isConfigured ? new Resend(env.resend.apiKey) : null;

export async function sendTransactionalEmail(params: {
  userId?: string;
  email: string;
  type: INotificationRecord['type'];
  subject: string;
  html: string;
}): Promise<{ delivered: boolean; status: INotificationRecord['status'] }> {
  let settings: {
    emailSettings?: {
      senderName?: string;
      senderEmail?: string;
      replyToEmail?: string;
      orderConfirmationEnabled?: boolean;
      shipmentUpdateEnabled?: boolean;
      lowStockAlertEnabled?: boolean;
    };
    notificationSettings?: {
      customerOrderUpdates?: boolean;
    };
  } | null = null;
  try {
    settings = await StoreSettingsModel.findOne({ key: 'primary' })
      .select('emailSettings notificationSettings')
      .lean();
  } catch {
    settings = null;
  }

  const emailCfg = settings?.emailSettings;
  const notifCfg = settings?.notificationSettings;
  const disabledBySettings =
    (params.type === 'order_confirmation' &&
      (emailCfg?.orderConfirmationEnabled === false || notifCfg?.customerOrderUpdates === false)) ||
    (params.type === 'shipment_update' &&
      (emailCfg?.shipmentUpdateEnabled === false || notifCfg?.customerOrderUpdates === false));

  if (disabledBySettings) {
    await NotificationRecordModel.create({
      userId: params.userId || undefined,
      email: params.email,
      type: params.type,
      subject: params.subject,
      status: 'skipped_unconfigured',
      errorMessage: 'Disabled in Store Notification / Email Settings.',
      attempts: 0,
    });
    return { delivered: false, status: 'skipped_unconfigured' };
  }

  if (!resendClient) {
    await NotificationRecordModel.create({
      userId: params.userId || undefined,
      email: params.email,
      type: params.type,
      subject: params.subject,
      status: 'skipped_unconfigured',
      errorMessage: 'RESEND_API_KEY is not configured.',
      attempts: 0,
    });
    return { delivered: false, status: 'skipped_unconfigured' };
  }

  const senderEmail = emailCfg?.senderEmail?.trim() || env.resend.emailFrom;
  const senderName = emailCfg?.senderName?.trim();
  const formattedFrom =
    senderName && !senderEmail.includes('<') ? `${senderName} <${senderEmail}>` : senderEmail;
  const replyTo = emailCfg?.replyToEmail?.trim() || undefined;

  let lastError: string | undefined;
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await resendClient.emails.send({
        from: formattedFrom,
        to: params.email,
        replyTo,
        subject: params.subject,
        html: params.html,
      });

      if (response.error) {
        lastError = response.error.message;
        continue;
      }

      await NotificationRecordModel.create({
        userId: params.userId || undefined,
        email: params.email,
        type: params.type,
        subject: params.subject,
        status: 'sent',
        providerMessageId: response.data?.id,
        attempts: attempt,
      });
      return { delivered: true, status: 'sent' };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown email dispatch error';
    }
  }

  await NotificationRecordModel.create({
    userId: params.userId || undefined,
    email: params.email,
    type: params.type,
    subject: params.subject,
    status: 'failed',
    errorMessage: lastError || 'Failed after retries',
    attempts: maxAttempts,
  });

  return { delivered: false, status: 'failed' };
}
