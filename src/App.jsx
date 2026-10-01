import React, { Suspense, lazy, useEffect, useState } from 'react'
import useStore from './store/useStore'
import MainSceneBackground from './components/ui/MainSceneBackground'
import ModalSceneBackground from './components/ui/ModalSceneBackground'
import SceneTransition from './components/ui/SceneTransition'
import ScrollHint from './components/ui/ScrollHint'
import HUD from './components/ui/HUD'
import LeafyMenu from './components/ui/LeafyMenu'
import CornerLeafy from './components/ui/CornerLeafy'
import LegalNotice, { CookieBanner, LegalLinks } from './components/ui/LegalNotice'
import SoftClouds from './components/ui/SoftClouds'
import { deferNonCritical } from './hooks/useLiteGraphics'
import { preloadCoinImages } from './utils/textureCache'
import { WL } from './styles/modalTheme'

const Scene = lazy(() => import('./components/scene/Scene'))
const Modal = lazy(() => import('./components/ui/Modal'))

function LoadingScreen({ label }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center" style={{ background: WL.modalBackdrop, color: WL.text }}>
      <SoftClouds className="absolute inset-0" />
      <div className="relative z-10 flex flex-col items-center">
        <div className="relative h-44 w-44">
          <img src="/wl-logo.png" alt="WeeLeaf" className="h-full w-full object-contain" />
          <div className="absolute animate-spin rounded-full" style={{ inset: '6%', border: '3px solid rgba(200,144,74,.28)', borderTopColor: '#c8904a' }} />
        </div>
        <div className="mt-5 font-display text-2xl tracking-[0.18em]">WeeLeaf</div>
        <div className="mt-2 text-sm">{label}</div>
      </div>
    </div>
  )
}

export default function App() {
  const isModalOpen = useStore((s) => s.isModalOpen)
  const sceneRevealPhase = useStore((s) => s.sceneRevealPhase)
  const sceneVisible = sceneRevealPhase === 'visible'
  const [boot, setBoot] = useState({ api: false, leafy: false })
  const [hold, setHold] = useState(true)
  const [legal, setLegal] = useState(null)
  const ready = boot.api && boot.leafy && !hold

  useEffect(() => {
    useStore.getState().loadFromApi().finally(() => {
      deferNonCritical(() => preloadCoinImages(useStore.getState().coins))
      setBoot((s) => ({ ...s, api: true }))
    })
    const onLeafy = () => setBoot((s) => ({ ...s, leafy: true }))
    window.addEventListener('leafy-ready', onLeafy)
    const backup = window.setTimeout(onLeafy, 22000)
    const extra = window.setTimeout(() => setHold(false), 10000)
    return () => {
      window.removeEventListener('leafy-ready', onLeafy)
      window.clearTimeout(backup)
      window.clearTimeout(extra)
    }
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden select-none">
      <MainSceneBackground paused={isModalOpen || !ready} />
      <div className="absolute inset-0 z-10" style={{ opacity: ready && sceneVisible ? 1 : 0, pointerEvents: !ready || isModalOpen ? 'none' : 'auto' }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        {ready && !isModalOpen && <HUD />}
        {ready && !isModalOpen && <ScrollHint />}
      </div>
      {!ready && <LoadingScreen label={boot.api ? 'Loader Leafy' : 'Loader siden'} />}
      {ready && <SceneTransition />}
      {ready && <ModalSceneBackground />}
      {ready && <LeafyMenu />}
      {ready && <Suspense fallback={null}><Modal /></Suspense>}
      {ready && <CornerLeafy />}
      {ready && <CookieBanner onOpen={setLegal} />}
      {ready && <LegalLinks onOpen={setLegal} />}
      {legal && <LegalNotice page={legal} onClose={() => setLegal(null)} />}
    </div>
  )
}
