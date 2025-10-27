const defaultConfig = {
  squareBookingEndpoint: '',
  squareAvailabilityEndpoint: '',
  googleCalendarEndpoint: '',
  timeZone: 'America/New_York',
  embedUrl: '',
  useMockAvailability: true
};

const config = {
  ...defaultConfig,
  ...(window.__BOOKING_CONFIG || {})
};

const services = [
  {
    id: 'cut_fade',
    name: 'Skin Fade + Finish',
    category: 'Cuts & Barbering',
    duration: 45,
    price: 45,
    squareCatalogObjectId: 'CUT_FADE_SKIN'
  },
  {
    id: 'creative_color',
    name: 'Creative Color Session',
    category: 'Color & Blonding',
    duration: 120,
    price: 210,
    squareCatalogObjectId: 'COLOR_SESSION'
  },
  {
    id: 'luxe_blowout',
    name: 'Luxe Blowout + Style',
    category: 'Styling',
    duration: 60,
    price: 70,
    squareCatalogObjectId: 'LUXE_BLOWOUT'
  },
  {
    id: 'brow_lash_combo',
    name: 'Brow + Lash Combo',
    category: 'Brows & Lashes',
    duration: 40,
    price: 65,
    squareCatalogObjectId: 'BROW_LASH'
  }
];

const stylists = [
  {
    id: 'cecii',
    name: 'Cecii',
    specialties: 'Color / Barbering',
    calendarEmail: 'cecii@salonglamournc.com',
    squareStaffId: 'STAFF_CECII'
  },
  {
    id: 'maria',
    name: 'Maria',
    specialties: 'Blonding / Extensions',
    calendarEmail: 'maria@salonglamournc.com',
    squareStaffId: 'STAFF_MARIA'
  },
  {
    id: 'bella',
    name: 'Bella',
    specialties: 'Brows / Lashes',
    calendarEmail: 'bella@salonglamournc.com',
    squareStaffId: 'STAFF_BELLA'
  },
  {
    id: 'lina',
    name: 'Lina',
    specialties: 'Cuts / Styling',
    calendarEmail: 'lina@salonglamournc.com',
    squareStaffId: 'STAFF_LINA'
  }
];

const servicesById = new Map(services.map(service => [service.id, service]));
const stylistsById = new Map(stylists.map(stylist => [stylist.id, stylist]));

const selectors = {
  bookingForm: document.getElementById('bookingForm'),
  serviceList: document.getElementById('serviceList'),
  stylistList: document.getElementById('stylistList'),
  rotationPreview: document.getElementById('rotationPreview'),
  nextStylistLabel: document.querySelector('[data-next-stylist]'),
  nextStylistBtn: document.getElementById('nextStylistBtn'),
  dateInput: document.getElementById('dateInput'),
  timeSelect: document.getElementById('timeSelect'),
  refreshSlotsBtn: document.getElementById('refreshSlots'),
  availabilityStatus: document.getElementById('availabilityStatus'),
  clientName: document.getElementById('clientName'),
  clientPhone: document.getElementById('clientPhone'),
  clientEmail: document.getElementById('clientEmail'),
  notesInput: document.getElementById('notesInput'),
  demoBookingBtn: document.getElementById('demoBooking'),
  submitButton: document.querySelector('[data-submit-button]'),
  summaryFields: {
    service: document.querySelector('[data-summary="service"]'),
    time: document.querySelector('[data-summary="time"]'),
    stylist: document.querySelector('[data-summary="stylist"]'),
    client: document.querySelector('[data-summary="client"]'),
    notes: document.querySelector('[data-summary="notes"]')
  },
  squarePayload: document.getElementById('squarePayload'),
  googlePayload: document.getElementById('googlePayload'),
  activityLog: document.getElementById('activityLog')
};

const integrationNames = {
  square: 'Square',
  google: 'Google Calendar',
  embed: 'Embed'
};

const state = {
  serviceId: services[0]?.id || null,
  date: '',
  time: '',
  stylistMode: 'roundRobin',
  stylistId: null,
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  notes: ''
};

const roundRobin = createRoundRobin(stylists);
let summaryInitialized = false;

function bootstrap() {
  renderServiceCards();
  renderStylists();
  setDefaultDate();
  attachListeners();
  updateRotationPreview();
  updateIntegrationStatus(
    'square',
    config.squareBookingEndpoint ? `POST ${config.squareBookingEndpoint}` : 'Not configured',
    config.squareBookingEndpoint ? 'ready' : 'idle'
  );
  updateIntegrationStatus(
    'google',
    config.googleCalendarEndpoint ? `POST ${config.googleCalendarEndpoint}` : 'Not configured',
    config.googleCalendarEndpoint ? 'ready' : 'idle'
  );
  updateIntegrationStatus(
    'embed',
    config.embedUrl || 'Add link to nav',
    config.embedUrl ? 'ready' : 'idle'
  );
  updateSummary();
  loadAvailability();
  logAction('Sandbox ready. Connect APIs when you are set.');
}

function attachListeners() {
  selectors.serviceList.addEventListener('change', event => {
    if (event.target.name === 'serviceId') {
      state.serviceId = event.target.value;
      loadAvailability();
      updateSummary();
    }
  });

  selectors.dateInput.addEventListener('change', () => {
    state.date = selectors.dateInput.value;
    loadAvailability();
    updateSummary();
  });

  selectors.timeSelect.addEventListener('change', () => {
    state.time = selectors.timeSelect.value;
    updateSummary();
  });

  selectors.refreshSlotsBtn.addEventListener('click', () => {
    loadAvailability(true);
  });

  document.querySelectorAll('input[name="stylistMode"]').forEach(radio => {
    radio.addEventListener('change', event => {
      state.stylistMode = event.target.value;
      const manual = state.stylistMode === 'manual';
      selectors.stylistList.classList.toggle('hidden', !manual);
      selectors.rotationPreview.classList.toggle('hidden', manual);
      updateSummary();
    });
  });

  selectors.stylistList.addEventListener('change', event => {
    if (event.target.name === 'stylistId') {
      state.stylistId = event.target.value;
      updateSummary();
    }
  });

  selectors.clientName.addEventListener('input', () => {
    state.clientName = selectors.clientName.value.trim();
    updateSummary();
  });

  selectors.clientPhone.addEventListener('input', () => {
    state.clientPhone = selectors.clientPhone.value.trim();
    updateSummary();
  });

  selectors.clientEmail.addEventListener('input', () => {
    state.clientEmail = selectors.clientEmail.value.trim();
    updateSummary();
  });

  selectors.notesInput.addEventListener('input', () => {
    state.notes = selectors.notesInput.value.trim();
    updateSummary();
  });

  selectors.nextStylistBtn.addEventListener('click', () => {
    const skipped = roundRobin.skip();
    updateRotationPreview();
    updateSummary();
    if (skipped) {
      logAction(`Rotation advanced past ${skipped.name}.`, 'warning');
    }
  });

  selectors.demoBookingBtn.addEventListener('click', () => {
    fillDemoBooking();
  });

  selectors.bookingForm.addEventListener('submit', async event => {
    event.preventDefault();
    await handleSubmit();
  });

  document.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', () => copyPayload(button.dataset.copy));
  });
}

function renderServiceCards() {
  selectors.serviceList.innerHTML = '';
  services.forEach((service, index) => {
    const label = document.createElement('label');
    label.className = 'service-card';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'serviceId';
    input.value = service.id;
    input.checked = state.serviceId ? state.serviceId === service.id : index === 0;
    if (input.checked) {
      state.serviceId = service.id;
    }

    const name = document.createElement('strong');
    name.textContent = service.name;
    const meta = document.createElement('small');
    meta.textContent = `${service.category} / ${service.duration} min`;
    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = formatCurrency(service.price);

    label.appendChild(input);
    label.appendChild(name);
    label.appendChild(meta);
    label.appendChild(price);
    selectors.serviceList.appendChild(label);
  });
}

function renderStylists() {
  selectors.stylistList.innerHTML = '';
  stylists.forEach(stylist => {
    const label = document.createElement('label');
    label.className = 'stylist-card';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'stylistId';
    input.value = stylist.id;
    const metaWrapper = document.createElement('span');
    metaWrapper.className = 'stylist-meta';
    const strong = document.createElement('strong');
    strong.textContent = stylist.name;
    const small = document.createElement('small');
    small.textContent = stylist.specialties;
    metaWrapper.appendChild(strong);
    metaWrapper.appendChild(small);
    label.appendChild(input);
    label.appendChild(metaWrapper);
    selectors.stylistList.appendChild(label);
  });
}

function setDefaultDate() {
  const today = new Date();
  const iso = today.toISOString().split('T')[0];
  selectors.dateInput.value = iso;
  selectors.dateInput.min = iso;
  state.date = iso;
}

async function loadAvailability(forceMock = false) {
  if (!state.serviceId || !state.date) return;
  const service = servicesById.get(state.serviceId);
  if (!service) return;
  setAvailabilityStatus('Fetching availability...');
  selectors.timeSelect.disabled = true;
  selectors.timeSelect.innerHTML = '<option>Loading...</option>';
  try {
    const availability = await SquareAvailability.fetch({
      service,
      date: state.date,
      stylists,
      forceMock: forceMock || config.useMockAvailability
    });
    populateSlots(availability?.slots || []);
    setAvailabilityStatus(
      availability?.source === 'square'
        ? `Live data from Square - refreshed ${timeStamp()}`
        : `Mock data for testing - refreshed ${timeStamp()}`
    );
  } catch (error) {
    console.error(error);
    setAvailabilityStatus('Unable to load availability, showing mock data.', true);
    const mock = await SquareAvailability.fetch(state.serviceId, state.date, true);
    populateSlots(mock?.slots || []);
  } finally {
    selectors.timeSelect.disabled = false;
  }
}

function populateSlots(slots) {
  selectors.timeSelect.innerHTML = '';
  if (!slots.length) {
    selectors.timeSelect.appendChild(new Option('No open slots', '', true, false));
    state.time = '';
    updateSummary();
    return;
  }
  selectors.timeSelect.appendChild(new Option('Select a slot', '', true, false));
  slots.forEach(slot => {
    const option = new Option(
      `${slot.label}${slot.status === 'held' ? ' - held' : ''}`,
      slot.start,
      false,
      false
    );
    option.disabled = slot.status !== 'open';
    selectors.timeSelect.appendChild(option);
  });
  const firstOpen = Array.from(selectors.timeSelect.options).find(opt => opt.value && !opt.disabled);
  if (firstOpen && !state.time) {
    firstOpen.selected = true;
    state.time = firstOpen.value;
  } else if (state.time) {
    const matching = Array.from(selectors.timeSelect.options).find(opt => opt.value === state.time && !opt.disabled);
    if (!matching) {
      state.time = '';
    }
  }
  updateSummary();
}

function updateRotationPreview() {
  if (!selectors.nextStylistLabel) return;
  const next = roundRobin.peek();
  selectors.nextStylistLabel.textContent = next?.stylist
    ? `${next.stylist.name} - ${next.stylist.specialties}`
    : 'Add stylists to the roster';
}

function updateSummary() {
  const service = servicesById.get(state.serviceId);
  selectors.summaryFields.service.textContent = service
    ? `${service.name} - ${service.duration} min - ${formatCurrency(service.price)}`
    : 'Select a service';

  selectors.summaryFields.time.textContent =
    state.date && state.time ? `${formatHumanDate(state.date)} at ${formatTime(state.time)}` : 'Choose a date + slot';

  let stylistText = 'Round robin pending roster';
  if (state.stylistMode === 'roundRobin') {
    const next = roundRobin.peek();
    stylistText = next?.stylist ? `Round robin (next: ${next.stylist.name})` : 'Add stylists to roster';
  } else if (state.stylistMode === 'manual') {
    stylistText = state.stylistId ? `Stylist: ${stylistsById.get(state.stylistId)?.name || ''}` : 'Select a stylist';
  }
  selectors.summaryFields.stylist.textContent = stylistText;

  const clientBits = [state.clientName, state.clientPhone].filter(Boolean);
  selectors.summaryFields.client.textContent = clientBits.length ? clientBits.join(' / ') : 'Add guest details';

  selectors.summaryFields.notes.textContent = state.notes || 'Optional';

  if (!summaryInitialized) {
    selectors.activityLog.innerHTML = '';
    summaryInitialized = true;
  }
}

async function handleSubmit() {
  const service = servicesById.get(state.serviceId);
  if (!service) {
    logAction('Pick a service before previewing.', 'error');
    return;
  }
  if (!state.date || !state.time) {
    logAction('Select a date and time.', 'error');
    return;
  }
  if (!state.clientName || !state.clientPhone) {
    logAction('Guest name and phone are required.', 'error');
    return;
  }

  const start = combineDateTime(state.date, state.time);
  const end = new Date(start.getTime() + service.duration * 60000);
  const stylist =
    state.stylistMode === 'manual'
      ? stylistsById.get(state.stylistId || '')
      : roundRobin.assign();

  if (!stylist) {
    logAction('No stylist selected. Add team members first.', 'error');
    return;
  }

  const squarePayload = buildSquarePayload(service, stylist, start, end);
  const googlePayload = buildGooglePayload(service, stylist, start, end);
  const summaryText = `Booking for ${state.clientName} with ${stylist.name} on ${formatHumanDate(
    state.date
  )} at ${formatTime(state.time)}`;

  selectors.squarePayload.textContent = JSON.stringify(squarePayload, null, 2);
  selectors.googlePayload.textContent = JSON.stringify(googlePayload, null, 2);
  updateRotationPreview();
  updateSummary();

  const submissions = [];
  if (config.squareBookingEndpoint) {
    submissions.push(
      queueIntegration({
        key: 'square',
        url: config.squareBookingEndpoint,
        payload: squarePayload,
        pendingText: 'Sending to Square...',
        successText: result => {
          const bookingId = result?.booking?.id;
          return bookingId ? `Square booking ${bookingId}` : 'Square booking created';
        },
        onSuccess: result => {
          const bookingId = result?.booking?.id ?? 'pending';
          logAction(`Square booking confirmed (${bookingId}).`, 'success');
        }
      })
    );
  }

  if (config.googleCalendarEndpoint) {
    submissions.push(
      queueIntegration({
        key: 'google',
        url: config.googleCalendarEndpoint,
        payload: googlePayload,
        pendingText: 'Syncing Google Calendar...',
        successText: result => {
          const eventId = result?.event?.id ?? 'created';
          return `Google event ${eventId}`;
        },
        onSuccess: () => {
          logAction('Google Calendar event created.', 'success');
        }
      })
    );
  }

  if (!submissions.length) {
    logAction('Preview ready. Connect API endpoints to auto-book.', 'warning');
    return;
  }

  setFormBusy(true);
  try {
    const outcomes = await Promise.allSettled(submissions);
    const hasFailure = outcomes.some(result => result.status === 'rejected');
    if (hasFailure) {
      logAction('At least one integration failed. Review statuses above.', 'error');
    } else {
      logAction(`${summaryText} synced across systems.`, 'success');
    }
  } finally {
    setFormBusy(false);
  }
}

function buildSquarePayload(service, stylist, start, end) {
  const payload = {
    idempotency_key: createIdempotencyKey(),
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    customer_note: state.notes || '',
    customer_details: {
      given_name: state.clientName,
      email_address: state.clientEmail || undefined,
      phone_number: sanitizePhone(state.clientPhone)
    },
    appointment_segments: [
      {
        duration_minutes: service.duration,
        service_variation_id: service.squareCatalogObjectId,
        team_member_id: stylist.squareStaffId
      }
    ],
    metadata: {
      stylist_assignment: state.stylistMode,
      source: 'custom_booking_ui'
    }
  };
  if (config.squareLocationId) {
    payload.location_id = config.squareLocationId;
  }
  return payload;
}

function buildGooglePayload(service, stylist, start, end) {
  const attendees = [
    { email: stylist.calendarEmail, displayName: stylist.name }
  ];
  if (state.clientEmail) {
    attendees.push({ email: state.clientEmail, displayName: state.clientName });
  }
  return {
    summary: `${service.name} - ${state.clientName}`,
    description: [
      `Service: ${service.name}`,
      `Duration: ${service.duration} minutes`,
      `Guest phone: ${state.clientPhone}`,
      state.notes ? `Notes: ${state.notes}` : null
    ]
      .filter(Boolean)
      .join('\n'),
    start: {
      dateTime: start.toISOString(),
      timeZone: config.timeZone
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: config.timeZone
    },
    attendees,
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 24 * 60 },
        { method: 'popup', minutes: 60 }
      ]
    }
  };
}

function updateIntegrationStatus(key, text, stateClass = 'idle') {
  const row = document.querySelector(`[data-integration="${key}"]`);
  if (!row) return;
  const badge = row.querySelector('.status-badge');
  if (!badge) return;
  badge.textContent = text;
  badge.classList.remove('status-idle', 'status-ready', 'status-error');
  if (stateClass === 'ready') {
    badge.classList.add('status-ready');
  } else if (stateClass === 'error') {
    badge.classList.add('status-error');
  } else {
    badge.classList.add('status-idle');
  }
}

function logAction(message, tone = 'info') {
  if (!summaryInitialized) {
    selectors.activityLog.innerHTML = '';
    summaryInitialized = true;
  }
  const entry = document.createElement('li');
  entry.dataset.tone = tone;
  entry.textContent = `${timeStamp()} - ${message}`;
  selectors.activityLog.prepend(entry);
  while (selectors.activityLog.children.length > 6) {
    selectors.activityLog.removeChild(selectors.activityLog.lastChild);
  }
}

function setFormBusy(isBusy) {
  const button = selectors.submitButton;
  if (!button) return;
  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent;
  }
  button.disabled = isBusy;
  button.textContent = isBusy ? 'Syncing...' : button.dataset.defaultLabel;
}

function queueIntegration({ key, url, payload, pendingText, successText, onSuccess }) {
  updateIntegrationStatus(key, pendingText, 'ready');
  return sendJson(url, payload)
    .then(response => {
      const message = typeof successText === 'function' ? successText(response) : successText;
      if (message) {
        updateIntegrationStatus(key, message, 'ready');
      }
      if (typeof onSuccess === 'function') {
        onSuccess(response);
      }
      return response;
    })
    .catch(error => {
      updateIntegrationStatus(key, error.message || 'Request failed', 'error');
      const label = integrationNames[key] || key;
      logAction(`${label} error: ${error.message || 'Request failed'}`, 'error');
      throw error;
    });
}

async function sendJson(url, payload) {
  const endpoint = resolveEndpoint(url);
  if (!endpoint) {
    throw new Error('Endpoint missing');
  }
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || data?.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.response = data;
    throw error;
  }
  return response.json().catch(() => ({}));
}

async function copyPayload(target) {
  const map = {
    square: selectors.squarePayload,
    google: selectors.googlePayload
  };
  const node = map[target];
  if (!node) return;
  try {
    await navigator.clipboard.writeText(node.textContent);
    logAction(`Copied ${target} payload to clipboard.`, 'success');
  } catch (error) {
    console.warn(error);
    logAction('Clipboard unavailable in this browser.', 'error');
  }
}

async function fillDemoBooking() {
  const demoService = servicesById.get('creative_color') || services[0];
  const serviceRadio = selectors.serviceList.querySelector(`input[value="${demoService.id}"]`);
  if (serviceRadio) {
    serviceRadio.checked = true;
    state.serviceId = demoService.id;
  }
  const future = addDays(new Date(), 1);
  const iso = future.toISOString().split('T')[0];
  selectors.dateInput.value = iso;
  state.date = iso;
  selectors.clientName.value = 'Demo Guest';
  selectors.clientPhone.value = '(336) 555-7890';
  selectors.clientEmail.value = 'guest@example.com';
  selectors.notesInput.value = 'Loves vivid magenta + protective styles.';
  state.clientName = selectors.clientName.value;
  state.clientPhone = selectors.clientPhone.value;
  state.clientEmail = selectors.clientEmail.value;
  state.notes = selectors.notesInput.value;
  await loadAvailability(true);
  const firstOpen = Array.from(selectors.timeSelect.options).find(opt => opt.value && !opt.disabled);
  if (firstOpen) {
    firstOpen.selected = true;
    state.time = firstOpen.value;
  }
  updateSummary();
  logAction('Demo data applied. Submit to preview payloads.', 'success');
}

function setAvailabilityStatus(message, isError = false) {
  selectors.availabilityStatus.textContent = message;
  selectors.availabilityStatus.style.color = isError ? '#b91c1c' : '';
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}

function formatHumanDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function sanitizePhone(value) {
  return value.replace(/[^\d+]/g, '');
}

function resolveEndpoint(endpoint) {
  if (!endpoint) return '';
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const base = window.location.origin === 'null' ? 'http://localhost:8080' : window.location.origin;
  return new URL(endpoint, base).toString();
}

function combineDateTime(date, time) {
  return new Date(`${date}T${time}:00`);
}

function createIdempotencyKey() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `booking_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function timeStamp() {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date());
}

function createRoundRobin(roster) {
  const storageKey = 'sgnc_rr_pointer';
  let pointer = Number.parseInt(localStorage.getItem(storageKey) ?? '-1', 10);
  if (!Number.isInteger(pointer) || pointer >= roster.length) {
    pointer = -1;
  }

  const persist = () => localStorage.setItem(storageKey, pointer.toString());

  return {
    peek() {
      if (!roster.length) return null;
      const index = (pointer + 1) % roster.length;
      return { stylist: roster[index], index };
    },
    assign() {
      if (!roster.length) return null;
      pointer = (pointer + 1) % roster.length;
      persist();
      return roster[pointer];
    },
    skip() {
      if (!roster.length) return null;
      pointer = (pointer + 1) % roster.length;
      persist();
      return roster[pointer];
    }
  };
}

const SquareAvailability = (() => {
  async function fetchFromSquare({ service, date, stylists }) {
    if (!config.squareAvailabilityEndpoint) {
      throw new Error('No Square availability endpoint configured.');
    }
    const resolved = resolveEndpoint(config.squareAvailabilityEndpoint);
    if (!resolved) {
      throw new Error('No Square availability endpoint configured.');
    }
    const url = new URL(resolved);
    url.searchParams.set('serviceId', service.id);
    url.searchParams.set('date', date);
    url.searchParams.set('serviceVariationId', service.squareCatalogObjectId);
    url.searchParams.set('durationMinutes', String(service.duration));
    stylists
      .map(stylist => stylist.squareStaffId)
      .filter(Boolean)
      .forEach(id => url.searchParams.append('teamMemberIds', id));
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error('Square availability request failed.');
    }
    const payload = await response.json();
    payload.source = 'square';
    return payload;
  }

  async function fetchMock({ service, date }) {
    const payload = await MockSquare.getAvailability(service, date);
    payload.source = 'mock';
    return payload;
  }

  return {
    async fetch(params) {
      const useMock = params.forceMock ?? false;
      if (!useMock) {
        try {
          return await fetchFromSquare(params);
        } catch (error) {
          console.warn(error);
          logAction('Live availability failed, falling back to mock data.', 'warning');
        }
      }
      return fetchMock(params);
    }
  };
})();

bootstrap();

const MockSquare = (() => {
  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function generateSlots(service, date) {
    const duration = service?.duration || 60;
    const openMinutes = 9 * 60;
    const closeMinutes = 19 * 60;
    const slots = [];
    let iteration = 0;
    for (let minutes = openMinutes; minutes <= closeMinutes - duration; minutes += 30) {
      const hour = Math.floor(minutes / 60)
        .toString()
        .padStart(2, '0');
      const minute = (minutes % 60).toString().padStart(2, '0');
      const start = `${hour}:${minute}`;
      const status = (iteration + duration / 15 + (service?.id?.length ?? 1)) % 5 === 0 ? 'held' : 'open';
      slots.push({
        id: `${date}T${start}`,
        start,
        label: formatTime(start),
        status
      });
      iteration += 1;
    }
    return slots;
  }

  return {
    async getAvailability(service, date) {
      await wait(300 + Math.random() * 400);
      const iso = date || new Date().toISOString().split('T')[0];
      return {
        serviceId: service?.id ?? 'mock',
        date: iso,
        slots: generateSlots(service, iso)
      };
    }
  };
})();
