const DEFAULT_SOCIAL = [
  {
    name: 'Instagram',
    url: 'https://www.instagram.com/salonglamournc',
    iconUrl: process.env.BRAND_ICON_INSTAGRAM ?? 'https://cdn.simpleicons.org/instagram/C13584'
  },
  {
    name: 'Facebook',
    url: 'https://www.facebook.com/salonglamournc',
    iconUrl: process.env.BRAND_ICON_FACEBOOK ?? 'https://cdn.simpleicons.org/facebook/1877F2'
  },
  {
    name: 'TikTok',
    url: 'https://www.tiktok.com/@salonglamournc',
    iconUrl: process.env.BRAND_ICON_TIKTOK ?? 'https://cdn.simpleicons.org/tiktok/000000'
  }
];

export function getBrandConfig(overrides = {}) {
  const name = process.env.BRAND_NAME ?? 'Salon Glamour NC';
  return {
    name,
    logoUrl: process.env.BRAND_LOGO_URL ?? 'https://salonglamournc.com/site-assets/logo-signature.png',
    accentColor: process.env.BRAND_PRIMARY_COLOR ?? '#CBA675',
    backgroundColor: process.env.BRAND_BACKGROUND_COLOR ?? '#fdf8f3',
    textColor: process.env.BRAND_TEXT_COLOR ?? '#1e1e1e',
    footerText:
      process.env.BRAND_FOOTER_TEXT ??
      'Salon Glamour NC • 1520 West Blvd Suite 3 • Charlotte, NC • (704) 320-2786',
    supportEmail: process.env.SUPPORT_EMAIL ?? 'frontdesk@salonglamournc.com',
    social: buildSocialLinks(),
    ...overrides
  };
}

function buildSocialLinks() {
  const raw = process.env.BRAND_SOCIAL_LINKS;
  if (!raw) return DEFAULT_SOCIAL;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(link => link?.url && link?.name).map(link => ({
        name: link.name,
        url: link.url,
        iconUrl: link.iconUrl ?? DEFAULT_SOCIAL[0].iconUrl
      }));
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_SOCIAL;
}
