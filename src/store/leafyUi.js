import { create } from 'zustand'

const useLeafyUi = create((set) => ({
  chatOpen: false,
  menuOpen: false,
  motion: 'idle',
  follow: true,
  blink: true,
  cameraOn: false,
  cameraStatus: 'off',
  speaking: false,
  viseme: 'AA',
  orbitProgress: 0,
  language: 'da',
  openChat: () => set({ chatOpen: true, menuOpen: false }),
  closeChat: () => set({ chatOpen: false, speaking: false, viseme: 'AA' }),
  openMenu: () => set({ menuOpen: true, chatOpen: false }),
  closeMenu: () => set({ menuOpen: false }),
  setMotion: (motion) => set({ motion }),
  setFollow: (follow) => set({ follow }),
  setBlink: (blink) => set({ blink }),
  setCameraOn: (cameraOn) => set({ cameraOn }),
  setCameraStatus: (cameraStatus) => set({ cameraStatus }),
  setSpeaking: (speaking) => set({ speaking }),
  setViseme: (viseme) => set({ viseme }),
  setOrbitProgress: (orbitProgress) => set({ orbitProgress }),
  setLanguage: (language) => set({ language }),
}))

export default useLeafyUi
