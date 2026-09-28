export function deformPoint(x, y, z, t, turn, amount) {
  const tip = Math.max(0, Math.min(1, (y - 0.35) / 1.35))
  const bend = (Math.sin(t * 0.73) * 0.075 + turn * 0.08) * tip * tip * amount
  const phase = (t % 5.6) / 5.6
  const inhale =
    phase < 0.38 ? (1 - Math.cos((Math.PI * phase) / 0.38)) / 2 : (1 + Math.cos((Math.PI * (phase - 0.38)) / 0.62)) / 2
  const breath = (inhale - 0.5) * amount
  const middle = Math.max(0, 1 - ((y + 0.15) / 1.9) ** 2)
  return [
    x * (1 + breath * 0.07 * middle) + bend,
    y * (1 + breath * 0.018),
    z * (1 + breath * 0.46 * middle) + Math.sin(t * 0.61) * 0.045 * tip * tip * amount,
  ]
}
