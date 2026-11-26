// Fictitious demo data – no real cases or persons.

export const GERNINGSKODER = [
  { kode: '2760', tekst: 'Indbrud i beboelse', ord: ['indbrud', 'brudt ind', 'opbrudt'] },
  { kode: '2770', tekst: 'Tyveri af cykel', ord: ['cykel'] },
  { kode: '2730', tekst: 'Butikstyveri', ord: ['butik', 'butikstyveri'] },
  { kode: '1260', tekst: 'Simpel vold', ord: ['slag', 'vold', 'slået'] },
  { kode: '2910', tekst: 'Hærværk', ord: ['hærværk', 'graffiti', 'smadret'] },
  { kode: '2810', tekst: 'Bedrageri', ord: ['bedrag', 'svindel', 'mobilepay'] },
]

export const SAGER = [
  {
    id: '0100-80151-00412-26',
    titel: 'Indbrud i villa, Rosenvænget',
    status: 'Under efterforskning',
    prioritet: 'høj',
    frist: 'I dag',
    gerningskode: '2760',
    tidFra: '24-11-2026 08:15',
    tidTil: '24-11-2026 16:40',
    adresse: 'Rosenvænget 14',
    postnr: '8000',
    by: 'Aarhus C',
    vaerdi: '85.000 kr.',
    resume:
      'Anmelder kom hjem kl. 16:40 og fandt terrassedør opbrudt. Smykker, bærbar computer og kontanter fjernet.',
    tidslinje: [
      { tid: '24-11 17:02', type: 'Anmeldelse', tekst: 'Telefonisk anmeldelse modtaget af vagtcentral.' },
      { tid: '24-11 18:30', type: 'Patrulje', tekst: 'Patrulje 4-12 på stedet. Brugsspor sikret ved terrassedør.' },
      { tid: '25-11 10:15', type: 'Afhøring', tekst: 'Nabo (V1) så mørk varevogn holde ved nr. 12 ca. kl. 13.' },
    ],
    opgaver: [
      { tekst: 'Indhent video fra Netto, Rosenvænget 2', frist: 'Slettes om 6 dage', done: false },
      { tekst: 'Afhør V2 (genbo)', frist: 'I dag', done: false },
      { tekst: 'Send brugsspor til NKC', frist: 'Udført', done: true },
    ],
  },
  {
    id: '0100-80151-00398-26',
    titel: 'Cykeltyveri, Banegårdspladsen',
    status: 'Ny',
    prioritet: 'lav',
    frist: 'Om 5 dage',
    gerningskode: '2770',
    tidFra: '23-11-2026 07:30',
    tidTil: '23-11-2026 17:00',
    adresse: 'Banegårdspladsen 1',
    postnr: '8000',
    by: 'Aarhus C',
    vaerdi: '6.500 kr.',
    resume: 'Låst ladcykel fjernet fra cykelparkering.',
    tidslinje: [{ tid: '23-11 18:10', type: 'Anmeldelse', tekst: 'Digital anmeldelse via politi.dk.' }],
    opgaver: [{ tekst: 'Tjek stelnummer i efterlysningsregister', frist: 'Om 5 dage', done: false }],
  },
  {
    id: '0100-80151-00377-26',
    titel: 'Bedrageri via MobilePay',
    status: 'Afventer svar',
    prioritet: 'mellem',
    frist: 'Om 2 dage',
    gerningskode: '2810',
    tidFra: '19-11-2026 21:12',
    tidTil: '',
    adresse: '',
    postnr: '',
    by: '',
    vaerdi: '12.000 kr.',
    resume: 'Forurettede overførte penge til falsk sælger på Facebook Marketplace.',
    tidslinje: [
      { tid: '20-11 09:00', type: 'Anmeldelse', tekst: 'Personlig anmeldelse på station.' },
      { tid: '21-11 11:20', type: 'Edition', tekst: 'Anmodning om oplysninger sendt til MobilePay.' },
    ],
    opgaver: [{ tekst: 'Følg op på svar fra MobilePay', frist: 'Om 2 dage', done: false }],
  },
]

export const STATUS = ['Ny', 'Under efterforskning', 'Afventer svar', 'Klar til anklager']
