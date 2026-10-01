import React from 'react'
import useStore from '../../store/useStore'
import CoinReveal from './CoinReveal'

export default function Modal() {
  const { activeCoin, isModalOpen, closeModal } = useStore()
  if (!isModalOpen || !activeCoin) return null
  return <CoinReveal coin={activeCoin} onClose={closeModal} />
}
