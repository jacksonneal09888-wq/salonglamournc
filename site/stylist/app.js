const apiBase =
  window.location.origin.includes('localhost:8080') || window.location.origin === 'null'
    ? 'http://localhost:8788'
    : '';

const state = {
  token: localStorage.getItem('stylist_token') || '',
  profile: null,
  bookings: [],
  notes: {}
};

const elements = {
  loginForm: document.getElementById('loginForm'),
  logoutBtn: document.getElementById('logoutBtn'),
  error: document.querySelector('[data-error]'),
  stylistName: document.querySelector('[data-stylist-name]'),
  stylistRole: document.querySelector('[data-stylist-role]'),
  bookingCount: document.querySelector('[data-booking-count]'),
  bookingList: document.getElementById('bookingList'),
  dateRange: document.querySelector('[data-date-range]'),
  noteFeed: document.getElementById('noteFeed'),
  notesSection: document.querySelector('.notes'),
  bookingTemplate: document.getElementById('bookingTemplate')
};

elements.loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const payload = {
    email: formData.get('email'),
    password: formData.get('password'),
    pin: formData.get('pin')
  };
  try {
    elements.error.textContent = '';
    const response = await apiFetch('/api/stylists/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.token = response.token;
    localStorage.setItem('stylist_token', state.token);
    state.profile = response.profile;
    event.currentTarget.reset();
    await hydrateProfile();
  } catch (error) {
    elements.error.textContent = error.message || 'Unable to sign in.';
  }
});

elements.logoutBtn.addEventListener('click', () => {
  state.token = '';
  state.profile = null;
  state.bookings = [];
  state.notes = {};
  localStorage.removeItem('stylist_token');
  renderLoggedOut();
});

async function hydrateProfile() {
  if (!state.token) {
    renderLoggedOut();
    return;
  }
  try {
    const me = await apiFetch('/api/stylists/me');
    state.profile = me.profile;
    await loadBookings();
    renderLoggedIn();
  } catch (error) {
    console.warn(error);
    renderLoggedOut();
  }
}

async function loadBookings() {
  if (!state.profile) return;
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 7);
  try {
    const response = await apiFetch(
      `/api/stylists/me/bookings?from=${start.toISOString()}&to=${end.toISOString()}`
    );
    state.bookings = response.bookings ?? [];
    state.notes = response.notes ?? {};
    renderBookings(start, end);
  } catch (error) {
    console.warn(error);
    state.bookings = [];
    state.notes = {};
    elements.bookingList.innerHTML = `<li class="empty">${escapeHtml(
      error.message || 'Unable to load bookings.'
    )}</li>`;
    elements.notesSection.hidden = true;
  }
}

function renderLoggedOut() {
  elements.loginForm.classList.remove('hidden');
  elements.logoutBtn.classList.add('hidden');
  elements.stylistName.textContent = 'Welcome';
  elements.stylistRole.textContent = 'Sign in to see your schedule.';
  elements.bookingCount.textContent = '0';
  elements.bookingList.innerHTML = '<li class="empty">Sign in to see your upcoming appointments.</li>';
  elements.notesSection.hidden = true;
}

function renderLoggedIn() {
  elements.loginForm.classList.add('hidden');
  elements.logoutBtn.classList.remove('hidden');
  elements.stylistName.textContent = state.profile.displayName || state.profile.name;
  elements.stylistRole.textContent =
    state.profile.role === 'owner' ? 'Owner access' : 'Team access · personal schedule';
}

function renderBookings(startDate, endDate) {
  elements.bookingCount.textContent = state.bookings.length.toString();
  elements.dateRange.textContent = `${formatDate(startDate)} – ${formatDate(endDate)}`;

  if (!state.bookings.length) {
    elements.bookingList.innerHTML = '<li class="empty">No bookings scheduled for this window.</li>';
  } else {
    elements.bookingList.innerHTML = '';
    state.bookings.forEach(booking => {
      const node = elements.bookingTemplate.content.firstElementChild.cloneNode(true);
      const start = new Date(booking.startAt);
      const end = new Date(booking.endAt);
      node.querySelector('[data-start]').textContent = formatTime(start);
      node.querySelector('[data-end]').textContent = formatTime(end);
      node.querySelector('[data-service]').textContent = resolveServiceLabel(booking);
      node.querySelector('[data-customer]').textContent = formatCustomer(booking.customer);
      node.querySelector('[data-meta]').textContent = `Status: ${booking.status}`;
      elements.bookingList.appendChild(node);
    });
  }

  const notes = Object.values(state.notes ?? {}).flat();
  if (notes.length) {
    elements.notesSection.hidden = false;
    elements.noteFeed.innerHTML = '';
    notes
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
      .forEach(note => {
        const noteNode = document.createElement('article');
        noteNode.className = 'note';
        noteNode.innerHTML = `
          <header>
            <span>${note.stylistName}</span>
            <time>${formatDateTime(note.createdAt)}</time>
          </header>
          <p>${escapeHtml(note.content)}</p>
        `;
        elements.noteFeed.appendChild(noteNode);
      });
  } else {
    elements.notesSection.hidden = true;
  }
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const response = await fetch(resolveEndpoint(path), {
    method: options.method ?? 'GET',
    headers,
    body: options.body ?? undefined
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = payload?.error?.message || payload?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }
  return response.json();
}

function resolveServiceLabel(booking) {
  if (!booking.segments?.length) return 'Booking';
  return booking.segments
    .map(segment => segment.serviceVariationName ?? 'Service')
    .join(', ');
}

function formatCustomer(customer) {
  if (!customer) return 'Walk-in';
  const bits = [customer.givenName, customer.familyName].filter(Boolean);
  const name = bits.join(' ').trim();
  if (customer.phoneNumber) {
    return name ? `${name} · ${customer.phoneNumber}` : customer.phoneNumber;
  }
  return name || 'Guest';
}

function resolveEndpoint(path) {
  if (!apiBase) return path;
  return `${apiBase}${path}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function formatDateTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, match => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return map[match];
  });
}

if (state.token) {
  hydrateProfile();
} else {
  renderLoggedOut();
}
