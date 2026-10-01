import React from 'react'
import useStore from '../../store/useStore'
import ShopModal from './ShopModal'
import CommunityModal from './CommunityModal'
import MemberModal from './MemberModal'
import CoinReveal from './CoinReveal'

const OLD_POPUPS = new Set(['shop', 'community', 'member'])

export default function Modal() {
  const { activeCoin, isModalOpen, closeModal } = useStore()
  if (!isModalOpen || !activeCoin) return null
  if (activeCoin.id === 'shop') return <ShopModal coin={activeCoin} onClose={closeModal} />
  if (activeCoin.id === 'community') return <CommunityModal coin={activeCoin} onClose={closeModal} />
  if (activeCoin.id === 'member') return <MemberModal coin={activeCoin} onClose={closeModal} />
  return <CoinReveal coin={activeCoin} onClose={closeModal} />
}

export { OLD_POPUPS }
