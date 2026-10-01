import React, { useEffect, useState } from 'react'

const PAGES = {
  privacy: {
    title: 'Privatlivspolitik',
    body: 'WeeLeaf behandler de oplysninger, du selv skriver i chatten, samt tekniske data som sprogvalg og samtykke. Chatsvar sendes til Corti i EU for at lave svaret. Mikrofon bruges kun, når du trykker tal, og kamera bruges kun, hvis du selv slår blik til. Vi sælger ikke dine oplysninger. Du kan bede om indsigt eller sletning ved at skrive til siden. Retsgrundlag er samtykke og den aftale, der opstår, når du bruger chatten.',
  },
  cookies: {
    title: 'Cookies',
    body: 'Nødvendige cookies husker dit samtykke og holder siden kørende. Valgfrie cookies bruges ikke, før du siger ja. Du kan ændre valget i cookie-banneret. Lokal lagring bruges til sprog, samtykke og indstillinger på din egen enhed.',
  },
  disclaimer: {
    title: 'Disclaimer',
    body: 'WeeLeaf og Leafy er en digital oplevelse, ikke rådgivning. Svar fra Leafy kan være ufuldstændige eller forkerte og er ikke lægelig, juridisk eller finansiel rådgivning. Du bruger siden på eget ansvar. Indhold kan ændres uden varsel.',
  },
}

export default function LegalNotice({ page, onClose }) {
  const item = PAGES[page]
  if (!item) return null
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: 'rgba(4,12,8,.72)' }} onClick={onClose}>
      <article className="max-w-lg rounded-3xl p-6" style={{ background: 'rgba(255,253,247,.94)', color: '#163821' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-xl">{item.title}</h2>
        <p className="text-sm leading-6">{item.body}</p>
        <button className="mt-4 rounded-full px-4 py-2 text-sm" style={{ background: '#163821', color: '#fffdf7' }} onClick={onClose}>Luk</button>
      </article>
    </div>
  )
}

export function CookieBanner({ onOpen }) {
  const [choice, setChoice] = useState(() => localStorage.getItem('wl-consent'))
  if (choice) return (
    <button className="fixed bottom-3 left-3 z-40 text-[11px] underline" style={{ color: '#f0c070' }} onClick={() => onOpen('cookies')}>Cookies</button>
  )
  return (
    <div className="fixed bottom-4 left-4 z-[110] max-w-sm rounded-3xl p-4" style={{ background: 'rgba(20,10,6,.88)', color: '#fffdf7', border: '1px solid rgba(240,192,112,.35)' }}>
      <p className="text-sm leading-5">Vi bruger en nødvendig cookie til samtykke. Valgfrie cookies er slået fra, indtil du siger ja.</p>
      <div className="mt-3 flex gap-2">
        <button className="rounded-full px-3 py-1 text-sm" style={{ background: '#f0c070', color: '#163821' }} onClick={() => { localStorage.setItem('wl-consent', 'all'); setChoice('all') }}>Acceptér</button>
        <button className="rounded-full px-3 py-1 text-sm" style={{ border: '1px solid rgba(255,253,247,.4)' }} onClick={() => { localStorage.setItem('wl-consent', 'necessary'); setChoice('necessary') }}>Kun nødvendige</button>
      </div>
      <button className="mt-2 text-xs underline" onClick={() => onOpen('privacy')}>Læs privatlivspolitik</button>
    </div>
  )
}

export function LegalLinks({ onOpen }) {
  return (
    <div className="fixed bottom-3 right-3 z-40 flex gap-3 text-[11px]" style={{ color: '#f0c070' }}>
      <button onClick={() => onOpen('privacy')}>Privatliv</button>
      <button onClick={() => onOpen('cookies')}>Cookies</button>
      <button onClick={() => onOpen('disclaimer')}>Disclaimer</button>
    </div>
  )
}
