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
const categoryImageOverrides = new Map([
  ['salon-service', './assets/images/gallery-4.jpg'],
  ['brows-lashes', './assets/images/gallery-3.webp'],
  ['makeup', './assets/images/gallery-2.jpg'],
  ['nails', './assets/images/gallery-4.jpg'],
  ['color-treatments', './assets/images/gallery-1.webp'],
  ['haircuts-barbering', './assets/images/gallery-1.webp'],
  ['esthetics-facials', './assets/images/gallery-3.webp'],
  ['waxing', './assets/images/gallery-4.jpg']
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
const featuredServiceSlugs = [
  'womens-cut',
  'women-s-cut',
  'womens-haircut',
  'mens-cut',
  'haircut',
  'lash-lift',
  'brow-lamination',
  'express-facial',
  'gel-pedicure',
  'lash-fill',
  'full-lashes-set'
];
const popularBadgeIcons = ['⭐', '📍', '🔥'];
const addOnOptions = [
  { id: 'deep-conditioning', label: 'Deep Conditioning', price: 15, icon: 'droplets' },
  { id: 'brow-wax', label: 'Brow Wax', price: 12, icon: 'brow' },
  { id: 'hot-towels', label: 'Hot Towels', price: 10, icon: 'steam' },
  { id: 'simple-style', label: 'Simple Style', price: 15, icon: 'comb' }
];
const translations = {
  en: {
    chooseService: '1. Choose a service',
    searchLabel: 'Search services',
    serviceHint: 'This will map directly to your Square Catalog service variation IDs.',
    pickSlot: '2. Pick a day + slot',
    dateLabel: 'Date',
    timeLabel: 'Time slot',
    availabilityHint: 'Availability uses mocked data until you connect the Square Appointments API.',
    stylistSection: '3. Stylist assignment',
    autoAssign: 'Auto-Assign (fastest option)',
    manualAssign: 'Pick a stylist',
    guestDetails: '4. Guest details',
    guestName: 'Guest name',
    guestPhone: 'Mobile number',
    guestEmail: 'Email (for confirmations)',
    notesTitle: '5. Notes',
    notesLabel: 'Color formulas, inspo links, or reminders',
    addonsTitle: 'Optional add-ons',
    addonsHint: 'Boost tickets with quick extras.'
  },
  es: {
    chooseService: '1. Elige un servicio',
    searchLabel: 'Buscar servicios',
    serviceHint: 'Esto se conecta directo con tus IDs de Square.',
    pickSlot: '2. Escoge día y hora',
    dateLabel: 'Fecha',
    timeLabel: 'Horario',
    availabilityHint: 'Las horas usan datos de prueba hasta conectar Square Appointments.',
    stylistSection: '3. Asignación de estilista',
    autoAssign: 'Asignación automática (más rápido)',
    manualAssign: 'Elegir estilista',
    guestDetails: '4. Datos del cliente',
    guestName: 'Nombre',
    guestPhone: 'Celular',
    guestEmail: 'Email (para confirmación)',
    notesTitle: '5. Notas',
    notesLabel: 'Fórmulas, links o recordatorios',
    addonsTitle: 'Servicios extra opcionales',
    addonsHint: 'Aumenta el ticket con extras rápidos.'
  }
};

const selectors = {
  bookingForm: document.getElementById('bookingForm'),
  serviceCategories: document.getElementById('serviceCategories'),
  serviceList: document.getElementById('serviceList'),
  serviceSearch: document.getElementById('serviceSearch'),
  featuredServices: document.getElementById('featuredServices'),
  popularBadges: document.getElementById('popularBadges'),
  socialProof: document.getElementById('socialProof'),
  addOnPanel: document.getElementById('addOnPanel'),
  addOnList: document.getElementById('addOnList'),
  languageToggle: document.getElementById('languageToggle'),
  stylistList: document.getElementById('stylistList'),
  rotationPreview: document.getElementById('rotationPreview'),
  nextStylistLabel: document.querySelector('[data-next-stylist]'),
  nextStylistBtn: document.getElementById('nextStylistBtn'),
  dateInput: document.getElementById('dateInput'),
  timeSelect: document.getElementById('timeSelect'),
  refreshSlotsBtn: document.getElementById('refreshSlots'),
  availabilityStatus: document.getElementById('availabilityStatus'),
  availabilityMeter: document.getElementById('availabilityMeter'),
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

const ALL_CATEGORIES = '__all__';

const state = {
  serviceId: null,
  serviceCategory: ALL_CATEGORIES,
  openCategories: new Set(),
  searchTerm: '',
  date: '',
  time: '',
  stylistMode: 'roundRobin',
  stylistId: null,
  language: 'en',
  selectedAddOns: new Set(),
  clientName: '',
  clientPhone: '',
  clientEmail: '',
  notes: ''
};

async function bootstrap() {
  applyTranslations(state.language);
  await initializeCatalog();
  const backendStatus = await detectBackendCapabilities();
  if (backendStatus) {
    if (backendStatus.squareConfigured === false) {
      config.squareBookingEndpoint = '';
      config.squareAvailabilityEndpoint = '';
      logAction('Square proxy is not configured. Staying in mock availability mode.', 'warning');
    }
    if (backendStatus.googleConfigured === false) {
      config.googleCalendarEndpoint = '';
      logAction('Google Calendar sync disabled until credentials are added.', 'warning');
    }
  }
  renderServiceCards();
  renderFeaturedServices();
  renderPopularBadges();
  renderSocialProof();
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

async function detectBackendCapabilities() {
  const healthUrl = buildApiUrl('/health');
  if (!healthUrl) return null;
  try {
    const response = await fetch(healthUrl, { cache: 'no-store' });
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    console.warn('Health check failed', error);
    return null;
  }
}

function buildApiUrl(pathname) {
  const base = getApiBase();
  if (!base) return '';
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${normalizedBase}${normalizedPath}`;
}

function getApiBase() {
  const candidate =
    config.squareBookingEndpoint ||
    config.squareAvailabilityEndpoint ||
    config.servicesEndpoint ||
    config.teamEndpoint ||
    '';
  if (candidate && /^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      return url.origin;
    } catch (_error) {
      return '';
    }
  }
  const origin = window.location.origin === 'null' ? '' : window.location.origin;
  return origin;
}

function normalizeServices(rawList) {
  const seen = new Set();
  let removedWalkInServices = false;
  const services = rawList
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
        category: raw.category ?? raw.categoryName ?? 'Salon Service',
        duration,
        price,
        description: raw.description ?? '',
        squareCatalogObjectId: id,
        squareItemId: raw.squareItemId ?? raw.itemId ?? null,
        serviceVariationVersion: raw.serviceVariationVersion ?? raw.version ?? null,
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
      normalized.imageUrl = selectServiceImage(slug, normalized.imageUrl, normalized.category);
      return normalized;
    })
    .filter(service => {
      if (!service) return false;
      const categorySlug = slugify(service.category ?? '');
      if (categorySlug.startsWith('walk-in-quick-services')) {
        removedWalkInServices = true;
        return false;
      }
      if (seen.has(service.id)) return false;
      seen.add(service.id);
      return true;
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  if (removedWalkInServices) {
    logAction('Walk-in services are hidden because Square does not allow online booking for them.', 'info');
  }

  return services;
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

function selectServiceImage(slug, existingUrl, category) {
  if (existingUrl) return existingUrl;
  if (serviceImageOverrides.has(slug)) {
    return serviceImageOverrides.get(slug);
  }
  const categorySlug = slugify(category ?? '');
  if (categoryImageOverrides.has(categorySlug)) {
    return categoryImageOverrides.get(categorySlug);
  }
  const fallback = fallbackServiceImages[fallbackImageCursor % fallbackServiceImages.length];
  fallbackImageCursor += 1;
  return fallback;
}

function attachListeners() {
  selectors.serviceList.addEventListener('change', event => {
    if (event.target.name === 'serviceId') {
      state.serviceId = event.target.value;
      state.selectedAddOns = new Set();
      renderAddOns();
      loadAvailability();
      updateSummary();
    }
  });
  selectors.serviceCategories?.addEventListener('click', event => {
    const button = event.target.closest('button[data-category]');
    if (!button) return;
    const category = button.dataset.category ?? ALL_CATEGORIES;
    state.serviceCategory = category;
    state.openCategories = new Set(category === ALL_CATEGORIES ? [] : [category]);
    renderServiceCards();
    loadAvailability();
  });
  selectors.serviceSearch?.addEventListener('input', event => {
    state.searchTerm = event.target.value.trim();
    renderServiceCards();
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

  document.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', () => copyPayload(button.dataset.copy));
  });

  selectors.addOnList?.addEventListener('change', event => {
    if (event.target.name !== 'addOn') return;
    const id = event.target.value;
    if (event.target.checked) {
      state.selectedAddOns.add(id);
    } else {
      state.selectedAddOns.delete(id);
    }
    updateSummary();
  });

  selectors.languageToggle?.addEventListener('click', event => {
    const button = event.target.closest('button[data-lang]');
    if (!button) return;
    const next = button.dataset.lang;
    if (next === state.language) return;
    state.language = next;
    applyTranslations(next);
    selectors.languageToggle.querySelectorAll('button').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.lang === next);
    });
  });
}

function renderServiceCards() {
  const list = selectors.serviceList;
  list.innerHTML = '';
  if (!services.length) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No services available yet. Configure Square to populate this list.';
    list.appendChild(empty);
    return;
  }

  const query = state.searchTerm.toLowerCase();
  const filtered = services.filter(service => {
    if (!query) return true;
    return (
      service.name.toLowerCase().includes(query) ||
      service.category.toLowerCase().includes(query) ||
      (service.description || '').toLowerCase().includes(query)
    );
  });
  const availableCategories = new Set(filtered.map(service => service.category).filter(Boolean));
  if (state.serviceCategory !== ALL_CATEGORIES && !availableCategories.has(state.serviceCategory)) {
    state.serviceCategory = ALL_CATEGORIES;
  }
  const visible =
    state.serviceCategory === ALL_CATEGORIES
      ? filtered
      : filtered.filter(service => service.category === state.serviceCategory);

  const categories = new Map();
  visible.forEach(service => {
    const key = service.category || 'Salon Services';
    if (!categories.has(key)) categories.set(key, []);
    categories.get(key).push(service);
  });

  renderServiceFilters(Array.from(categories.keys()));

  if (!categories.size) {
    const empty = document.createElement('p');
    empty.className = 'hint';
    empty.textContent = 'No services match your search.';
    list.appendChild(empty);
    return;
  }

  const openByDefault = new Set(state.openCategories);

  Array.from(categories.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([category, services], categoryIndex) => {
      const section = document.createElement('details');
      section.className = 'category-panel';
      section.open = openByDefault.has(category) || (!!query && services.length > 0);
      section.dataset.category = category;
      section.addEventListener('toggle', () => {
        if (section.open) {
          state.openCategories.add(category);
        } else {
          state.openCategories.delete(category);
        }
      });

      const summary = document.createElement('summary');
      summary.className = 'category-summary';
      const summaryIcon = createServiceIcon(category);
      const summaryLabel = document.createElement('span');
      summaryLabel.textContent = `${category} · ${services.length}`;
      summary.appendChild(summaryIcon);
      summary.appendChild(summaryLabel);
      section.appendChild(summary);

      const grid = document.createElement('div');
      grid.className = 'option-grid';
      services.forEach((service, index) => {
        const label = document.createElement('label');
        label.className = 'service-card';
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'serviceId';
        input.value = service.id;
        input.checked = state.serviceId ? state.serviceId === service.id : index === 0 && categoryIndex === 0;
        if (input.checked) {
          state.serviceId = service.id;
        }

        const metaRow = document.createElement('div');
        metaRow.className = 'service-card__row';
        const icon = createServiceIcon(service.name || service.category);
        const textWrap = document.createElement('div');
        textWrap.className = 'service-card__text';
        const name = document.createElement('strong');
        name.textContent = service.name;
        const meta = document.createElement('small');
        meta.textContent = `${service.duration} min`;
        const description = document.createElement('span');
        description.className = 'service-card__description';
        description.textContent = service.description || 'Quick preview with illustrated icon.';
        textWrap.appendChild(name);
        textWrap.appendChild(meta);
        textWrap.appendChild(description);
        metaRow.appendChild(icon);
        metaRow.appendChild(textWrap);

        const badgeRow = document.createElement('div');
        badgeRow.className = 'service-card__badges';
        const categoryPill = document.createElement('span');
        categoryPill.className = 'service-card__badge';
        categoryPill.textContent = service.category;
        badgeRow.appendChild(categoryPill);
        getServiceBadges(service).forEach(badge => {
          const pill = document.createElement('span');
          pill.className = 'service-card__tag';
          pill.textContent = badge;
          badgeRow.appendChild(pill);
        });

        const price = document.createElement('span');
        price.className = 'price';
        price.textContent = formatCurrency(service.price);

        label.appendChild(input);
        label.appendChild(metaRow);
        label.appendChild(badgeRow);
        label.appendChild(price);
        grid.appendChild(label);
      });

      section.appendChild(grid);
      list.appendChild(section);
    });

  renderAddOns();
}

function renderServiceFilters(categories = []) {
  const container = selectors.serviceCategories;
  if (!container) return;
  container.innerHTML = '';
  if (!services.length) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  const uniqueCategories = categories.filter(Boolean).sort((a, b) => a.localeCompare(b));
  const selected = state.serviceCategory ?? ALL_CATEGORIES;
  container.appendChild(createCategoryButton('All services', ALL_CATEGORIES, selected === ALL_CATEGORIES));
  uniqueCategories.forEach(category => {
    container.appendChild(createCategoryButton(category, category, selected === category));
  });
}

function createCategoryButton(label, value, active) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'service-filter-btn';
  if (active) button.classList.add('is-active');
  button.dataset.category = value;
  const icon = createServiceIcon(label);
  button.appendChild(icon);
  const text = document.createElement('span');
  text.textContent = label;
  button.appendChild(text);
  return button;
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
    const avatar = createAvatar(stylist.name);
    const metaWrapper = document.createElement('span');
    metaWrapper.className = 'stylist-meta';
    const name = document.createElement('strong');
    name.textContent = stylist.name;
    const small = document.createElement('small');
    small.textContent = stylist.specialties;
    const contact = document.createElement('small');
    contact.textContent = stylist.displayPhone || SALON_PHONE_DISPLAY;
    const tags = document.createElement('div');
    tags.className = 'stylist-tags';
    stylist.specialties
      .split('/')
      .map(tag => tag.trim())
      .filter(Boolean)
      .forEach(tag => {
        const badge = document.createElement('span');
        badge.className = 'stylist-tag';
        badge.textContent = tag;
        tags.appendChild(badge);
      });
    metaWrapper.appendChild(name);
    metaWrapper.appendChild(small);
    metaWrapper.appendChild(contact);
    metaWrapper.appendChild(tags);
    label.appendChild(input);
    label.appendChild(avatar);
    label.appendChild(metaWrapper);
    selectors.stylistList.appendChild(label);
  });
}

function getServiceBadges(service) {
  const slug = slugify(service.name);
  const badges = [];
  const rank = featuredServiceSlugs.indexOf(slug);
  if (rank > -1 && rank < popularBadgeIcons.length) {
    badges.push(`${popularBadgeIcons[rank]} Most booked`);
  } else if (rank > -1) {
    badges.push('⭐ Popular pick');
  }
  if (service.duration <= 30) {
    badges.push('⏱ Quick visit');
  }
  if ((service.price ?? 0) >= 100) {
    badges.push('💎 Premium');
  }
  return badges.slice(0, 3);
}

function renderFeaturedServices() {
  const container = selectors.featuredServices;
  if (!container) return;
  container.innerHTML = '';
  if (!services.length) return;
  const ranked = services
    .map(service => ({
      service,
      score: featuredServiceSlugs.indexOf(slugify(service.name))
    }))
    .sort((a, b) => {
      const scoreA = a.score === -1 ? 99 : a.score;
      const scoreB = b.score === -1 ? 99 : b.score;
      return scoreA - scoreB;
    })
    .slice(0, 5);

  ranked.forEach(({ service }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'featured-card';
    const icon = createServiceIcon(service.name);
    const name = document.createElement('span');
    name.className = 'featured-name';
    name.textContent = service.name;
    const price = document.createElement('span');
    price.className = 'featured-price';
    price.textContent = formatCurrency(service.price);
    button.appendChild(icon);
    button.appendChild(name);
    button.appendChild(price);
    button.addEventListener('click', () => {
      state.serviceId = service.id;
      state.serviceCategory = service.category;
      state.openCategories = new Set([service.category]);
      state.selectedAddOns = new Set();
      renderServiceCards();
      renderAddOns();
      loadAvailability();
      updateSummary();
    });
    container.appendChild(button);
  });
}

function renderPopularBadges() {
  const container = selectors.popularBadges;
  if (!container) return;
  container.innerHTML = '';
  if (!services.length) return;
  const top = services
    .map(service => ({
      name: service.name,
      slug: slugify(service.name),
      price: service.price
    }))
    .sort((a, b) => {
      const scoreA = featuredServiceSlugs.indexOf(a.slug);
      const scoreB = featuredServiceSlugs.indexOf(b.slug);
      const normalizedA = scoreA === -1 ? 99 : scoreA;
      const normalizedB = scoreB === -1 ? 99 : scoreB;
      return normalizedA - normalizedB;
    })
    .slice(0, 5);
  top.forEach((entry, index) => {
    const badge = document.createElement('span');
    badge.className = 'popular-badge';
    badge.textContent = `${popularBadgeIcons[index % popularBadgeIcons.length]} ${entry.name}`;
    container.appendChild(badge);
  });
}

function renderSocialProof() {
  const container = selectors.socialProof;
  if (!container) return;
  container.innerHTML = '';
  const quotes = [
    { badge: '⭐ Most booked', quote: '"Fast, easy, and professional every time."' },
    { badge: '📍 New guest favorite', quote: '"Found my lash tech here—love the clean layout."' },
    { badge: '🔥 Trending this month', quote: '"The add-ons make it feel like a spa upgrade."' }
  ];
  quotes.forEach(item => {
    const card = document.createElement('div');
    card.className = 'proof-card';
    const badge = document.createElement('span');
    badge.className = 'proof-badge';
    badge.textContent = item.badge;
    const text = document.createElement('p');
    text.textContent = item.quote;
    card.appendChild(badge);
    card.appendChild(text);
    container.appendChild(card);
  });
}

function renderAddOns() {
  const panel = selectors.addOnPanel;
  const list = selectors.addOnList;
  if (!panel || !list) return;
  list.innerHTML = '';
  if (!state.serviceId) {
    panel.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  addOnOptions.forEach(option => {
    const label = document.createElement('label');
    label.className = 'addon-card';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'addOn';
    input.value = option.id;
    input.checked = state.selectedAddOns.has(option.id);
    const icon = createServiceIcon(option.icon);
    const textWrap = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = option.label;
    const meta = document.createElement('small');
    meta.textContent = `+${formatCurrency(option.price)}`;
    textWrap.appendChild(title);
    textWrap.appendChild(meta);
    label.appendChild(input);
    label.appendChild(icon);
    label.appendChild(textWrap);
    list.appendChild(label);
  });
}

function getSelectedAddOns() {
  return addOnOptions.filter(option => state.selectedAddOns.has(option.id));
}

function createServiceIcon(label) {
  const icon = document.createElement('span');
  icon.className = 'icon-circle';
  icon.innerHTML = getIconSvg(label);
  icon.setAttribute('aria-hidden', 'true');
  return icon;
}

function getIconSvg(label) {
  const key = getIconKey(label);
  const stroke = '#3a2b5f';
  const accent = '#a050ff';
  const icons = {
    scissors: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 30c3 0 5.5-2.5 5.5-5.5S15 19 12 19s-5.5 2.5-5.5 5.5S9 30 12 30Zm24 0c3 0 5.5-2.5 5.5-5.5S39 19 36 19s-5.5 2.5-5.5 5.5S33 30 36 30Z" stroke="${stroke}" stroke-width="2" /><path d="M11 22 33 10M37 22 15 10" stroke="${accent}" stroke-width="3" stroke-linecap="round"/><path d="M21 24 31 29.5" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    lash: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 22c4.5 6 10 9 16 9s11.5-3 16-9" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/><path d="M12 18v-5m8 6V8m8 6V8m8 10v-5" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    brush: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30 8 39 17 24 32l-7-7Z" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/><path d="M12 34c0 3 2 6 6 6s6-2.5 6-5c0-2-1-3-3-3-3 0-4.5-1.5-4.5-4.5" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    polish: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="16" width="20" height="22" rx="6" stroke="${stroke}" stroke-width="2.5"/><path d="M24 10v8m-4-12h8" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    facial: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 6c8 0 12 5 12 13 0 9-6 17-12 23-6-6-12-14-12-23C12 11 16 6 24 6Z" stroke="${stroke}" stroke-width="2.5"/><path d="M18 20c1.5-2 3.5-3 6-3s4.5 1 6 3" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    wax: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="16" width="28" height="18" rx="4" stroke="${stroke}" stroke-width="2.5"/><path d="M16 16c0-3 3.5-6 8-6s8 3 8 6" stroke="${accent}" stroke-width="2.5"/><path d="M16 26h16" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    droplets: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 12c-3 5-6 8-6 12a10 10 0 1 0 20 0c0-4-3-7-6-12" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/><path d="M32 14c1.5 3 3 4.5 3 7.5A6.5 6.5 0 0 1 28.5 28" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    brow: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 22c4-4 10-6 14-6s10 2 14 6" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/><path d="M18 26c2-1 4-1.5 6-1.5s4 .5 6 1.5" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    steam: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 30h20" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/><path d="M18 32c0 2 2 4 6 4s6-2 6-4" stroke="${accent}" stroke-width="2.5"/><path d="M20 14c-2 3-2 5 0 8m8-8c-2 3-2 5 0 8" stroke="${stroke}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    comb: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="18" width="28" height="10" rx="4" stroke="${stroke}" stroke-width="2.5"/><path d="M14 14v8m4-8v8m4-8v8m4-8v8m4-8v8" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/></svg>`,
    sparkle: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M24 9 27 19l10 3-10 3-3 10-3-10-10-3 10-3 3-10Z" stroke="${accent}" stroke-width="2.5" stroke-linejoin="round"/><path d="m36 14-1 3-3 1 3 1 1 3 1-3 3-1-3-1-1-3Z" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/></svg>`
  };
  return icons[key] || icons.sparkle;
}

function getIconKey(label = '') {
  const slug = slugify(label);
  if (slug.includes('lash') || slug.includes('brow')) return 'lash';
  if (slug.includes('color') || slug.includes('highlight')) return 'brush';
  if (slug.includes('nail') || slug.includes('pedi') || slug.includes('mani')) return 'polish';
  if (slug.includes('wax')) return 'wax';
  if (slug.includes('facial') || slug.includes('skin')) return 'facial';
  if (slug.includes('condition') || slug.includes('towel')) return 'droplets';
  if (slug.includes('style') || slug.includes('comb')) return 'comb';
  if (slug.includes('hair') || slug.includes('cut')) return 'scissors';
  return 'sparkle';
}

function createAvatar(name = '') {
  const initials = name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';
  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.textContent = initials;
  return avatar;
}

function applyTranslations(language) {
  const strings = translations[language] || translations.en;
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach(node => {
    const key = node.dataset.i18n;
    if (strings[key]) {
      node.textContent = strings[key];
    }
  });
  if (selectors.serviceSearch) {
    selectors.serviceSearch.placeholder =
      language === 'es' ? 'Busca pestañas, cera, pedicure...' : 'Search lash, wax, pedicure...';
  }
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
    renderAvailabilityMeter(availability?.slots || []);
    setAvailabilityStatus(
      availability?.source === 'square'
        ? `Live availability loaded instantly · refreshed ${timeStamp()}`
        : `Mock data for testing · refreshed ${timeStamp()}`
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
    renderAvailabilityMeter(mock?.slots || []);
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

function renderAvailabilityMeter(slots) {
  if (!selectors.availabilityMeter) return;
  selectors.availabilityMeter.innerHTML = '';
  const openSlots = slots.filter(slot => slot.status === 'open');
  const message = document.createElement('span');
  if (!slots.length) {
    message.textContent = 'Fully booked for this day.';
    message.className = 'availability-pill is-full';
  } else {
    const count = openSlots.length;
    message.textContent = `${count} spot${count === 1 ? '' : 's'} left today`;
    message.className = count <= 2 ? 'availability-pill is-hot' : 'availability-pill';
  }
  selectors.availabilityMeter.appendChild(message);
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
  const addOns = getSelectedAddOns();
  selectors.summaryFields.service.textContent = service
    ? `${service.name} - ${service.duration} min - ${formatCurrency(service.price)}${
        addOns.length ? ` + Add-ons: ${addOns.map(item => item.label).join(', ')}` : ''
      }`
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
        team_member_id: stylist.squareStaffId,
        service_variation_version: service.serviceVariationVersion ?? undefined
      }
    ],
    metadata: {
      stylist_assignment: state.stylistMode,
      source: 'custom_booking_ui'
    }
  };
  const addOns = getSelectedAddOns();
  if (addOns.length) {
    payload.metadata.add_ons = addOns.map(item => `${item.label}+${item.price}`).join(', ');
    payload.customer_note = [payload.customer_note, `Add-ons: ${addOns.map(item => item.label).join(', ')}`]
      .filter(Boolean)
      .join(' | ');
  }
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
  const addOns = getSelectedAddOns();
  return {
    summary: `${service.name} - ${state.clientName}`,
    description: [
      `Service: ${service.name}`,
      `Duration: ${service.duration} minutes`,
      `Guest phone: ${state.clientPhone}`,
      addOns.length ? `Add-ons: ${addOns.map(item => `${item.label} (+${formatCurrency(item.price)})`).join(', ')}` : null,
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
  state.selectedAddOns = new Set(addOnOptions.slice(0, 2).map(option => option.id));
  renderAddOns();
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
