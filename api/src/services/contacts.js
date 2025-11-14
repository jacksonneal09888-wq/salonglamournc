import { readJsonFile, writeJsonFile } from '../utils/jsonStore.js';

const CONTACTS_FILE = 'contacts.json';

export async function getContacts() {
  return readJsonFile(CONTACTS_FILE, []);
}

export async function saveContacts(contacts) {
  return writeJsonFile(CONTACTS_FILE, contacts);
}

export async function resolveSegment(segment = {}, { requireEmail = false, requirePhone = false } = {}) {
  const contacts = await getContacts();
  return contacts.filter(contact => matchesSegment(contact, segment, { requireEmail, requirePhone }));
}

export async function findContactById(id) {
  if (!id) return null;
  const contacts = await getContacts();
  return contacts.find(contact => contact.id === id) ?? null;
}

export async function upsertContact(partial = {}) {
  const contacts = await getContacts();
  const normalizedEmail = normalizeEmail(partial.email);
  const normalizedPhone = normalizePhone(partial.phone);
  let contact =
    (partial.id && contacts.find(entry => entry.id === partial.id)) ||
    (normalizedEmail && contacts.find(entry => normalizeEmail(entry.email) === normalizedEmail)) ||
    (normalizedPhone && contacts.find(entry => normalizePhone(entry.phone) === normalizedPhone));

  if (!contact) {
    contact = {
      id: partial.id ?? `contact_${Date.now()}`,
      name: '',
      email: '',
      phone: '',
      tags: [],
      marketingOptIn: true
    };
    contacts.push(contact);
  }

  contact.name = partial.name ?? contact.name;
  contact.email = partial.email ?? contact.email;
  contact.phone = partial.phone ?? contact.phone;
  contact.marketingOptIn =
    partial.marketingOptIn !== undefined ? partial.marketingOptIn : contact.marketingOptIn;
  if (Array.isArray(partial.tags)) {
    const existing = new Set(contact.tags ?? []);
    for (const tag of partial.tags) {
      if (tag) existing.add(tag);
    }
    contact.tags = Array.from(existing);
  }

  await saveContacts(contacts);
  return contact;
}

function matchesSegment(contact, segment, options) {
  if (!contact) return false;
  if (options.requireEmail && !contact.email) return false;
  if (options.requirePhone && !contact.phone) return false;

  if (segment.ids?.length && !segment.ids.includes(contact.id)) {
    return false;
  }

  if (segment.marketingOptInOnly !== false && contact.marketingOptIn === false) {
    return false;
  }

  if (segment.newClientsOnly && !contact.tags?.includes('new-client')) {
    return false;
  }

  if (segment.tags?.length) {
    const tagMatchMode = segment.tagMatch === 'all' ? 'all' : 'any';
    const contactTags = new Set(contact.tags ?? []);
    if (tagMatchMode === 'all') {
      const allPresent = segment.tags.every(tag => contactTags.has(tag));
      if (!allPresent) return false;
    } else {
      const anyPresent = segment.tags.some(tag => contactTags.has(tag));
      if (!anyPresent) return false;
    }
  }

  return true;
}

export function buildMergeFields(contact = {}, extra = {}) {
  const name = contact.name ?? '';
  const firstName = name.split(' ')[0] ?? '';
  return {
    name,
    firstName,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    ...extra
  };
}

function normalizePhone(value) {
  return value ? value.replace(/\D/g, '') : '';
}

function normalizeEmail(value) {
  return value ? value.trim().toLowerCase() : '';
}
