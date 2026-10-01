import React, { Suspense, lazy, useEffect, useState } from 'react'
import useStore from './store/useStore'
import MainSceneBackground from './components/ui/MainSceneBackground'
import ModalSceneBackground from './components/ui/ModalSceneBackground'
import ScrollHint from './components/ui/ScrollHint'
import HUD from './components/ui/HUD'
import LeafyMenu from './components/ui/LeafyMenu'
import CornerLeafy from './components/ui/CornerLeafy'
import LeafyChatBar from './components/ui/LeafyChatBar'
import LegalNotice, { CookieBanner, LegalLinks } from './components/ui/LegalNotice'
import SoftClouds from './components/ui/SoftClouds'
import { deferNonCritical } from './hooks/useLiteGraphics'
import { preloadCoinImages } from './utils/textureCache'
import { WL } from './styles/modalTheme'

const Scene = lazy(() => import('./components/scene/Scene'))
const Modal = lazy(() => import('./components/ui/Modal'))
const OLD_POPUPS = new Set(['shop', 'community', 'member', 'login'])

function LoadingScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: WL.modalBackdrop }}>
      <SoftClouds className="absolute inset-0" />
      <div className="relative z-10 h-44 w-44">
        <img src="/wl-logo.png" alt="" className="absolute left-1/2 top-1/2 h-full w-full object-contain" style={{ transform: 'translate(-54%, -49%)' }} />
        <div className="absolute animate-spin rounded-full" style={{ inset: '5.5%', border: '3px solid rgba(200,144,74,.28)', borderTopColor: '#c8904a' }} />
      </div>
    </div>
  )
}

export default function App() {
  const isModalOpen = useStore((s) => s.isModalOpen)
  const activeCoin = useStore((s) => s.activeCoin)
  const sceneRevealPhase = useStore((s) => s.sceneRevealPhase)
  const sceneVisible = sceneRevealPhase === 'visible'
  const oldPopup = isModalOpen && OLD_POPUPS.has(activeCoin?.id)
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
    const backup = window.setTimeout(onLeafy, 5000)
    const extra = window.setTimeout(() => setHold(false), 5000)
    return () => {
      window.removeEventListener('leafy-ready', onLeafy)
      window.clearTimeout(backup)
      window.clearTimeout(extra)
    }
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden select-none">
      <MainSceneBackground paused={!ready} />
      <div className="absolute inset-0 z-10" style={{ opacity: ready && sceneVisible && !isModalOpen ? 1 : 0, pointerEvents: !ready || isModalOpen ? 'none' : 'auto' }}>
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        {ready && !isModalOpen && <HUD />}
        {ready && !isModalOpen && <ScrollHint />}
      </div>
      {!ready && <LoadingScreen />}
      {ready && oldPopup && <ModalSceneBackground />}
      {ready && <LeafyMenu />}
      {ready && <Suspense fallback={null}><Modal /></Suspense>}
      {ready && <CornerLeafy />}
      {ready && <LeafyChatBar />}
      {ready && <CookieBanner onOpen={setLegal} />}
      {ready && <LegalLinks onOpen={setLegal} />}
      {legal && <LegalNotice page={legal} onClose={() => setLegal(null)} />}
    </div>
  )
}
