import React, { useState } from 'react'
import './leafyChat.css'

const CONTACT = 'privatliv@weeleaf.com'

const PAGES = {
  privacy: {
    title: 'Privatlivspolitik',
    blocks: [
      ['Dataansvarlig', 'WeeLeaf er dataansvarlig for de oplysninger, siden behandler. CVR-nummer, adresse og telefon skal stå her, når de er registreret. Indtil da kan du skrive til ' + CONTACT + '. Datatilsynet er tilsynsmyndighed, dt.dk.'],
      ['Hvad vi behandler', 'Chateksten du sender til Leafy, sproget du skriver på, samtykkevalg, og tekniske fejloplysninger. Hvis du opretter medlem, kan navn, e-mail og adgangskode blive gemt. Shop og donationer kan kræve betalingsoplysninger hos betalingsudbyderen, ikke i browserens lager. Mikrofon bruges kun, når du trykker tal. Kamera bruges kun, hvis du selv slår blik til, og billedet behandles lokalt til at følge blikket. Vi beder ikke om helbredsoplysninger.'],
      ['Formål og grundlag', 'Chatten kører for at svare dig, jf. databeskyttelsesforordningens artikel 6, stk. 1, litra b. Samtykke til mikrofon, kamera og ikke-nødvendige cookies er artikel 6, stk. 1, litra a, og kan trækkes tilbage. Nødvendig drift og sikkerhed er artikel 6, stk. 1, litra f. Leafy er en AI-guide. Svarene er automatisk genereret og er ikke en afgørelse om dig.'],
      ['Modtagere', 'Chateksten sendes til Corti i EU for at lave svaret. Tale kan laves lokalt på din computer. Vi sælger ikke oplysninger og bruger dem ikke til reklameprofiler. Overførsel ud af EU sker ikke med den nuværende Corti-opsætning i EU.'],
      ['Opbevaring', 'Samtykke og sprog ligger i din browsers lokale lager, indtil du sletter det. Chatten gemmes i den åbne session og slettes, når du lukker siden, medmindre et medlemskab senere gemmer den. Du kan bede om indsigt, rettelse, sletning, begrænsning og dataportabilitet, og du kan klage til Datatilsynet.'],
    ],
  },
  cookies: {
    title: 'Cookies og lokal lagring',
    blocks: [
      ['Regler', 'Cookiebekendtgørelsen kræver information før lagring i dit udstyr, og samtykke før alt, der ikke er strengt nødvendigt. Nødvendigt må sættes uden samtykke. Alt andet er slået fra, indtil du siger ja.'],
      ['Nødvendigt', 'wl-consent husker dit valg. Sprog og sidens tekniske tilstand ligger lokalt, så siden kan køre. Der er ingen reklame- eller statistikcookies i den nuværende version.'],
      ['Valgfrit', 'Hvis du accepterer valgfrie cookies, må siden senere huske forbedringer som foretrukken stemme. De sættes ikke nu. Du kan altid skifte til kun nødvendige.'],
    ],
  },
  terms: {
    title: 'Handelsbetingelser',
    blocks: [
      ['Om siden', 'WeeLeaf er en digital oplevelse med Leafy, medlemskab, community, shop og donationer. Aftalen indgås på dansk. Hvis du handler som forbruger, gælder forbrugeraftaleloven.'],
      ['Køb og fortrydelse', 'Digitale ydelser, der startes med det samme, kan miste fortrydelsesretten, når du udtrykkeligt beder om det og accepterer, at retten bortfalder. Fysiske varer har 14 dages fortrydelse fra modtagelsen, jf. forbrugeraftaleloven. Donationer er gaver og kan ikke fortrydes, medmindre det står ved betalingen.'],
      ['Pris og klage', 'Prisen vises, før du betaler. Klager sendes til ' + CONTACT + '. Du kan også bruge EU-klageskemaet på ec.europa.eu/consumers/odr og Center for Klageløsning.'],
    ],
  },
  disclaimer: {
    title: 'Ansvarsfraskrivelse',
    blocks: [
      ['Ikke rådgivning', 'Leafy er en AI-karakter. Svar kan være forkerte eller ufuldstændige og er ikke lægelig, juridisk, finansiel eller anden faglig rådgivning. Du må ikke bruge svarene som grundlag for beslutninger om helbred, penge eller rettigheder.'],
      ['Brug', 'Du bruger siden på eget ansvar. WeeLeaf kan ændre indhold og funktioner. Du må ikke misbruge chatten, kameraet eller andres indhold.'],
    ],
  },
  imprint: {
    title: 'Oplysningspligt',
    blocks: [
      ['E-handelsloven', 'Efter e-handelslovens § 7 skal siden vise navn, adresse, e-mail, CVR og eventuel branchetilknytning, før der indgås aftale. Sæt de oplysninger ind her, når de foreligger. Kontakt indtil da: ' + CONTACT + '.'],
      ['AI', 'Leafy er en kunstig samtalepartner. Du taler ikke med et menneske, medmindre det står udtrykkeligt.'],
    ],
  },
}

export default function LegalNotice({ page, onClose }) {
  const item = PAGES[page]
  if (!item) return null
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" style={{ background: 'rgba(4,12,8,.72)' }} onClick={onClose}>
      <article className="max-h-[80vh] max-w-xl overflow-auto rounded-3xl p-6" style={{ background: 'rgba(255,253,247,.96)', color: '#163821' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 text-xl">{item.title}</h2>
        {item.blocks.map(([heading, text]) => (
          <section key={heading} className="mb-4">
            <h3 className="text-sm font-semibold">{heading}</h3>
            <p className="text-sm leading-6">{text}</p>
          </section>
        ))}
        <button className="rounded-full px-4 py-2 text-sm" style={{ background: '#163821', color: '#fffdf7' }} onClick={onClose}>Luk</button>
      </article>
    </div>
  )
}

export function CookieBanner({ onOpen }) {
  const [choice, setChoice] = useState(() => localStorage.getItem('wl-consent'))
  function save(value) {
    localStorage.setItem('wl-consent', value)
    setChoice(value)
  }
  if (choice) {
    return (
      <button className="fixed bottom-3 left-3 z-40 text-[11px] underline" style={{ color: '#f0c070' }} onClick={() => { localStorage.removeItem('wl-consent'); setChoice('') }}>Cookies</button>
    )
  }
  return (
    <div className="wl-glass wl-cookie-bubble">
      <p className="text-sm leading-5">Jeg gemmer kun et nødvendigt samtykkevalg. Statistik og reklame er slået fra. Du kan sige nej uden at miste siden.</p>
      <div className="mt-3 flex gap-2">
        <button className="rounded-full px-3 py-1 text-sm" style={{ background: '#163821', color: '#fffdf7' }} onClick={() => save('all')}>Acceptér</button>
        <button className="rounded-full px-3 py-1 text-sm" style={{ border: '1px solid rgba(22,56,33,.35)' }} onClick={() => save('necessary')}>Kun nødvendige</button>
      </div>
      <button className="mt-2 text-xs underline" onClick={() => onOpen('cookies')}>Læs om cookies</button>
    </div>
  )
}

export function LegalLinks({ onOpen }) {
  return (
    <div className="fixed bottom-3 right-3 z-40 flex flex-wrap justify-end gap-3 text-[11px]" style={{ color: '#f0c070' }}>
      <button onClick={() => onOpen('privacy')}>Privatliv</button>
      <button onClick={() => onOpen('cookies')}>Cookies</button>
      <button onClick={() => onOpen('terms')}>Handelsbetingelser</button>
      <button onClick={() => onOpen('disclaimer')}>Disclaimer</button>
      <button onClick={() => onOpen('imprint')}>Oplysningspligt</button>
    </div>
  )
}
