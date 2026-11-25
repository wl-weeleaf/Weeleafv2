# Leafy v93 — gennemgang og rettelser (18. november 2026)

Udgangspunkt: Leafy-v92-kildekode.zip. Gennemgangen er foretaget statisk og med testsamlingen; hele appen er ikke bygget eller kørt (ingen netværk eller `node_modules` i gennemgangsmiljøet).

## Fejl rettet
1. **Tilladelser kunne løsnes af klienten.** Serveren læste ALLOW/ASK/BLOCK fra browserens `localStorage`. Nu kan `send`, `publish`, `purchase` og `delete` aldrig blive løsere end standarden på serveren (`enforcePermissionFloor` i `lib/leafy/core.ts`, brugt i `guardedAction`). Brugeren kan stadig stramme. Test: `tests/leafy-permissions.mjs`.
2. **Request-budget kunne afvise en lille handling på grund af gammel historik** (regression fra v90-ændringen, `tests/leafy-files.mjs` fejlede). Efter at udtræk er forsøgt, fjernes nu gamle afsluttede udvekslinger, før der kastes en fejl. Den aktive værktøjskæde og de seneste svar bevares så længe de kan.
3. **Resultater kunne forsvinde lydløst.** `recordEvent` slugte `localStorage`-kvotefejl (`catch{}`), så artefakter og godkendelser kunne tabes uden besked. Nu gendannes der ved kvotefejl (ældste versioner og medier beskæres først, nyeste version bevares), og `leafy-storage-error` udsendes, hvis det ikke lykkes. `removeApproval` kunne kaste en ukontrolleret fejl og er sikret.
4. **Opdateringer mistede tidligere kode.** Kun de 10 seneste artefakter på tværs af alle filer blev gemt. Nu holdes en append-only versionshistorik pr. filnavn (op til 12 versioner pr. fil, samlet budget ca. 1,2 mio. tegn, nyeste version af hver fil beskæres aldrig). `lib/leafy/versions.ts` har også `restoreVersion` (gendan som ny version) og `changeSummary`. Test: `tests/leafy-versions.mjs`. Brugerfladen til at vælge/gendanne en version er ikke tilføjet endnu.
5. **Personaen modsagde sig selv:** "kønsneutral" men "hun kun er en tekstbaseret AI". Rettet til "du", og en test forhindrer gentagelse.
6. **Testsamlingen:** `pnpm test` (`scripts/run-tests.mjs`) kører alle tests og melder SKIP (ikke PASS), hvis en pakke ikke er installeret. `tests/leafy-pc-runtime.mjs` er tilpasset den nye import.

## Nyt
- **Eval-batteri** i `evals/`: 30 danske cases (dansk, regning, ærlighed om handlinger, identitet, sikkerhed/injektion, korte svar, kilder). `pnpm eval` kører mod et OpenAI-kompatibelt endpoint (`LEAFY_EVAL_BASE_URL`, `LEAFY_EVAL_MODEL`, `LEAFY_EVAL_API_KEY`), valgfrit med `--judge` for dansk korrektur ved model. Danskkontrollen er heuristisk; brug `--judge` for grammatik. `pnpm eval:offline` kontrollerer, at batteriet fejler et bevidst dårligt svar. Kontrollerne har egen test: `tests/leafy-evals.mjs`.

## Kendt, ikke rettet
- README for v90 nævner testafhængigheder; `leafy-downloads` og `leafy-message` kræver `pnpm install` (`fflate`, `react`) og er ikke kørt her.
- Samtalearkivet (inkl. visuals) ligger stadig i `localStorage`; stort indhold kan ramme kvoten. Kræver server-side lagring.
- Tilladelsesindstillinger gemmes stadig i browseren (kun gulvet håndhæves på serveren).
- Ingen konti: besøgsidentiteten er en 30-dages cookie.
