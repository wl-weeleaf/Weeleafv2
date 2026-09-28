import { create } from 'zustand'
import { COINS as DEFAULT_COINS } from '../data/coinData'
import { DEFAULT_SHOP_CATEGORIES } from '../data/shopData'
import { DEFAULT_BLOG_POSTS } from '../data/blogData'
import { api, getToken, setToken, loadCachedUser, saveCachedUser } from '../api/wlApi'
import { preloadCoinImages, preloadTexture } from '../utils/textureCache'
import { centerOrbitOnCoin, orbitDeltaToCoin } from '../data/orbitState'

const DEFAULT_STATS = [
  { id: 'members', label: 'Medlemmer', value: 0, suffix: '' },
  { id: 'co2', label: 'Kg CO₂ sparet', value: 0, suffix: 'kg' },
  { id: 'donations', label: 'Donationer', value: 0, suffix: 'kr' },
]

const DEFAULT_DONATION_CONFIG = { mobilepay: '', link: '', qrImageUrl: '' }

export const SYSTEM_COIN_IDS = ['shop', 'member']

function redistributeAngles(coins) {
  const total = coins.length
  return coins.map((c, i) => ({ ...c, angle: Math.round((i / total) * 360) }))
}

function memberCoinFromDefaults(coins) {
  const def = DEFAULT_COINS.find((c) => c.id === 'member')
  if (!def) return null
  const hiveImage = coins.find((c) => c.id === 'wl-hive')?.imageUrl
  return hiveImage ? { ...def, imageUrl: hiveImage } : { ...def }
}

const useStore = create((set, get) => ({
  activeCoin: null,
  isModalOpen: false,
  /** 'visible' | 'hidden' — drives scene fade without unmounting WebGL */
  sceneRevealPhase: 'visible',
  isChatOpen: true,
  isAdminOpen: false,
  leafyPos: { x: 0, y: 0 },
  apiReady: false,
  apiError: null,

  coins: DEFAULT_COINS,
  shopCategories: DEFAULT_SHOP_CATEGORIES,
  pendingShopSubmissions: [],
  blogPosts: DEFAULT_BLOG_POSTS,
  donationConfig: DEFAULT_DONATION_CONFIG,
  stats: DEFAULT_STATS,
  githubSettings: { token: '', owner: 'filiptom888-lgtm', repo: 'Weeleafv2', branch: 'main' },
  currentUser: loadCachedUser(),

  setActiveCoin: (coin) => {
    if (!coin) {
      window.clearTimeout(get()._orbitOpenTimer)
      set({ activeCoin: null, isModalOpen: false, sceneRevealPhase: 'visible', _orbitOpenTimer: 0 })
      return
    }
    window.clearTimeout(get()._orbitOpenTimer)
    const remaining = Math.abs(orbitDeltaToCoin(coin))
    centerOrbitOnCoin(coin, { duration: 0.72, force: true })
    const wait = remaining < 2 ? 40 : 520
    const timer = window.setTimeout(() => {
      set({
        activeCoin: coin,
        isModalOpen: true,
        sceneRevealPhase: 'hidden',
        _orbitOpenTimer: 0,
      })
    }, wait)
    set({ activeCoin: coin, isModalOpen: false, sceneRevealPhase: 'visible', _orbitOpenTimer: timer })
  },
  revealScene: () => set({ sceneRevealPhase: 'visible' }),
  closeModal: () => {
    window.clearTimeout(get()._orbitOpenTimer)
    set({ activeCoin: null, isModalOpen: false, sceneRevealPhase: 'visible', modalScrollRoot: null, _orbitOpenTimer: 0 })
  },
  modalScrollRoot: null,
  setModalScrollRoot: (el) => set({ modalScrollRoot: el }),
  toggleChat: () => set((s) => ({ isChatOpen: !s.isChatOpen })),
  toggleAdmin: () => set((s) => ({ isAdminOpen: !s.isAdminOpen })),
  accountOpenTab: 'member',
  setAccountOpenTab: (tab) => set({ accountOpenTab: tab }),
  setLeafyPos: (pos) => set({ leafyPos: pos }),

  loadFromApi: async () => {
    const res = await api.fetchConfig()
    if (!res.ok) {
      set({ apiReady: false, apiError: res.error })
      get().syncSystemCoins()
      return { ok: false, error: res.error }
    }

    const data = res.data || {}
    const patch = { apiReady: true, apiError: null }

    if (Array.isArray(data.coins) && data.coins.length > 0) patch.coins = data.coins
    if (Array.isArray(data.shopCategories)) patch.shopCategories = data.shopCategories
    if (Array.isArray(data.blogPosts)) patch.blogPosts = data.blogPosts
    if (data.donationConfig) patch.donationConfig = { ...DEFAULT_DONATION_CONFIG, ...data.donationConfig }
    if (Array.isArray(data.stats) && data.stats.length > 0) patch.stats = data.stats
    if (data.github) patch.githubSettings = { ...get().githubSettings, ...data.github }

    set(patch)
    get().syncSystemCoins()

    if (getToken()) {
      const me = await api.me()
      if (me.ok && me.user) {
        saveCachedUser(me.user)
        set({ currentUser: me.user })
        const subs = await api.fetchSubmissions()
        if (subs.ok && subs.pendingShopSubmissions) {
          set({ pendingShopSubmissions: subs.pendingShopSubmissions })
        }
      } else {
        setToken('')
        saveCachedUser(null)
        set({ currentUser: null })
      }
    }

    return { ok: true }
  },

  refreshAdminData: async () => {
    const subs = await api.fetchSubmissions()
    if (subs.ok && subs.pendingShopSubmissions) {
      set({ pendingShopSubmissions: subs.pendingShopSubmissions })
    }
    const cfg = await api.fetchConfig()
    if (cfg.ok) {
      const patch = {}
      if (Array.isArray(cfg.blogPosts)) patch.blogPosts = cfg.blogPosts
      if (Array.isArray(cfg.shopCategories)) patch.shopCategories = cfg.shopCategories
      if (Object.keys(patch).length) set(patch)
    }
    return { ok: true }
  },

  registerUser: async ({ name, email, password }) => {
    const res = await api.register(name?.trim(), email?.trim(), password?.trim())
    if (!res.ok) return res
    setToken(res.token)
    saveCachedUser(res.user)
    set({ currentUser: res.user })
    const subs = await api.fetchSubmissions()
    if (subs.ok && subs.pendingShopSubmissions) {
      set({ pendingShopSubmissions: subs.pendingShopSubmissions })
    }
    return { ok: true }
  },

  loginUser: async ({ email, password }) => {
    const res = await api.login(email?.trim(), password?.trim())
    if (!res.ok) return res
    setToken(res.token)
    saveCachedUser(res.user)
    set({ currentUser: res.user })
    const subs = await api.fetchSubmissions()
    if (subs.ok && subs.pendingShopSubmissions) {
      set({ pendingShopSubmissions: subs.pendingShopSubmissions })
    }
    return { ok: true }
  },

  requestPasswordReset: async (email) => {
    const res = await api.forgotPassword(email?.trim())
    if (!res.ok) return res
    return { ok: true, message: res.message || 'Hvis e-mailen findes, sender vi et link.' }
  },

  resetPasswordWithToken: async ({ token, password }) => {
    const res = await api.resetPassword(token, password)
    if (!res.ok) return res
    setToken(res.token)
    saveCachedUser(res.user)
    set({ currentUser: res.user })
    const subs = await api.fetchSubmissions()
    if (subs.ok && subs.pendingShopSubmissions) {
      set({ pendingShopSubmissions: subs.pendingShopSubmissions })
    }
    return { ok: true }
  },

  adminLogin: async (password) => {
    const res = await api.adminLogin(password?.trim())
    if (!res.ok) return res
    setToken(res.token)
    saveCachedUser(res.user)
    set({ currentUser: res.user })
    const subs = await api.fetchSubmissions()
    if (subs.ok && subs.pendingShopSubmissions) {
      set({ pendingShopSubmissions: subs.pendingShopSubmissions })
    }
    return { ok: true }
  },

  logoutUser: async () => {
    await api.logout()
    setToken('')
    saveCachedUser(null)
    set({ currentUser: null, pendingShopSubmissions: [] })
  },

  updateUserProfile: async ({ avatarId }) => {
    const res = await api.updateProfile({ avatarId: avatarId ?? null })
    if (!res.ok) return res
    saveCachedUser(res.user)
    const userId = res.user.id
    set((s) => ({
      currentUser: res.user,
      blogPosts: s.blogPosts.map((p) =>
        p.authorId === userId
          ? {
              ...p,
              authorAvatarId: res.user.avatarId ?? null,
              authorAvatarUrl: res.user.avatarUrl ?? null,
            }
          : p
      ),
    }))
    return { ok: true }
  },

  uploadUserAvatar: async (file) => {
    const res = await api.uploadAvatar(file)
    if (!res.ok) return res
    saveCachedUser(res.user)
    const userId = res.user.id
    set((s) => ({
      currentUser: res.user,
      blogPosts: s.blogPosts.map((p) =>
        p.authorId === userId
          ? {
              ...p,
              authorAvatarId: res.user.avatarId ?? null,
              authorAvatarUrl: res.user.avatarUrl ?? null,
            }
          : p
      ),
    }))
    return { ok: true }
  },

  persistCoins: async () => {
    const { coins } = get()
    return api.saveCoins(coins)
  },

  persistLiveConfig: async () => {
    const { coins, shopCategories, donationConfig, stats } = get()
    const coinsRes = await api.saveCoins(coins)
    if (!coinsRes.ok) return { ok: false, error: coinsRes.error || 'Kunne ikke gemme noder.' }
    const shopRes = await api.saveShop(shopCategories)
    if (!shopRes.ok) return { ok: false, error: shopRes.error || 'Kunne ikke gemme shop.' }
    const donRes = await api.saveDonation(donationConfig)
    if (!donRes.ok) return { ok: false, error: donRes.error || 'Kunne ikke gemme donation.' }
    const statsRes = await api.saveStats(stats)
    if (!statsRes.ok) return { ok: false, error: statsRes.error || 'Kunne ikke gemme tæller.' }
    if (Array.isArray(coinsRes.coins) && coinsRes.coins.length > 0) {
      set({ coins: coinsRes.coins })
    }
    return { ok: true }
  },

  addCoin: async (coin) => {
    const updated = redistributeAngles([...get().coins, coin])
    set({ coins: updated })
    const created = updated[updated.length - 1]
    if (!get().apiReady) return created
    const res = await api.saveCoins(updated)
    if (!res.ok) return { ...created, saveError: res.error }
    return created
  },

  syncSystemCoins: () => {
    const { coins, addCoin, updateCoin } = get()
    const hiveImage = coins.find((c) => c.id === 'wl-hive')?.imageUrl

    const eventsCoin = coins.find((c) => c.id === 'wl-events')
    if (eventsCoin && !coins.some((c) => c.id === 'member')) {
      const memberDef = memberCoinFromDefaults(coins)
      if (memberDef) {
        updateCoin('wl-events', {
          ...memberDef,
          id: 'member',
          imageUrl: hiveImage || eventsCoin.imageUrl || memberDef.imageUrl || '',
        })
      }
    }

    for (const id of SYSTEM_COIN_IDS) {
      if (!get().coins.some((c) => c.id === id)) {
        const def = id === 'member' ? memberCoinFromDefaults(get().coins) : DEFAULT_COINS.find((c) => c.id === id)
        if (def) addCoin({ ...def })
      }
    }

    const member = get().coins.find((c) => c.id === 'member')
    const hive = get().coins.find((c) => c.id === 'wl-hive')
    if (member && hive?.imageUrl && member.imageUrl !== hive.imageUrl) {
      updateCoin('member', { imageUrl: hive.imageUrl })
    }
  },

  updateCoin: async (id, patch) => {
    const updated = get().coins.map((c) => (c.id === id ? { ...c, ...patch } : c))
    set({ coins: updated })
    if (patch.imageUrl) preloadTexture(patch.imageUrl)
    if (get().activeCoin?.id === id) {
      set({ activeCoin: updated.find((c) => c.id === id) })
    }
    if (!get().apiReady) return { ok: false, error: 'API er ikke forbundet.' }
    const res = await api.saveCoins(updated)
    if (!res.ok) return res
    if (Array.isArray(res.coins) && res.coins.length > 0) {
      set({ coins: res.coins })
    }
    return { ok: true }
  },

  deleteCoin: async (id) => {
    const updated = redistributeAngles(get().coins.filter((c) => c.id !== id))
    set({ coins: updated, activeCoin: null, isModalOpen: false })
    if (!get().apiReady) return { ok: false, error: 'API er ikke forbundet.' }
    return api.saveCoins(updated)
  },

  resetCoins: async () => {
    set({ coins: DEFAULT_COINS, activeCoin: null, isModalOpen: false })
    return api.saveCoins(DEFAULT_COINS)
  },

  persistShop: async () => api.saveShop(get().shopCategories),

  addShopCategory: (cat) => {
    const updated = [...get().shopCategories, cat]
    set({ shopCategories: updated })
    api.saveShop(updated)
  },

  updateShopCategory: (id, patch) => {
    const updated = get().shopCategories.map((c) => (c.id === id ? { ...c, ...patch } : c))
    set({ shopCategories: updated })
    api.saveShop(updated)
  },

  deleteShopCategory: (id) => {
    const updated = get().shopCategories.filter((c) => c.id !== id)
    set({ shopCategories: updated })
    api.saveShop(updated)
  },

  addShopProduct: (categoryId, product) => {
    const updated = get().shopCategories.map((c) =>
      c.id === categoryId ? { ...c, products: [...(c.products ?? []), product] } : c
    )
    set({ shopCategories: updated })
    api.saveShop(updated)
  },

  updateShopProduct: (categoryId, productId, patch) => {
    const updated = get().shopCategories.map((c) =>
      c.id === categoryId
        ? { ...c, products: (c.products ?? []).map((p) => (p.id === productId ? { ...p, ...patch } : p)) }
        : c
    )
    set({ shopCategories: updated })
    api.saveShop(updated)
  },

  deleteShopProduct: (categoryId, productId) => {
    const updated = get().shopCategories.map((c) =>
      c.id === categoryId
        ? { ...c, products: (c.products ?? []).filter((p) => p.id !== productId) }
        : c
    )
    set({ shopCategories: updated })
    api.saveShop(updated)
  },

  resetShop: async () => {
    set({ shopCategories: DEFAULT_SHOP_CATEGORIES })
    return api.saveShop(DEFAULT_SHOP_CATEGORIES)
  },

  submitShopProduct: async ({ userId, userName, userEmail, categoryId, product }) => {
    const category = get().shopCategories.find((c) => c.id === categoryId)
    if (!category) return { ok: false, error: 'Vælg en gyldig kategori.' }
    if (!product?.name?.trim()) return { ok: false, error: 'Produktnavn er påkrævet.' }

    const res = await api.submitProduct({
      userId,
      userName,
      userEmail,
      categoryId,
      categoryLabel: category.label,
      categoryIcon: category.icon,
      categoryColor: category.color,
      product: {
        id: `p-${Date.now()}`,
        name: product.name.trim(),
        desc: product.desc?.trim() || '',
        price: product.price?.trim() || '',
        imageUrl: product.imageUrl || '',
        link: product.link?.trim() || '',
      },
    })

    if (!res.ok) return res
    if (res.submission) {
      set({ pendingShopSubmissions: [res.submission, ...get().pendingShopSubmissions] })
    } else {
      await get().loadFromApi()
    }
    return { ok: true, submission: res.submission }
  },

  approveShopSubmission: async (submissionId) => {
    const res = await api.approveSubmission(submissionId)
    if (!res.ok) return res
    set({
      shopCategories: res.shopCategories ?? get().shopCategories,
      pendingShopSubmissions: res.pendingShopSubmissions ?? get().pendingShopSubmissions,
    })
    return { ok: true }
  },

  rejectShopSubmission: async (submissionId) => {
    const res = await api.rejectSubmission(submissionId)
    if (!res.ok) return res
    if (res.pendingShopSubmissions) set({ pendingShopSubmissions: res.pendingShopSubmissions })
    return { ok: true }
  },

  deleteShopSubmission: async (submissionId) => {
    const res = await api.deleteSubmission(submissionId)
    if (!res.ok) return res
    if (res.pendingShopSubmissions) set({ pendingShopSubmissions: res.pendingShopSubmissions })
    return { ok: true }
  },

  addBlogPost: async (post) => {
    const res = await api.createPost(post)
    if (!res.ok) return res
    await get().loadFromApi()
    return { ok: true }
  },

  updateBlogPost: async (id, patch) => {
    const res = await api.updatePost(id, patch)
    if (!res.ok) return res
    const updated = get().blogPosts.map((p) => (p.id === id ? { ...p, ...patch } : p))
    set({ blogPosts: updated })
    return { ok: true }
  },

  deleteBlogPost: async (id) => {
    const res = await api.deletePost(id)
    if (!res.ok) return res
    set({ blogPosts: get().blogPosts.filter((p) => p.id !== id) })
    return { ok: true }
  },

  resetBlog: async () => {
    for (const post of get().blogPosts) {
      await api.deletePost(post.id)
    }
    for (const post of DEFAULT_BLOG_POSTS) {
      await api.createPost(post)
    }
    set({ blogPosts: DEFAULT_BLOG_POSTS })
    return { ok: true }
  },

  setDonationConfig: (patch) => {
    const updated = { ...get().donationConfig, ...patch }
    set({ donationConfig: updated })
    api.saveDonation(updated)
  },

  resetDonationConfig: async () => {
    set({ donationConfig: DEFAULT_DONATION_CONFIG })
    return api.saveDonation(DEFAULT_DONATION_CONFIG)
  },

  updateStats: (patch) => {
    const updated = Array.isArray(patch)
      ? patch
      : get().stats.map((s) => (s.id === patch.id ? { ...s, ...patch } : s))
    set({ stats: updated })
    api.saveStats(updated)
  },

  resetStats: async () => {
    set({ stats: DEFAULT_STATS })
    return api.saveStats(DEFAULT_STATS)
  },

  setGithubSettings: (patch) => {
    const updated = { ...get().githubSettings, ...patch }
    set({ githubSettings: updated })
    api.saveGithub(updated)
  },

  applyRemoteConfig: (data) => {
    const patch = {}
    if (data.coins?.length) patch.coins = data.coins
    if (data.shopCategories) patch.shopCategories = data.shopCategories
    if (data.blogPosts) patch.blogPosts = data.blogPosts
    if (data.donationConfig) patch.donationConfig = data.donationConfig
    if (data.stats?.length) patch.stats = data.stats
    if (Object.keys(patch).length) set(patch)
    get().syncSystemCoins()
    preloadCoinImages(get().coins)
  },
}))

useStore.getState().syncSystemCoins()

export default useStore
