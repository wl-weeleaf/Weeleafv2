// Return a Danish explanation without repeating potentially sensitive input.
export function memoryRejection(value: string, source: 'user' | 'leafy'): string | null {
  const text = value.normalize('NFKC');
  if (/\b\d{6}[- ]?\d{4}\b/.test(text)) return 'Fjern personnummeret fra noten.';
  if (/\b[A-Z]{2}\s?\d{2}(?:\s?[A-Z\d]){11,30}\b/i.test(text) ||
      /\b(?:reg\.?\s*(?:nr\.?)?|konto(?:nummer|nr\.?)?)\s*[:#-]?\s*\d{4,}/i.test(text) ||
      /\b\d{4}[- ]\d{7,10}\b/.test(text)) return 'Fjern bankoplysningerne fra noten.';
  for (const match of text.matchAll(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g)) {
    const digits = match[0].replace(/\D/g, '').split('').reverse().map(Number);
    const sum = digits.reduce((total, digit, i) => {
      const n = i % 2 ? digit * 2 : digit;
      return total + (n > 9 ? n - 9 : n);
    }, 0);
    if (sum % 10 === 0) return 'Fjern kortnummeret fra noten.';
  }
  if (/\b(?:sk[-_][\w-]{6,}|Bearer\s+\S+|(?:adgangskode|kodeord|password|api[-_ ]?(?:key|nøgle)|xi-api-key|token|client_secret)\s*(?:[:=]|er\b|is\b)\s*\S+)/i.test(text))
    return 'Fjern adgangskoden eller nøglen fra noten.';
  // Automated suggestions cannot be enabled until a reviewed category policy exists.
  if (source === 'leafy') return 'Automatiske hukommelsesforslag er endnu ikke aktiveret.';
  return null;
}
