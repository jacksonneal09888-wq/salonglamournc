export function applyMergeFields(value, replacements = {}) {
  if (typeof value === 'string') {
    return value.replace(/\{\{(\w+)\}\}/g, (_, token) => {
      const key = token;
      const normalized = key.toLowerCase();
      if (Object.prototype.hasOwnProperty.call(replacements, key)) {
        return replacements[key] ?? '';
      }
      if (Object.prototype.hasOwnProperty.call(replacements, normalized)) {
        return replacements[normalized] ?? '';
      }
      return '';
    });
  }
  if (Array.isArray(value)) {
    return value.map(entry => applyMergeFields(entry, replacements));
  }
  return value;
}
