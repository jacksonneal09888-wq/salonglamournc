import crypto from 'node:crypto';
import sgMail from '@sendgrid/mail';
import { buildBrandedTemplate, buildTextVersion } from './templateBuilder.js';
import { getBrandConfig } from '../brand.js';

const {
  SENDGRID_API_KEY,
  DEFAULT_FROM_EMAIL = 'no-reply@salonglamournc.com'
} = process.env;

let sendgridReady = false;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  sendgridReady = true;
}

export function ensureEmailProviderConfigured() {
  if (!sendgridReady) {
    throw new Error('SendGrid API key is missing. Set SENDGRID_API_KEY in the environment.');
  }
}

export async function sendBrandedEmail(options) {
  ensureEmailProviderConfigured();
  const message = buildMessagePayload(options);
  const result = await deliverMessage(message);
  return { messageId: result.messageId, options };
}

export function buildMessagePayload(options) {
  const brand = getBrandConfig();
  const recipients = Array.isArray(options.to) ? options.to : [options.to];
  const tags = Array.isArray(options.tags) ? options.tags.filter(Boolean) : [];
  const metadata = options.metadata ?? {};
  const cta = options.cta?.label && options.cta?.url ? options.cta : undefined;
  const { html, previewText } = buildBrandedTemplate({
    title: options.title ?? brand.name,
    body: options.body,
    cta,
    previewText: options.previewText,
    highlight: options.highlight
  });
  const text = buildTextVersion({
    title: options.title ?? brand.name,
    body: options.body,
    cta
  });

  return {
    to: recipients,
    from: {
      email: options.from ?? DEFAULT_FROM_EMAIL,
      name: options.fromName ?? brand.name
    },
    subject: options.subject ?? `A note from ${brand.name}`,
    html,
    text,
    previewText,
    categories: tags.slice(0, 3),
    customArgs: {
      ...metadata,
      campaign: options.campaign ?? undefined
    },
    sendAt: options.sendAt ? Math.floor(new Date(options.sendAt).getTime() / 1000) : undefined
  };
}

async function deliverMessage(message) {
  const payload = {
    to: message.to.length === 1 ? message.to[0] : message.to,
    from: message.from,
    subject: message.subject,
    html: message.html,
    text: message.text,
    categories: message.categories,
    customArgs: message.customArgs,
    trackingSettings: {
      clickTracking: { enable: true, enableText: false }
    }
  };
  if (message.sendAt) {
    payload.sendAt = message.sendAt;
  }
  const [response] = await sgMail.send(payload, Array.isArray(message.to) && message.to.length > 1);
  const messageId = response.headers?.['x-message-id'] ?? crypto.randomUUID();
  return { messageId, status: response.statusCode };
}
