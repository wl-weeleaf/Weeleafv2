import { create } from 'zustand'

const useLeafyUi = create((set) => ({
  chatOpen: false,
  menuOpen: false,
  motion: 'idle',
  follow: true,
  blink: true,
  openChat: () => set({ chatOpen: true, menuOpen: false }),
  closeChat: () => set({ chatOpen: false }),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen, menuOpen: false })),
  openMenu: () => set({ menuOpen: true, chatOpen: false }),
  closeMenu: () => set({ menuOpen: false }),
  setMotion: (motion) => set({ motion }),
  setFollow: (follow) => set({ follow }),
  setBlink: (blink) => set({ blink }),
}))

export default useLeafyUi
