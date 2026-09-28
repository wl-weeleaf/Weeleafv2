import React, { useState } from 'react'
import useLeafyUi from '../../store/leafyUi'
import { getGrokKey, setGrokKey } from '../../lib/livi/grok'

export default function LeafyMenu() {
  const { menuOpen, closeMenu, motion, setMotion, follow, setFollow, blink, setBlink } = useLeafyUi()
  const [key, setKey] = useState(() => getGrokKey())
  if (!menuOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={closeMenu}>
      <div
        className="w-full max-w-md rounded-3xl p-6 text-white shadow-2xl"
        style={{
          background: 'rgba(8,22,12,0.92)',
          border: '1px solid rgba(74,222,128,0.28)',
          backdropFilter: 'blur(22px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-wide">Leafys rum</h2>
          <button className="text-white/50 hover:text-white text-2xl leading-none" onClick={closeMenu}>
            ×
          </button>
        </div>

        <p className="text-sm text-white/60 mb-3">Bevægelser</p>
        <div className="flex gap-2 mb-5">
          {[
            ['idle', 'Rolig'],
            ['hop', 'Hop'],
            ['still', 'Pause'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMotion(id)}
              className="flex-1 rounded-xl py-2 text-sm border"
              style={{
                background: motion === id ? 'rgba(74,222,128,0.22)' : 'rgba(255,255,255,0.04)',
                borderColor: motion === id ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.1)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="text-sm text-white/60 mb-3">Indstillinger</p>
        <label className="flex items-center justify-between py-2 text-sm">
          Følg musen
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between py-2 text-sm">
          Blink og mimik
          <input type="checkbox" checked={blink} onChange={(e) => setBlink(e.target.checked)} />
        </label>

        <p className="text-sm text-white/60 mt-4 mb-2">Grok / xAI</p>
        <input
          type="password"
          placeholder="xAI API-nøgle"
          value={key}
          onChange={(e) => {
            setKey(e.target.value)
            setGrokKey(e.target.value.trim())
          }}
          className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
        />
        <p className="mt-2 text-xs text-white/40">Nøglen gemmes kun i denne browser. Hent den på console.x.ai</p>
      </div>
    </div>
  )
}
