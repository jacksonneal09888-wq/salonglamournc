(() => {
  const squareFallback = './booking/';
  const squareUrl = typeof window !== 'undefined' && window.SQUARE_URL ? window.SQUARE_URL : squareFallback;
  const phoneNumber = '+13365219528';
  const phoneDisplay = '(336) 521-9528';
  const emailAddress = 'salonglamournc@gmail.com';
  const textNumber = '+18285372413';
  const textDisplay = '(828) 537-2413';
  let scrollLockCount = 0;

  function lockScroll() {
    if (scrollLockCount === 0) {
      document.body.dataset.scrollLocked = 'true';
      document.body.style.overflow = 'hidden';
    }
    scrollLockCount += 1;
  }

  function unlockScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
      delete document.body.dataset.scrollLocked;
      document.body.style.overflow = '';
    }
  }

  function focusElement(element) {
    if (!element) return;
    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      element.focus();
    }
  }

  // Helper to update anchor attributes without clobbering other properties
  function applyLink(anchor, href, options = {}) {
    if (!anchor) return;
    anchor.setAttribute('href', href);
    const newTab = Boolean(options.newTab);
    if (newTab) {
      anchor.setAttribute('target', '_blank');
      anchor.setAttribute('rel', 'noopener');
    } else {
      anchor.removeAttribute('target');
      anchor.removeAttribute('rel');
    }
  }

  // Square booking links
  document.querySelectorAll('[data-square]').forEach(anchor => {
    applyLink(anchor, squareUrl);
  });

  // Phone links
  document.querySelectorAll('[data-phone]').forEach(anchor => {
    if (!anchor.dataset.keepText) {
      anchor.textContent = phoneDisplay;
    }
    applyLink(anchor, `tel:${phoneNumber.replace(/[^+\d]/g, '')}`);
  });

  document.querySelectorAll('[data-text]').forEach(anchor => {
    anchor.textContent = textDisplay;
    applyLink(anchor, `sms:${textNumber.replace(/[^+\d]/g, '')}`);
  });

  // Email links
  document.querySelectorAll('[data-email]').forEach(anchor => {
    anchor.textContent = emailAddress;
    applyLink(anchor, `mailto:${emailAddress}`);
  });

  // Current year in footer
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear().toString();
  }

  // Mobile navigation toggle
  const navToggle = document.querySelector('.nav-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', isOpen.toString());
    });

    navLinks.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        if (navLinks.classList.contains('open')) {
          navLinks.classList.remove('open');
          navToggle.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  // Loyalty modal
  const loyaltyModal = document.getElementById('loyaltyModal');
  const loyaltyButtons = document.querySelectorAll('[data-action="show-loyalty"]');

  function showModal() {
    if (!loyaltyModal || loyaltyModal.hidden === false) return;
    loyaltyModal.hidden = false;
    loyaltyModal.setAttribute('aria-hidden', 'false');
    loyaltyModal.querySelector('.modal-panel')?.focus();
    lockScroll();
  }

  function hideModal() {
    if (!loyaltyModal || loyaltyModal.hidden) return;
    loyaltyModal.hidden = true;
    loyaltyModal.setAttribute('aria-hidden', 'true');
    unlockScroll();
  }

  loyaltyButtons.forEach(btn => btn.addEventListener('click', showModal));
  loyaltyModal?.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', hideModal);
  });
  loyaltyModal?.addEventListener('click', event => {
    if (event.target === loyaltyModal.querySelector('.modal-backdrop')) {
      hideModal();
    }
  });

  // Gallery lightbox
  const lightbox = document.getElementById('lightbox');
  const lightboxImage = document.getElementById('lightboxImage');
  const lightboxCaption = document.getElementById('lightboxCaption');

  function openLightbox(src, caption) {
    if (!lightbox || !lightboxImage) return;
    lightboxImage.src = src;
    if (lightboxCaption) {
      lightboxCaption.textContent = caption || '';
    }
    const wasHidden = lightbox.hidden !== false;
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    if (wasHidden) {
      lockScroll();
    }
  }

  function closeLightbox() {
    if (!lightbox || !lightboxImage || lightbox.hidden) return;
    lightbox.hidden = true;
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImage.src = '';
    unlockScroll();
  }

  document.querySelectorAll('.gallery-card img').forEach(img => {
    img.addEventListener('click', () => {
      const src = img.getAttribute('data-large') || img.src;
      const caption = img.getAttribute('alt') || '';
      openLightbox(src, caption);
    });
    img.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const src = img.getAttribute('data-large') || img.src;
        const caption = img.getAttribute('alt') || '';
        openLightbox(src, caption);
      }
    });
    img.setAttribute('tabindex', '0');
  });

  lightbox?.querySelectorAll('[data-lightbox-close]').forEach(el => {
    el.addEventListener('click', closeLightbox);
  });

  lightbox?.addEventListener('click', event => {
    if (event.target === lightbox.querySelector('.lightbox-backdrop')) {
      closeLightbox();
    }
  });

  function focusSection(target) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash-highlight');
    window.setTimeout(() => el.classList.remove('flash-highlight'), 2200);
  }

  const helperWidget = document.getElementById('helperWidget');
  const helperMenu = document.getElementById('helperMenu');
  const helperToggle = document.querySelector('[data-helper-toggle]');
  const helperActions = {
    book: () => window.open(squareUrl, '_blank', 'noopener'),
    hours: () => focusSection('#contact'),
    directions: () => window.open('https://www.google.com/maps/dir/?api=1&destination=Salon+Glamour+NC', '_blank', 'noopener'),
    text: () => window.open(`sms:${textNumber.replace(/[^+\d]/g, '')}?body=Hi%20Salon%20Glamour%20NC`, '_self')
  };

  function openHelper() {
    if (!helperMenu || helperMenu.hidden === false) return;
    helperMenu.hidden = false;
    helperMenu.setAttribute('aria-hidden', 'false');
    helperToggle?.setAttribute('aria-expanded', 'true');
  }

  function closeHelper() {
    if (!helperMenu || helperMenu.hidden) return;
    helperMenu.hidden = true;
    helperMenu.setAttribute('aria-hidden', 'true');
    helperToggle?.setAttribute('aria-expanded', 'false');
  }

  helperToggle?.addEventListener('click', () => {
    if (helperMenu?.hidden) {
      openHelper();
    } else {
      closeHelper();
    }
  });

  helperMenu?.querySelectorAll('[data-helper]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.helper;
      const handler = action ? helperActions[action] : undefined;
      if (typeof handler === 'function') {
        handler();
      }
      closeHelper();
    });
  });

  document.addEventListener('click', event => {
    if (!helperWidget || helperMenu?.hidden) return;
    if (helperWidget.contains(event.target)) return;
    closeHelper();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!lightbox?.hidden) closeLightbox();
      if (!loyaltyModal?.hidden) hideModal();
      if (helperMenu && helperMenu.hidden === false) closeHelper();
    }
  });
})();
