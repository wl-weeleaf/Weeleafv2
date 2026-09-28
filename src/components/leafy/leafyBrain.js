const REPLIES = [
  { test: /hej|hallo|hi|hey/i, say: 'Hej! Jeg er Leafy — WeeLeafs guide. Hvad vil du vide om fællesskabet, Hemptation eller Hive?' },
  { test: /hemp|hamp|hemptation/i, say: 'Hemptation er WLs hamp-linje: hudpleje uden unødvendig kemi og tekstiler med OEKO-TEX. Hamp vokser hurtigt, binder CO₂ og kræver ikke pesticider.' },
  { test: /hive|hus|bolig/i, say: 'WL Hive er en selvforsynende bolig med sol, vandgenbrug og Leafy som hus-assistent. Den bygges med hampbeton og er tænkt som en node i et større netværk.' },
  { test: /shop|køb|pris/i, say: 'I The Shop handler du gennem fællesskabet. Modellen giver op til 30% samlet værdi — 20% til medlemmer og 10% til nye projekter.' },
  { test: /donat|støt|1 kr/i, say: 'En symbolsk støtte på 1 krone viser, at du vil være med. Det handler om at tælle mennesker, ikke om store beløb.' },
  { test: /community|fælles|join|medlem/i, say: 'WL Community er åbent for skabere, udviklere og nysgerrige. Klik på Community- eller Login-noden, eller skriv til wl@weeleaf.com.' },
]

const FALLBACK =
  'Jeg er Leafy. Spørg om Hemptation, Hive, shoppen, donationer eller hvordan du bliver en del af WL — så peger jeg dig videre.'

export async function askLeafy(text, history = []) {
  try {
    const res = await fetch('/api/leafy-chat.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [...history.slice(-6), { role: 'user', content: text }],
      }),
    })
    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      const answer = data.choices?.[0]?.message?.content || data.reply || data.content
      if (answer) return answer
    }
  } catch {}
  const hit = REPLIES.find((r) => r.test.test(text))
  return hit ? hit.say : FALLBACK
}
