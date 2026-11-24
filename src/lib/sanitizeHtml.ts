/**
 * DJIFFA ACADEMY - Safe HTML Sanitizer
 * Strips active script/embed elements, event handler attributes, and unsafe URI schemes
 * before rendering admin-authored rich lesson notes.
 */

export function sanitizeLessonHtml(rawHtml: string | undefined | null): string {
  if (!rawHtml) return '';

  // Remove dangerous tags and their inner content where applicable
  let cleaned = rawHtml
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<(embed|link|meta|base|form|input|button|textarea|select)[^>]*\/?>/gi, '');

  // Strip inline event handlers like onclick=, onerror=, onload=
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Neutralize javascript:, vbscript:, data:text/html links in href/src
  cleaned = cleaned.replace(
    /\s+(href|src)\s*=\s*(?:"\s*(?:javascript|vbscript|data:text\/html)[^"]*"|'\s*(?:javascript|vbscript|data:text\/html)[^']*')/gi,
    ' $1="#"'
  );

  return cleaned;
}
