import React, { useEffect, useRef, useState } from 'react'
import useStore from '../../store/useStore'
import useLeafyUi from '../../store/leafyUi'
import LeafyChatBar from './LeafyChatBar'

function AnimatedNumber({ target, suffix }) {
  const [display, setDisplay] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    const start = Date.now()
    const duration = 1400
    const to = Number(target) || 0
    function tick() {
      const elapsed = Date.now() - start
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(Math.round(to * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target])

  return (
    <span>
      {display.toLocaleString('da-DK')}
      {suffix && <span className="ml-0.5 opacity-70 text-[0.75em]">{suffix}</span>}
    </span>
  )
}

function StatsBar({ visible }) {
  const stats = useStore((s) => s.stats)
  const activeStats = stats.filter((s) => s.value > 0 || s.alwaysShow)
  if (!visible || activeStats.length === 0) return null

  return (
    <div
      className="fixed bottom-10 left-1/2 z-30 flex -translate-x-1/2 items-center pointer-events-none"
      style={{
        background: 'rgba(20,10,6,0.55)',
        border: '1px solid rgba(200,140,80,0.22)',
        backdropFilter: 'blur(10px)',
        borderRadius: '999px',
        padding: '6px 20px',
      }}
    >
      {activeStats.map((stat, i) => (
        <React.Fragment key={stat.id}>
          {i > 0 && (
            <span className="mx-4 opacity-25 select-none" style={{ color: '#c8904a', fontSize: '0.8em' }}>|
            </span>
          )}
          <div className="flex flex-col items-center">
            <span className="wl-display text-lg tabular-nums leading-none" style={{ color: '#f0c070' }}>
              <AnimatedNumber target={stat.value} suffix={stat.suffix} />
            </span>
            <span className="wl-eyebrow mt-1 opacity-80" style={{ color: '#e8b060', fontSize: '8px' }}>
              {stat.label}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  )
}

export default function HUD() {
  const { isModalOpen, activeCoin, setActiveCoin, coins } = useStore()
  const chatOpen = useLeafyUi((s) => s.chatOpen)

  return (
    <>
      {!isModalOpen && (
        <nav className="fixed left-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2.5 md:flex">
          {coins.map((coin) => (
            <button key={coin.id} onClick={() => setActiveCoin(coin)} title={coin.subtitle} className="group relative flex items-center">
              <span
                className="block h-2 w-2 rounded-full transition-all duration-200"
                style={{
                  background: coin.color,
                  opacity: activeCoin?.id === coin.id ? 1 : 0.35,
                  transform: activeCoin?.id === coin.id ? 'scale(1.5)' : 'scale(1)',
                  boxShadow: `0 0 8px ${coin.color}`,
                }}
              />
              <span
                className="pointer-events-none absolute left-5 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium opacity-0 transition-opacity group-hover:opacity-100"
                style={{ background: 'rgba(0,0,0,0.65)', color: coin.color, backdropFilter: 'blur(6px)' }}
              >
                {coin.subtitle}
              </span>
            </button>
          ))}
        </nav>
      )}

      {chatOpen ? <LeafyChatBar /> : <StatsBar visible={!isModalOpen} />}
    </>
  )
}
