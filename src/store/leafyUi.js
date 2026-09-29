import { create } from 'zustand'

const useLeafyUi = create((set) => ({
  chatOpen: false,
  menuOpen: false,
  motion: 'idle',
  follow: true,
  blink: true,
  speaking: false,
  viseme: 'AA',
  openChat: () => set({ chatOpen: true, menuOpen: false }),
  closeChat: () => set({ chatOpen: false, speaking: false, viseme: 'AA' }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen, menuOpen: false })),
  openMenu: () => set({ menuOpen: true, chatOpen: false }),
  closeMenu: () => set({ menuOpen: false }),
  setMotion: (motion) => set({ motion }),
  setFollow: (follow) => set({ follow }),
  setBlink: (blink) => set({ blink }),
  setSpeaking: (speaking) => set({ speaking }),
  setViseme: (viseme) => set({ viseme }),
}))

export default useLeafyUi
