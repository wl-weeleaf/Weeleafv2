export const copy = {
  da: {
    placeholder: 'Skriv til Leafy…',
    send: 'Send',
    talk: 'Tal',
    stop: 'Stop',
    close: 'Luk',
    bubble: 'Hvad skal vi finde på i dag?',
    thinking: 'Leafy tænker…',
    fly: 'Jeg flyver derned…',
    read: 'Jeg kan læse det her op for dig.',
  },
  en: {
    placeholder: 'Write to Leafy…',
    send: 'Send',
    talk: 'Talk',
    stop: 'Stop',
    close: 'Close',
    bubble: 'What shall we do today?',
    thinking: 'Leafy is thinking…',
    fly: 'Flying down…',
    read: 'I can read this aloud.',
  },
}

export function detectLanguage(text) {
  const value = String(text || '')
  if (/[æøå]/i.test(value) || /\b(jeg|ikke|hej|og|det)\b/i.test(value)) return 'da'
  if (/\b(the|hello|what|please|you)\b/i.test(value)) return 'en'
  return null
}

export function t(lang, key) {
  return (copy[lang] || copy.da)[key] || copy.da[key] || key
}
