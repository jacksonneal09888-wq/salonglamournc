import crypto from 'node:crypto';
import twilio from 'twilio';
import { readJsonFile, writeJsonFile } from '../../utils/jsonStore.js';

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  SMS_FROM_NUMBER
} = process.env;

let twilioClient = null;
if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
  twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

const SMS_LOG_FILE = 'sms-log.json';

export function ensureSmsConfigured() {
  if (!twilioClient || !SMS_FROM_NUMBER) {
    throw new Error('Twilio credentials are missing. Configure TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and SMS_FROM_NUMBER.');
  }
}

export async function sendSmsBroadcast({ contacts, message, campaign }) {
  ensureSmsConfigured();
  if (!contacts.length) {
    return { broadcastId: null, results: [] };
  }
  const broadcastId = crypto.randomUUID();
  const results = [];
  for (const contact of contacts) {
    if (!contact.phone) continue;
    const personalizedMessage = message.replace(/\{\{(\w+)\}\}/g, (_, token) => {
      if (token === 'name' && contact.name) return contact.name;
      if (token === 'firstName' && contact.name) return contact.name.split(' ')[0];
      return '';
    });
    try {
      const response = await twilioClient.messages.create({
        from: SMS_FROM_NUMBER,
        to: contact.phone,
        body: personalizedMessage
      });
      results.push({
        contactId: contact.id,
        phone: contact.phone,
        status: 'queued',
        sid: response.sid
      });
      await appendSmsLog({
        broadcastId,
        contactId: contact.id,
        phone: contact.phone,
        sid: response.sid,
        status: 'queued',
        campaign,
        message: personalizedMessage
      });
    } catch (error) {
      results.push({
        contactId: contact.id,
        phone: contact.phone,
        status: 'error',
        error: error.message
      });
      await appendSmsLog({
        broadcastId,
        contactId: contact.id,
        phone: contact.phone,
        status: 'failed',
        campaign,
        message: personalizedMessage,
        error: error.message
      });
    }
  }
  return { broadcastId, results };
}

async function appendSmsLog(entry) {
  const log = await readJsonFile(SMS_LOG_FILE, { entries: [] });
  log.entries.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry
  });
  await writeJsonFile(SMS_LOG_FILE, log);
}
