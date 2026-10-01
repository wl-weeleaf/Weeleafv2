import React, { useState } from 'react'
import { WL } from '../../styles/modalTheme'
import { stripLeadingEmoji } from '../../utils/text'

export default function CoinReveal({ coin, onClose, children }) {
  const sections = coin.content?.sections || []
  const slides = [
    { heading: stripLeadingEmoji(coin.content?.title || coin.subtitle || ''), text: coin.content?.tagline || '' },
    ...sections.map((section) => ({
      heading: stripLeadingEmoji(section.heading || ''),
      text: section.text || (section.items || []).map((item) => item.name).join(', '),
    })),
  ].filter((slide) => slide.heading || slide.text)
  const [index, setIndex] = useState(0)
  const slide = slides[index] || slides[0]

  function move(delta) {
    setIndex((value) => Math.min(slides.length - 1, Math.max(0, value + delta)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onWheel={(e) => move(e.deltaY > 0 ? 1 : -1)}>
      <button type="button" className="wl-close fixed top-4 right-4 z-[60]" onClick={onClose} aria-label="Luk">×</button>
      <div className="relative" style={{ width: 'min(92vh, 92vw)', aspectRatio: '1', background: 'url(/wl-coin-frame.png) center/contain no-repeat', animation: 'wlCoinIn 2.4s cubic-bezier(.22,.8,.2,1)' }}>
        <div className="absolute flex flex-col items-center justify-center overflow-hidden text-center" style={{ inset: '24%', color: '#f7f1e4' }}>
          <p className="wl-eyebrow mb-2">{index + 1} / {slides.length}</p>
          {slide?.heading && <h2 className="wl-display text-2xl md:text-4xl leading-tight">{slide.heading}</h2>}
          {slide?.text && <p className="mt-3 max-w-md text-sm md:text-base leading-6">{slide.text}</p>}
          {children}
          <div className="mt-4 flex gap-2">
            <button type="button" className="rounded-full px-3 py-1 text-sm" style={{ background: '#f0c070', color: '#163821' }} onClick={() => move(-1)}>Forrige</button>
            <button type="button" className="rounded-full px-3 py-1 text-sm" style={{ background: '#f0c070', color: '#163821' }} onClick={() => move(1)}>Næste</button>
          </div>
        </div>
      </div>
    </div>
  )
}
