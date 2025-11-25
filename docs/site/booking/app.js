const defaultConfig = {
  squareBookingEndpoint: '',
  squareAvailabilityEndpoint: '',
  googleCalendarEndpoint: '',
  servicesEndpoint: '/api/services',
  teamEndpoint: '/api/team',
  timeZone: 'America/New_York',
  embedUrl: '',
  useMockAvailability: true,
  useMockCatalog: false
};

const config = {
  ...defaultConfig,
  ...(window.__BOOKING_CONFIG || {})
};

const fallbackServices = [
  {
    id: 'XPFNIJBYQKTSBRFTNDNKHNIP',
    name: 'Haircut',
    category: 'Cuts & Barbering',
    duration: 30,
    price: 25,
    description: 'Classic clipper or shear cut tailored to you.',
    squareCatalogObjectId: 'XPFNIJBYQKTSBRFTNDNKHNIP',
    squareItemId: '2QVFNRFTBKWJVQB7VE4WM37C',
    teamMemberIds: ['QtBlDWuSwRfPAmfPAdMo', 'TMoC0HYrTtI1d030'],
    imageUrl: './assets/images/gallery-1.webp'
  },
  {
    id: 'GQGYDELSCAQUJEJUMV4GPMZA',
    name: "Women's Haircut",
    category: 'Cuts & Barbering',
    duration: 30,
    price: 30,
    description: 'Fresh cut, blowout, and finish styling.',
    squareCatalogObjectId: 'GQGYDELSCAQUJEJUMV4GPMZA',
    squareItemId: 'M55RYLX4MP3PJYFIIMCIHRKY',
    teamMemberIds: ['QtBlDWuSwRfPAmfPAdMo', 'TMoC0HYrTtI1d030'],
    imageUrl: './assets/images/gallery-2.jpg'
  },
  {
    id: 'TUTAON3HQ7JVHHMLQD7WNRXU',
    name: 'Full Lashes Set',
    category: 'Brows & Lashes',
    duration: 60,
    price: 145,
    description: 'Complete lash extension set with custom styling.',
    squareCatalogObjectId: 'TUTAON3HQ7JVHHMLQD7WNRXU',
    squareItemId: 'R2STVBD2ZGZ25V7CW52H533T',
    teamMemberIds: ['QtBlDWuSwRfPAmfPAdMo', 'TM4GMI7mifHgMITv', 'TMoC0HYrTtI1d030'],
    imageUrl: './assets/images/gallery-3.webp'
  },
  {
    id: 'SN5UMKVSZFNJHNMF2OJEV5QP',
    name: 'Lash Fill',
    category: 'Brows & Lashes',
    duration: 30,
    price: 45,
    description: 'Refresh and refill existing lash extensions.',
    squareCatalogObjectId: 'SN5UMKVSZFNJHNMF2OJEV5QP',
    squareItemId: 'PS55TCSXELUCJUAO6DKD3FP2',
    teamMemberIds: ['QtBlDWuSwRfPAmfPAdMo', 'TM4GMI7mifHgMITv', 'TMoC0HYrTtI1d030'],
    imageUrl: './assets/images/gallery-4.jpg'
  }
];

const fallbackStylists = [
  {
    id: 'QtBlDWuSwRfPAmfPAdMo',
    name: 'Cecilia Garcia-Torres',
    specialties: 'Owner / Master Stylist',
    calendarEmail: 'salonglamournc@gmail.com',
    squareStaffId: 'QtBlDWuSwRfPAmfPAdMo'
  },
  {
    id: 'TMoC0HYrTtI1d030',
    name: 'Esperanza Garcia',
    specialties: 'Barber / Stylist',
    calendarEmail: 'esperanzagarciatorres86@gmail.com',
    squareStaffId: 'TMoC0HYrTtI1d030'
  },
  {
    id: 'TM4GMI7mifHgMITv',
    name: 'Marcela Burciaga',
    specialties: 'Lash Tech',
    calendarEmail: 'marcelaburciaga@icloud.com',
    squareStaffId: 'TM4GMI7mifHgMITv'
  }
];

let services = [];
let stylists = [];
let servicesById = new Map();
let stylistsById = new Map();
let roundRobin = createRoundRobin([]);
let summaryInitialized = false;
let categoryFilter = 'All';
const categoryOrder = [
  'Haircuts & Barbering',
  'Hair Color',
  'Lashes & Brows',
  'Makeup',
  'Facials & Skin',
  'Waxing',
  'Nails',
  'Kids',
  'Packages',
  'Other'
];

const fallbackServiceImages = [
  './assets/images/gallery-1.webp',
  './assets/images/gallery-2.jpg',
  './assets/images/gallery-3.webp',
  './assets/images/gallery-4.jpg'
];
const serviceImageOverrides = new Map([
  ['haircut', './assets/images/gallery-1.webp'],
  ['womens-haircut', './assets/images/gallery-2.jpg'],
  ['full-lashes-set', './assets/images/gallery-3.webp'],
  ['lash-full-set', './assets/images/gallery-3.webp'],
  ['lash-fill', './assets/images/gallery-4.jpg'],
  ['brow-lamination', './assets/images/gallery-4.jpg']
]);
let fallbackImageCursor = 0;
const SALON_PHONE_DISPLAY = '(336) 521-9528';
const SALON_PHONE_E164 = '+13365219528';
const stylistOverrides = new Map([
  [
    'QtBlDWuSwRfPAmfPAdMo',
    {
      name: 'Cecii',
      specialties: 'Owner / Master Stylist',
      calendarEmail: 'salonglamournc@gmail.com'
    }
  ],
  [
    'TMoC0HYrTtI1d030',
    {
      name: 'Esperanza Garcia',
      specialties: 'Cuts & Barbering',
      calendarEmail: 'salonglamournc@gmail.com'
    }
  ],
  [
    'TM4GMI7mifHgMITv',
    {
      name: 'Marcela',
      specialties: 'Brows & Lashes',
      calendarEmail: 'salonglamournc@gmail.com'
    }
  ]
]);

const selectors = {
  bookingForm: document.getElementById('bookingForm'),
  serviceFilters: document.getElementById('serviceFilters'),
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
  serviceId: null,
  date: '',
  time: '',
  stylistMode: 'roundRobin',
  stylistId: null,
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  notes: ''
};

async function bootstrap() {
  await initializeCatalog();
  renderServiceFilters();
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
  logAction('Sandbox ready. Live Square data loaded when available.');
}

async function initializeCatalog() {
  fallbackImageCursor = 0;
  if (config.useMockCatalog) {
    services = normalizeServices(fallbackServices);
    stylists = normalizeStylists(fallbackStylists);
    finalizeCatalogState();
    logAction('Mock catalog loaded. Update config to pull live data.', 'warning');
    return;
  }

  try {
    const [servicePayload, teamPayload] = await Promise.all([
      config.servicesEndpoint ? fetchJson(config.servicesEndpoint) : Promise.resolve(null),
      config.teamEndpoint ? fetchJson(config.teamEndpoint) : Promise.resolve(null)
    ]);

    const fetchedServices = Array.isArray(servicePayload?.services) ? servicePayload.services : [];
    const fetchedStylists = Array.isArray(teamPayload?.teamMembers ?? teamPayload?.stylists)
      ? teamPayload.teamMembers ?? teamPayload.stylists
      : [];

    services = fetchedServices.length ? normalizeServices(fetchedServices) : normalizeServices(fallbackServices);
    stylists = fetchedStylists.length ? normalizeStylists(fetchedStylists) : normalizeStylists(fallbackStylists);

    if (!fetchedServices.length) {
      logAction('No services returned from Square API. Using fallback list.', 'warning');
    }
    if (!fetchedStylists.length) {
      logAction('No team members returned from Square API. Using fallback roster.', 'warning');
    }
  } catch (error) {
    console.error(error);
    logAction('Failed to load live services or stylists; falling back to local data.', 'warning');
    services = normalizeServices(fallbackServices);
    stylists = normalizeStylists(fallbackStylists);
  }

  finalizeCatalogState();
  console.log('Salon booking stylists:', stylists);
  console.log('Salon booking services:', services.slice(0, 5));
}

function finalizeCatalogState() {
  servicesById = new Map(services.map(service => [service.id, service]));
  stylistsById = new Map(stylists.map(stylist => [stylist.id, stylist]));
  roundRobin = createRoundRobin(stylists);
  if (!state.serviceId || !servicesById.has(state.serviceId)) {
    state.serviceId = services[0]?.id ?? null;
  }
  if (!state.stylistId || !stylistsById.has(state.stylistId)) {
    state.stylistId = stylists[0]?.id ?? null;
  }
}

function normalizeServices(rawList) {
  const seen = new Set();
  return rawList
    .map(raw => {
      const name = raw.name ?? raw.displayName ?? 'Service';
      const id = raw.squareCatalogObjectId ?? raw.squareVariationId ?? raw.id;
      if (!id) return null;
      const duration =
        Number.isFinite(raw.duration) && raw.duration > 0
          ? raw.duration
          : Number.isFinite(raw.durationMinutes) && raw.durationMinutes > 0
          ? raw.durationMinutes
          : 60;
      const price =
        typeof raw.price === 'number'
          ? raw.price
          : raw.price_money?.amount
          ? raw.price_money.amount / 100
          : raw.priceMoney?.amount
          ? raw.priceMoney.amount / 100
          : null;
      const normalized = {
        id,
        name,
        category: raw.category ?? raw.categoryName ?? categorizeService(name),
        duration,
        price,
        description: raw.description ?? '',
        squareCatalogObjectId: id,
        squareItemId: raw.squareItemId ?? raw.itemId ?? null,
        teamMemberIds: Array.isArray(raw.teamMemberIds) ? raw.teamMemberIds.filter(Boolean) : [],
        imageUrl: raw.imageUrl ?? null
      };
      const slug = slugify(normalized.name);
      if (slug === 'lash-full-set' || slug === 'full-lashes-set') {
        normalized.name = 'Full Lashes Set';
        if (typeof normalized.price === 'number' && normalized.price < 145) {
          normalized.price = 145;
        }
      }
      normalized.imageUrl = selectServiceImage(slug, normalized.imageUrl);
      return normalized;
    })
    .filter(service => {
      if (!service) return false;
      if (seen.has(service.id)) return false;
      seen.add(service.id);
      return true;
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
}

function categorizeService(name) {
  const n = name.toLowerCase();
  if (n.includes('lash') || n.includes('brow')) return 'Lashes & Brows';
  if (n.includes('color') || n.includes('balayage') || n.includes('highlight') || n.includes('gloss') || n.includes('tone')) return 'Hair Color';
  if (n.includes('cut') || n.includes('barber') || n.includes('fade') || n.includes('haircut') || n.includes('trim')) return 'Haircuts & Barbering';
  if (n.includes('makeup') || n.includes('bridal')) return 'Makeup';
  if (n.includes('facial') || n.includes('skin') || n.includes('derma') || n.includes('peel') || n.includes('microderm')) return 'Facials & Skin';
  if (n.includes('wax') || n.includes('thread')) return 'Waxing';
  if (n.includes('nail') || n.includes('mani') || n.includes('pedi')) return 'Nails';
  if (n.includes('kid')) return 'Kids';
  if (n.includes('package')) return 'Packages';
  return 'Other';
}

function normalizeStylists(rawList) {
  const seen = new Set();
  return rawList
    .map(raw => {
      const id = raw.squareStaffId ?? raw.id;
      if (!id) return null;
      const name =
        raw.name ??
        [raw.givenName ?? raw.given_name, raw.familyName ?? raw.family_name].filter(Boolean).join(' ');
      const jobTitles = Array.isArray(raw.wage_setting?.job_assignments)
        ? raw.wage_setting.job_assignments.map(job => job.job_title).filter(Boolean)
        : Array.isArray(raw.jobAssignments)
        ? raw.jobAssignments.map(job => job.job_title).filter(Boolean)
        : [];
      return {
        id,
        name: name?.trim() || id,
        specialties: raw.specialties ?? (jobTitles.length ? jobTitles.join(' / ') : 'Stylist'),
        calendarEmail: raw.calendarEmail ?? raw.email ?? raw.email_address ?? '',
        squareStaffId: id,
        phone: raw.phone ?? raw.phone_number ?? ''
      };
    })
    .filter(stylist => {
      if (!stylist) return false;
      if (seen.has(stylist.id)) return false;
      seen.add(stylist.id);
      return true;
    })
    .map(stylist => {
      const override = stylistOverrides.get(stylist.id);
      if (override) {
        Object.assign(stylist, override);
      }
      stylist.phone = SALON_PHONE_E164;
      stylist.displayPhone = SALON_PHONE_DISPLAY;
      if (!stylist.calendarEmail) {
        stylist.calendarEmail = 'salonglamournc@gmail.com';
      }
      return stylist;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function selectServiceImage(slug, existingUrl) {
  if (existingUrl) return existingUrl;
  if (serviceImageOverrides.has(slug)) {
    return serviceImageOverrides.get(slug);
  }
  const fallback = fallbackServiceImages[fallbackImageCursor % fallbackServiceImages.length];
  fallbackImageCursor += 1;
  return fallback;
}

function attachListeners() {
  selectors.serviceFilters?.addEventListener('click', event => {
    const btn = event.target.closest('button[data-category]');
    if (!btn) return;
    categoryFilter = btn.dataset.category;
    renderServiceFilters();
    renderServiceCards();
  });

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
    const skipped = roundRobin?.skip?.();
    if (!skipped) {
      logAction('No stylists available for rotation yet.', 'warning');
      return;
    }
    updateRotationPreview();
    updateSummary();
    logAction(`Rotation advanced past ${skipped.name}.`, 'success');
  });

  selectors.demoBookingBtn.addEventListener('click', () => {
    fillDemoBooking();
  });

  selectors.bookingForm.addEventListener('submit', async event => {
    event.preventDefault();
    await handleSubmit();
  });
}

function renderServiceFilters() {
  const list = services.length ? services : fallbackServices;
  const categories = Array.from(new Set(['All', ...list.map(svc => svc.category || 'Other')]));
  const sorted = ['All', ...categoryOrder.filter(cat => categories.includes(cat)), ...categories.filter(cat => !categoryOrder.includes(cat) && cat !== 'All')];
  selectors.serviceFilters.innerHTML = sorted
    .map(cat => {
      const count = cat === 'All' ? list.length : list.filter(svc => (svc.category || 'Other') === cat).length;
      return `<button type="button" data-category="${cat}" class="pill ${categoryFilter === cat ? 'active' : ''}">${cat} <span class="pill-count">${count}</span></button>`;
    })
    .join('');
}

function renderServiceCards() {
  selectors.serviceList.innerHTML = '';
  if (!services.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No services available yet. Configure Square to populate this list.';
    selectors.serviceList.appendChild(empty);
    return;
  }

  const filtered =
    categoryFilter === 'All'
      ? services
      : services.filter(svc => (svc.category || 'Other') === categoryFilter);

  filtered.forEach((service, index) => {
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

    const badge = document.createElement('span');
    badge.className = 'service-card__badge';
    badge.textContent = service.category;
    const name = document.createElement('strong');
    name.textContent = service.name;
    const meta = document.createElement('small');
    meta.textContent = `${service.duration} min`;
    const price = document.createElement('span');
    price.className = 'price';
    price.textContent = formatCurrency(service.price);

    label.appendChild(input);
    if (service.imageUrl) {
      const image = document.createElement('img');
      image.className = 'service-card__image';
      image.src = service.imageUrl;
      image.alt = `${service.name} service`;
      image.loading = 'lazy';
      label.appendChild(image);
    }
    label.appendChild(badge);
    label.appendChild(name);
    label.appendChild(meta);
    if (service.description) {
      const desc = document.createElement('span');
      desc.className = 'service-card__description';
      desc.textContent = service.description;
      label.appendChild(desc);
    }
    label.appendChild(price);
    selectors.serviceList.appendChild(label);
  });
}

function renderStylists() {
  selectors.stylistList.innerHTML = '';
  if (!stylists.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No team members available. Update Square to assign staff.';
    selectors.stylistList.appendChild(empty);
    return;
  }

  stylists.forEach((stylist, index) => {
    const label = document.createElement('label');
    label.className = 'stylist-card';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'stylistId';
    input.value = stylist.id;
    input.checked = state.stylistId ? state.stylistId === stylist.id : index === 0;
    if (input.checked) {
      state.stylistId = stylist.id;
    }
    const name = document.createElement('strong');
    const metaWrapper = document.createElement('span');
    metaWrapper.className = 'stylist-meta';
    name.textContent = stylist.name;
    const small = document.createElement('small');
    small.textContent = stylist.specialties;
    const contact = document.createElement('small');
    contact.textContent = stylist.displayPhone || SALON_PHONE_DISPLAY;
    metaWrapper.appendChild(name);
    metaWrapper.appendChild(small);
    metaWrapper.appendChild(contact);
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
    const mock = await SquareAvailability.fetch({
      service,
      date: state.date,
      stylists,
      forceMock: true
    });
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
  const next = roundRobin?.peek?.();
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
    const next = roundRobin?.peek?.();
    stylistText = next?.stylist
      ? `Round robin (next: ${next.stylist.name} • ${next.stylist.displayPhone || SALON_PHONE_DISPLAY})`
      : 'Add stylists to roster';
  } else if (state.stylistMode === 'manual') {
    const selectedStylist = stylistsById.get(state.stylistId);
    stylistText = selectedStylist
      ? `Stylist: ${selectedStylist.name} • ${selectedStylist.displayPhone || SALON_PHONE_DISPLAY}`
      : 'Select a stylist';
  }
  selectors.summaryFields.stylist.textContent = stylistText;

  const clientBits = [state.clientName, state.clientPhone].filter(Boolean);
  selectors.summaryFields.client.textContent = clientBits.length ? clientBits.join(' / ') : 'Add guest details';

  selectors.summaryFields.notes.textContent = state.notes || 'Optional';

  if (!selectors.activityLog) return;
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
      : roundRobin?.assign?.();

  if (!stylist) {
    logAction('No stylist selected. Add team members first.', 'error');
    return;
  }

  const squarePayload = buildSquarePayload(service, stylist, start, end);
  const googlePayload = buildGooglePayload(service, stylist, start, end);
  const summaryText = `Booking for ${state.clientName} with ${stylist.name} on ${formatHumanDate(
    state.date
  )} at ${formatTime(state.time)}`;

  if (selectors.squarePayload) {
    selectors.squarePayload.textContent = JSON.stringify(squarePayload, null, 2);
  }
  if (selectors.googlePayload) {
    selectors.googlePayload.textContent = JSON.stringify(googlePayload, null, 2);
  }
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
  if (!selectors.activityLog) {
    console[tone === 'error' ? 'error' : 'log'](message);
    return;
  }
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
  const demoService = servicesById.get(state.serviceId) || services[0];
  if (!demoService) {
    logAction('Add at least one service to try the demo booking.', 'warning');
    return;
  }
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
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 'Price varies';
  }
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

async function fetchJson(endpoint, options = {}) {
  const resolved = resolveEndpoint(endpoint);
  if (!resolved) {
    throw new Error('Endpoint missing');
  }
  const response = await fetch(resolved, {
    headers: {
      Accept: 'application/json',
      ...(options.headers || {})
    },
    ...options,
    body: options.body
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error?.message || payload?.message || `Request failed (${response.status})`;
    const error = new Error(message);
    error.response = payload;
    throw error;
  }
  return response.json();
}

function slugify(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveEndpoint(endpoint) {
  if (!endpoint) return '';
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  let base = window.location.origin === 'null' ? 'http://localhost:8080' : window.location.origin;
  if (base.includes('localhost:8080')) {
    base = 'http://localhost:8788';
  }
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
    const rosterIds = service.teamMemberIds?.length
      ? service.teamMemberIds
      : stylists.map(stylist => stylist.squareStaffId);
    rosterIds.filter(Boolean).forEach(id => url.searchParams.append('teamMemberIds', id));
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

bootstrap().catch(error => {
  console.error(error);
  logAction('Failed to initialize booking sandbox.', 'error');
});

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
