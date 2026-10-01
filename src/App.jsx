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
import { deferNonCritical } from './hooks/useLiteGraphics'
import { preloadCoinImages } from './utils/textureCache'

const Scene = lazy(() => import('./components/scene/Scene'))
const Modal = lazy(() => import('./components/ui/Modal'))

function LoadingScreen({ label }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center" style={{ background: 'linear-gradient(135deg, #050f08 0%, #0a1f10 50%, #061209 100%)' }}>
      <img src="/wl-logo.png" alt="WeeLeaf" className="h-28 w-28 animate-pulse rounded-full" />
      <div className="mt-5 font-display text-2xl tracking-[0.18em] text-white">WeeLeaf</div>
      <div className="mt-2 text-sm text-green-200">{label}</div>
    </div>
  )
}

export default function App() {
  const isModalOpen = useStore((s) => s.isModalOpen)
  const sceneRevealPhase = useStore((s) => s.sceneRevealPhase)
  const sceneVisible = sceneRevealPhase === 'visible'
  const [boot, setBoot] = useState({ api: false, leafy: false })
  const [legal, setLegal] = useState(null)
  const ready = boot.api && boot.leafy

  useEffect(() => {
    useStore.getState().loadFromApi().finally(() => {
      deferNonCritical(() => preloadCoinImages(useStore.getState().coins))
      setBoot((s) => ({ ...s, api: true }))
    })
    const onLeafy = () => setBoot((s) => ({ ...s, leafy: true }))
    window.addEventListener('leafy-ready', onLeafy)
    return () => window.removeEventListener('leafy-ready', onLeafy)
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
