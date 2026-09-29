const IDS = ['rest', 'MBP', 'AA', 'EE', 'OH', 'OO', 'FV', 'L']

export function approximateVisemes(text) {
  return Array.from(String(text).toLowerCase()).map((c) =>
    /[mbp]/.test(c)
      ? 'MBP'
      : /[fv]/.test(c)
        ? 'FV'
        : /[auæå]/.test(c)
          ? 'AA'
          : /[ei]/.test(c)
            ? 'EE'
            : /[o]/.test(c)
              ? 'OH'
              : /[yøu]/.test(c)
                ? 'OO'
                : /[ltdnrs]/.test(c)
                  ? 'L'
                  : 'rest'
  )
}

function pickVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || []
  const score = (v) => {
    const n = `${v.lang} ${v.name}`.toLowerCase()
    if (n.includes('da-dk') || n.includes('danish') || n.includes('dansk')) return 5
    if (n.includes('nb-') || n.includes('sv-') || n.includes('no-')) return 3
    if (n.includes('en-gb')) return 2
    if (n.includes('en')) return 1
    return 0
  }
  return [...voices].sort((a, b) => score(b) - score(a))[0] || null
}

export class LeafySpeech {
  constructor(onState, onViseme, onError) {
    this.onState = onState
    this.onViseme = onViseme
    this.onError = onError
    this.utterance = null
    this.timer = null
    this.generation = 0
    if (window.speechSynthesis && !window.speechSynthesis.getVoices().length) {
      window.speechSynthesis.addEventListener('voiceschanged', () => pickVoice())
    }
  }

  cancel() {
    this.generation += 1
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.utterance = null
    try {
      window.speechSynthesis?.cancel()
    } catch {}
    this.onState?.(false)
    this.onViseme?.('AA')
  }

  speak(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim()
    if (!clean) return
    this.cancel()
    const gen = this.generation
    const visemes = approximateVisemes(clean).filter((v) => v !== 'rest')
    const step = Math.max(70, Math.min(140, 1800 / Math.max(8, visemes.length)))

    const startMouth = () => {
      if (gen !== this.generation) return
      let i = 0
      this.onState?.(true)
      this.onViseme?.(visemes[0] || 'AA')
      this.timer = setInterval(() => {
        if (gen !== this.generation) return
        i += 1
        this.onViseme?.(visemes[i] || 'AA')
        if (i >= visemes.length) {
          clearInterval(this.timer)
          this.timer = null
        }
      }, step)
    }

    if (!('speechSynthesis' in window)) {
      this.onError?.('Ingen talestemme i browseren.')
      startMouth()
      setTimeout(() => gen === this.generation && this.cancel(), visemes.length * step + 400)
      return
    }

    window.setTimeout(() => {
      if (gen !== this.generation) return
      const u = new SpeechSynthesisUtterance(clean)
      const voice = pickVoice()
      if (voice) u.voice = voice
      u.lang = voice?.lang || 'da-DK'
      u.rate = 1.02
      u.pitch = 1.05
      u.volume = 1
      u.onstart = () => startMouth()
      u.onend = () => {
        if (gen === this.generation) this.cancel()
      }
      u.onerror = () => {
        if (gen === this.generation) {
          startMouth()
          setTimeout(() => gen === this.generation && this.cancel(), visemes.length * step + 400)
        }
      }
      this.utterance = u
      window.speechSynthesis.resume()
      window.speechSynthesis.speak(u)
      window.setTimeout(() => {
        if (gen === this.generation && !this.timer) startMouth()
      }, 400)
    }, 80)
  }
}
