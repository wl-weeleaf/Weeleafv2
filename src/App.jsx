import React, { Suspense, lazy, useEffect } from 'react'
import useStore from './store/useStore'
import MainSceneBackground from './components/ui/MainSceneBackground'
import ModalSceneBackground from './components/ui/ModalSceneBackground'
import SceneTransition from './components/ui/SceneTransition'
import ScrollHint from './components/ui/ScrollHint'
import HUD from './components/ui/HUD'
import LeafyMenu from './components/ui/LeafyMenu'
import { deferNonCritical } from './hooks/useLiteGraphics'
import { preloadCoinImages } from './utils/textureCache'

const Scene = lazy(() => import('./components/scene/Scene'))
const Modal = lazy(() => import('./components/ui/Modal'))
const LeafyAssistant = lazy(() => import('./components/ui/LeafyAssistant'))
const ChatBot = lazy(() => import('./components/ui/ChatBot'))

function LoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #050f08 0%, #0a1f10 50%, #061209 100%)' }}
    >
      <div className="text-center space-y-5">
        <div className="relative w-20 h-20 mx-auto">
          <div
            className="absolute inset-0 rounded-full border-2 animate-spin"
            style={{ borderColor: 'rgba(74,222,128,0.15)', borderTopColor: '#4ade80' }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-green-400 font-bold text-xs tracking-widest">WL</span>
          </div>
        </div>
        <div className="text-white font-display text-2xl tracking-[0.18em]">WeeLeaf</div>
      </div>
    </div>
  )
}

export default function App() {
  const isModalOpen = useStore((s) => s.isModalOpen)
  const sceneRevealPhase = useStore((s) => s.sceneRevealPhase)
  const sceneVisible = sceneRevealPhase === 'visible'

  useEffect(() => {
    useStore.getState().loadFromApi().then(() => {
      deferNonCritical(() => preloadCoinImages(useStore.getState().coins))
      const reset = new URLSearchParams(window.location.search).get('wl_reset')
      if (!reset) return
      const member = useStore.getState().coins.find((c) => c.id === 'member')
      if (member) useStore.getState().setActiveCoin(member)
    })
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden select-none">
      <MainSceneBackground paused={isModalOpen} />

      <div
        className="absolute inset-0 z-10"
        style={{
          opacity: sceneVisible ? 1 : 0,
          pointerEvents: isModalOpen ? 'none' : 'auto',
          transition: 'opacity 0.4s ease-out',
        }}
      >
        <Suspense fallback={<LoadingScreen />}>
          <Scene />
        </Suspense>
        <HUD />
        <ScrollHint />
      </div>

      <SceneTransition />
      <ModalSceneBackground />
      <LeafyMenu />
      <Suspense fallback={null}>
        <Modal />
        <LeafyAssistant />
        <ChatBot />
      </Suspense>
    </div>
  )
}
