import React, { useState } from 'react'
import useLeafyUi from '../../store/leafyUi'
import { getCortiConfig, setCortiConfig, testCortiAuth } from '../../lib/livi/corti'

export default function LeafyMenu() {
  const { menuOpen, closeMenu, motion, setMotion, follow, setFollow, blink, setBlink } = useLeafyUi()
  const [cfg, setCfg] = useState(() => getCortiConfig())
  const [status, setStatus] = useState('')
  if (!menuOpen) return null

  const patch = (key, value) => {
    const next = setCortiConfig({ [key]: value })
    setCfg(next)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={closeMenu}>
      <div
        className="w-full max-w-md rounded-3xl p-6 text-white shadow-2xl max-h-[90vh] overflow-y-auto"
        style={{
          background: 'rgba(8,22,12,0.92)',
          border: '1px solid rgba(74,222,128,0.28)',
          backdropFilter: 'blur(22px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-wide">Leafys rum</h2>
          <button className="text-2xl leading-none text-white/50 hover:text-white" onClick={closeMenu}>
            ×
          </button>
        </div>

        <p className="mb-3 text-sm text-white/60">Bevægelser</p>
        <div className="mb-5 flex gap-2">
          {[
            ['idle', 'Rolig'],
            ['hop', 'Hop'],
            ['still', 'Pause'],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMotion(id)}
              className="flex-1 rounded-xl border py-2 text-sm"
              style={{
                background: motion === id ? 'rgba(74,222,128,0.22)' : 'rgba(255,255,255,0.04)',
                borderColor: motion === id ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.1)',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="flex items-center justify-between py-2 text-sm">
          Følg musen
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between py-2 text-sm">
          Blink og mimik
          <input type="checkbox" checked={blink} onChange={(e) => setBlink(e.target.checked)} />
        </label>

        <p className="mb-2 mt-5 text-sm text-white/60">Corti — weeleaf-default_client</p>
        <div className="space-y-2">
          <input className="wl-cfg" placeholder="client_id" value={cfg.clientId} onChange={(e) => patch('clientId', e.target.value)} />
          <input className="wl-cfg" type="password" placeholder="client_secret" value={cfg.clientSecret} onChange={(e) => patch('clientSecret', e.target.value)} />
          <input className="wl-cfg" placeholder="tenant (fx weeleaf)" value={cfg.tenant} onChange={(e) => patch('tenant', e.target.value)} />
          <input className="wl-cfg" placeholder="environment (eu)" value={cfg.environment} onChange={(e) => patch('environment', e.target.value)} />
          <input className="wl-cfg" placeholder="model (corti-s1-instant)" value={cfg.model} onChange={(e) => patch('model', e.target.value)} />
          <input className="wl-cfg" type="password" placeholder="Corti Models API-nøgle (valgfri)" value={cfg.apiKey} onChange={(e) => patch('apiKey', e.target.value)} />
        </div>
        <button
          className="mt-3 w-full rounded-xl py-2 text-sm"
          style={{ background: 'rgba(74,222,128,0.2)', border: '1px solid rgba(74,222,128,0.35)' }}
          onClick={async () => {
            setStatus('Tester…')
            try {
              const res = await testCortiAuth()
              setStatus(`OK — token ${res.preview}`)
            } catch (err) {
              setStatus(err.message)
            }
          }}
        >
          Test Corti-login
        </button>
        {status && <p className="mt-2 text-xs text-white/60">{status}</p>}
        <style>{`.wl-cfg{width:100%;border-radius:12px;padding:8px 12px;font-size:13px;color:white;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);outline:none}`}</style>
      </div>
    </div>
  )
}
