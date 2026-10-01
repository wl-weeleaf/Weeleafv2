import { speakWithKokoro } from '../../lib/tts/leafyTts'

export function approximateVisemes(text) {
  return Array.from(String(text).toLowerCase()).map((c) =>
    /[mbp]/.test(c) ? 'MBP' : /[fv]/.test(c) ? 'FV' : /[auæå]/.test(c) ? 'AA' : /[ei]/.test(c) ? 'EE' : /[o]/.test(c) ? 'OH' : /[yøu]/.test(c) ? 'OO' : /[ltdnrs]/.test(c) ? 'L' : 'rest'
  )
}

export class LeafySpeech {
  constructor(onState, onViseme, onError) {
    this.onState = onState
    this.onViseme = onViseme
    this.onError = onError
    this.generation = 0
    this.timer = null
    this.audio = new Audio()
  }

  cancel() {
    this.generation += 1
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.audio.pause()
    this.onState?.(false)
    this.onViseme?.('AA')
  }

  mouth(text, gen, ms) {
    const visemes = approximateVisemes(text).filter((v) => v !== 'rest')
    const step = Math.max(80, ms / Math.max(8, visemes.length))
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

  playUrl(url, text, gen) {
    this.audio.src = url
    this.audio.onplay = () => this.mouth(text, gen, (this.audio.duration || 4) * 1000)
    this.audio.onended = () => gen === this.generation && this.cancel()
    return this.audio.play()
  }

  speak(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim()
    if (!clean) return
    this.audio.play().catch(() => {})
    this.cancel()
    const gen = this.generation
    fetch('/leafy-voice.mp3')
      .then((response) => response.ok ? response.blob() : Promise.reject())
      .then((blob) => {
        if (gen !== this.generation) return
        return this.playUrl(URL.createObjectURL(blob), clean, gen)
      })
      .catch(() => speakWithKokoro({ text: clean, emotion: 'curious', speed: 0.82 }))
      .then((blob) => {
        if (gen !== this.generation || !blob) return
        if (blob instanceof Blob) return this.playUrl(URL.createObjectURL(blob), clean, gen)
      })
      .catch(() => {
        if (gen === this.generation) this.onError?.('Din lydfil leafy-voice.mp3 blev ikke fundet i public.')
      })
  }
}
