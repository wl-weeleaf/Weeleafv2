import React, { useState, useCallback } from 'react'
import useStore from '../../store/useStore'

function LeafyImg({ size = 72 }) {
  return (
    <img
      src="/leafy.gif"
      width={size}
      height={size}
      alt="Leafy"
      loading="lazy"
      decoding="async"
      draggable={false}
      style={{
        filter: 'drop-shadow(0 0 12px rgba(74,222,128,0.75))',
        objectFit: 'contain',
      }}
    />
  )
}

export default function LeafyAssistant() {
  const { toggleChat, isModalOpen } = useStore()
  const [cornerHovered, setCornerHovered] = useState(false)

  const handleContextMenu = useCallback(
    (e) => {
      e.preventDefault()
      toggleChat()
    },
    [toggleChat]
  )

  if (isModalOpen) return null

  return (
    <div
      className="fixed bottom-5 right-5 z-40 cursor-pointer select-none"
      onMouseEnter={() => setCornerHovered(true)}
      onMouseLeave={() => setCornerHovered(false)}
      onClick={handleContextMenu}
      onContextMenu={handleContextMenu}
      title="Klik for at tale med Leafy"
    >
      <div
        className="transition-transform duration-300"
        style={{
          transform: cornerHovered ? 'scale(1.12)' : 'scale(1)',
          animation: 'float 3.5s ease-in-out infinite',
        }}
      >
        <LeafyImg size={148} />
      </div>

      {cornerHovered && (
        <div
          className="absolute bottom-full mb-2 right-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-full border pointer-events-none"
          style={{
            background: 'rgba(6,22,14,0.85)',
            backdropFilter: 'blur(12px)',
            borderColor: 'rgba(74,222,128,0.3)',
            color: '#86efac',
          }}
        >
          Klik for at tale med Leafy
        </div>
      )}
    </div>
  )
}
