export class IdleLife {
  wait = 3.5
  elapsed = 0
  duration = 0
  side = 1
  choice = 0
  update(dt, blocked) {
    if (blocked) {
      this.wait = 3.5
      this.elapsed = 0
      this.duration = 0
      return { x: 0, y: 0, turn: 0, event: '' }
    }
    if (this.duration === 0) {
      this.wait -= dt
      if (this.wait > 0) return { x: 0, y: 0, turn: 0, event: '' }
      this.duration = 3 + Math.random() * 2
      this.elapsed = 0
      this.side = Math.random() < 0.5 ? -1 : 1
      this.choice = (this.choice + 1) % 3
    }
    const first = this.elapsed === 0
    this.elapsed += dt
    const progress = Math.min(1, this.elapsed / this.duration)
    const envelope = Math.sin(progress * Math.PI)
    const result = {
      x: this.side * envelope * 0.9,
      y: Math.sin(progress * Math.PI * 2) * 0.3,
      turn: this.side * envelope * 0.42,
      event: first ? ['notice', 'whistle', 'wonder'][this.choice] : '',
    }
    if (progress === 1) {
      this.duration = 0
      this.wait = 5 + Math.random() * 8
    }
    return result
  }
}
