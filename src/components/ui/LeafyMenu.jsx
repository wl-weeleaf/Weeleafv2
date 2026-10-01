import React, { useState } from 'react'
import useLeafyUi from '../../store/leafyUi'
import { getCortiConfig, setCortiConfig, testCortiAuth } from '../../lib/livi/corti'

export default function LeafyMenu() {
  const { menuOpen, closeMenu, motion, setMotion, follow, setFollow, blink, setBlink, cameraOn, setCameraOn, cameraStatus, orbitProgress } = useLeafyUi()
  const [cfg, setCfg] = useState(() => getCortiConfig())
  const [status, setStatus] = useState('')
  if (!menuOpen) return null
  const patch = (key, value) => setCfg(setCortiConfig({ [key]: value }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={closeMenu}>
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl p-6 text-white shadow-2xl" style={{ background: 'rgba(8,22,12,0.92)', border: '1px solid rgba(74,222,128,0.28)' }} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Leafy</h2>
          <button className="text-2xl text-white/50" onClick={closeMenu}>×</button>
        </div>
        <p className="mb-2 text-sm text-white/60">Orbit-spin {Math.round(orbitProgress * 100)}%</p>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-emerald-400" style={{ width: `${orbitProgress * 100}%` }} /></div>
        <p className="mb-2 text-xs text-white/40">Træk to omgange samme vej rundt om noderne: hop og piruet.</p>
        <label className="flex items-center justify-between py-2 text-sm">Følg musen<input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /></label>
        <label className="flex items-center justify-between py-2 text-sm">Blink<input type="checkbox" checked={blink} onChange={(e) => setBlink(e.target.checked)} /></label>
        <label className="flex items-center justify-between py-2 text-sm">Kamera — {cameraStatus}<input type="checkbox" checked={cameraOn} onChange={(e) => setCameraOn(e.target.checked)} /></label>
        <p className="mb-2 mt-4 text-sm text-white/60">Corti — weeleaf-leafy</p>
        <div className="space-y-2">
          <input className="wl-cfg" value={cfg.clientId} onChange={(e) => patch('clientId', e.target.value)} />
          <input className="wl-cfg" type="password" placeholder="client_secret" value={cfg.clientSecret} onChange={(e) => patch('clientSecret', e.target.value)} />
          <input className="wl-cfg" value={cfg.tenant} onChange={(e) => patch('tenant', e.target.value)} />
        </div>
        <button className="mt-3 w-full rounded-xl py-2 text-sm" style={{ background: 'rgba(74,222,128,0.2)' }} onClick={async () => { setStatus('Tester…'); try { const res = await testCortiAuth(); setStatus(`OK — ${res.preview}`) } catch (err) { setStatus(err.message) } }}>Test Corti</button>
        {status && <p className="mt-2 text-xs text-white/60">{status}</p>}
        <div className="mt-4 flex gap-2">{[['idle','Rolig'],['hop','Hop'],['still','Pause']].map(([id,label]) => <button key={id} onClick={() => setMotion(id)} className="flex-1 rounded-xl border py-2 text-sm" style={{ borderColor: motion===id ? 'rgba(74,222,128,.5)' : 'rgba(255,255,255,.1)' }}>{label}</button>)}</div>
        <style>{`.wl-cfg{width:100%;border-radius:12px;padding:8px 12px;font-size:13px;color:white;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);outline:none}`}</style>
      </div>
    </div>
  )
}
