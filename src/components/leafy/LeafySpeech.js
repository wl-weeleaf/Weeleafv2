const IDS = ['rest', 'MBP', 'AA', 'EE', 'OH', 'OO', 'FV', 'L']

export function approximateVisemes(text) {
  return Array.from(String(text).toLowerCase()).map((c) =>
    /[mbp]/.test(c)
      ? 'MBP'
      : /[fv]/.test(c)
        ? 'FV'
        : /[auæ]/.test(c)
          ? 'AA'
          : /[ei]/.test(c)
            ? 'EE'
            : /[oå]/.test(c)
              ? 'OH'
              : /[yø]/.test(c)
                ? 'OO'
                : /[ltdnrs]/.test(c)
                  ? 'L'
                  : 'rest'
  )
}

export class LeafySpeech {
  constructor(onState, onViseme, onError) {
    this.onState = onState
    this.onViseme = onViseme
    this.onError = onError
    this.utterance = null
    this.timer = null
    this.visemes = []
    this.index = 0
  }

  cancel() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.utterance = null
    window.speechSynthesis?.cancel()
    this.onState?.(false)
    this.onViseme?.('AA')
  }

  speak(text) {
    this.cancel()
    const clean = String(text || '').trim()
    if (!clean) return
    this.visemes = approximateVisemes(clean)
    this.index = 0
    this.onState?.(true)
    this.timer = setInterval(() => {
      const id = this.visemes[this.index] || 'AA'
      this.onViseme?.(IDS.includes(id) ? id : 'AA')
      this.index += 1
      if (this.index >= this.visemes.length) {
        clearInterval(this.timer)
        this.timer = null
      }
    }, 55)
    if (!('speechSynthesis' in window)) {
      this.onError?.('Ingen talestemme i browseren.')
      setTimeout(() => this.cancel(), Math.max(1200, clean.length * 55))
      return
    }
    const u = new SpeechSynthesisUtterance(clean)
    u.lang = 'da-DK'
    u.rate = 1.02
    u.onend = () => this.cancel()
    u.onerror = () => this.cancel()
    this.utterance = u
    window.speechSynthesis.speak(u)
  }
}
