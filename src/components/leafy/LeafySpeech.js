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
    const step = Math.max(70, ms / Math.max(8, visemes.length))
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

  speak(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim()
    if (!clean) return
    this.cancel()
    const gen = this.generation
    speakWithKokoro({ text: clean, emotion: 'curious', speed: 0.96 })
      .then((blob) => {
        if (gen !== this.generation) return
        if (!blob || blob.size < 1000) throw new Error('tom lyd')
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        this.audio = audio
        audio.onplay = () => this.mouth(clean, gen, (audio.duration || 4) * 1000)
        audio.onended = () => {
          URL.revokeObjectURL(url)
          if (gen === this.generation) this.cancel()
        }
        audio.onerror = () => this.onError?.('Stemmen kunne ikke afspilles. Teksten vises stadig.')
        return audio.play()
      })
      .catch(() => {
        if (gen === this.generation) this.onError?.('Dansk stemme svarede ikke. Teksten vises stadig.')
      })
  }
}
