import { speakWithKokoro } from '../../lib/tts/leafyTts'

const GREETING = /hej, jeg er leafy/i

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
    this.audio = null
  }

  cancel() {
    this.generation += 1
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
      this.audio = null
    }
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

  playBlob(blob, text, gen) {
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    this.audio = audio
    audio.onplay = () => this.mouth(text, gen, (audio.duration || 4) * 1000)
    audio.onended = () => {
      URL.revokeObjectURL(url)
      if (gen === this.generation) this.cancel()
    }
    return audio.play()
  }

  speak(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim()
    if (!clean) return
    this.cancel()
    const gen = this.generation
    const voiceFile = GREETING.test(clean) ? fetch('/leafy-voice.mp3').then((r) => r.ok ? r.blob() : Promise.reject()) : Promise.reject()
    voiceFile
      .catch(() => speakWithKokoro({ text: clean, emotion: 'curious', speed: 0.82 }))
      .then((blob) => {
        if (gen !== this.generation) return
        if (!blob || blob.size < 1000) throw new Error('tom lyd')
        return this.playBlob(blob, clean, gen)
      })
      .catch((err) => {
        if (gen === this.generation) this.onError?.(err.message || 'Dansk stemme svarede ikke')
      })
  }
}
