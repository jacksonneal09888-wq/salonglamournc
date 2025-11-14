import { getBrandConfig } from '../brand.js';

export function buildBrandedTemplate({
  title,
  body,
  cta,
  previewText,
  highlight
} = {}) {
  const brand = getBrandConfig();
  const sections = normalizeBody(body);
  const preview = previewText ?? sections[0] ?? '';
  const ctaHtml =
    cta && cta.label && cta.url
      ? `<tr><td align="center" style="padding:32px 0;"><a href="${escapeHtml(cta.url)}" style="background:${brand.accentColor};color:#fff;text-decoration:none;padding:14px 38px;border-radius:999px;font-weight:600;display:inline-block;">${escapeHtml(cta.label)}</a></td></tr>`
      : '';
  const socialHtml = buildSocialIcons(brand.social);
  const highlightHtml = highlight
    ? `<tr><td style="background:${brand.accentColor}20;padding:18px 24px;border-radius:12px;font-size:15px;color:${brand.textColor};text-align:center;">${escapeHtml(
        highlight
      )}</td></tr>`
    : '';
  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title ?? brand.name)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font-family: 'Helvetica Neue', Arial, sans-serif; background: ${brand.backgroundColor}; color: ${
        brand.textColor
      }; margin:0; padding:0; }
      .preview-text { display:none; font-size:1px; color:${brand.backgroundColor}; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; }
      a { color: ${brand.accentColor}; }
    </style>
  </head>
  <body style="background:${brand.backgroundColor};">
    <span class="preview-text">${escapeHtml(preview)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:18px;padding:48px 56px;box-shadow:0 15px 35px rgba(0,0,0,0.06);">
            <tr>
              <td align="center" style="padding-bottom:28px;">
                <img src="${escapeHtml(
                  brand.logoUrl
                )}" alt="${escapeHtml(brand.name)}" style="max-width:180px;height:auto;" />
              </td>
            </tr>
            ${title ? `<tr><td style="font-size:24px;font-weight:700;padding-bottom:18px;text-align:center;">${escapeHtml(title)}</td></tr>` : ''}
            ${highlightHtml}
            <tr>
              <td style="font-size:16px;line-height:1.7;color:${brand.textColor};padding-top:24px;">
                ${sections.map(paragraph => `<p style="margin:0 0 16px 0;">${paragraph}</p>`).join('')}
              </td>
            </tr>
            ${ctaHtml}
            <tr>
              <td align="center" style="padding:24px 0 0 0;">${socialHtml}</td>
            </tr>
            <tr>
              <td style="padding-top:16px;font-size:13px;color:#6f6f6f;text-align:center;">${escapeHtml(
                brand.footerText
              )}
              <br />
              Need help? <a href="mailto:${escapeHtml(brand.supportEmail)}">${escapeHtml(brand.supportEmail)}</a></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  return {
    html,
    previewText: preview
  };
}

export function buildTextVersion({ title, body, cta } = {}) {
  const brand = getBrandConfig();
  const sections = normalizeBody(body).map(paragraph => stripHtml(paragraph));
  const lines = [];
  lines.push(title ?? brand.name);
  lines.push('');
  lines.push(...sections);
  if (cta?.label && cta?.url) {
    lines.push('');
    lines.push(`${cta.label}: ${cta.url}`);
  }
  lines.push('');
  lines.push(brand.footerText);
  return lines.join('\n');
}

function normalizeBody(body) {
  if (!body) return [];
  if (Array.isArray(body)) {
    return body.map(block => wrapPlainText(block));
  }
  return [wrapPlainText(body)];
}

function wrapPlainText(text) {
  if (typeof text !== 'string') return '';
  return text
    .split('\n')
    .map(line => escapeHtml(line.trim()))
    .join('<br />');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildSocialIcons(items = []) {
  if (!items.length) return '';
  const links = items
    .filter(item => item?.url)
    .map(
      item => `<a href="${escapeHtml(item.url)}" style="display:inline-block;margin:0 6px;">
        <img src="${escapeHtml(item.iconUrl ?? '')}" alt="${escapeHtml(item.name)}" style="height:28px;width:28px;" />
      </a>`
    )
    .join('');
  return `<div>${links}</div>`;
}

function stripHtml(input) {
  return String(input ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
