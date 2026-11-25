# Leafy i platformens orb — til Filip

Denne pakke er den eksisterende Leafy 3D med bagside, selvstændige øjne og mund-atlas. Den indeholder ikke en kopi af platformens orb. Demoens noder er kun en illustration. Monter Leafy i jeres eksisterende Three.js-scene med jeres eksisterende renderer, kamera og render-loop. Ingen AI-nøgle kræves for animationen.

## Filer og krav
- Kopiér `src/` til eksempelvis `components/leafy/`.
- Kopiér `public/leafy/` til Next.js-projektets `public/leafy/`.
- Three.js 0.180.x og TypeScript. Brug projektets eksisterende Three-installation; undgå to Three-versioner. Aktivér `resolveJsonModule` i tsconfig.
- Kald load i en client-komponents useEffect eller browserinitialisering. Pakken bruger canvas til mundteksturen. Der er ingen React- eller Next-afhængighed i selve aktøren.

## Integration i den eksisterende scene
```ts
import * as THREE from 'three';
import { LeafyOrbActor } from './leafy/LeafyOrbActor';

// orbRoot er jeres eksisterende gruppe med centrum for orben.
// Alle koordinater nedenfor er LOKALE til orbRoot (Y er opad).
const leafy = await LeafyOrbActor.load({
  assetBase: '/leafy',
  scale: 0.44,
  nodeTop: 0.10,  // højeste overflade blandt ALLE noder, inkl. deres radius
  clearance: 0.28, // luft mellem Leafys underkant og øverste node
  turns: 2,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
});
orbRoot.add(leafy.root); // root.x/root.z = 0: præcis i midten

const pointer = new THREE.Vector2();
let pointerActive = false, dragging = false;
function onPointer(e: PointerEvent) {
  const r = renderer.domElement.getBoundingClientRect();
  pointer.set(
    THREE.MathUtils.clamp((e.clientX-r.left)/r.width*2-1,-1,1),
    THREE.MathUtils.clamp(1-(e.clientY-r.top)/r.height*2,-1,1),
  );
  pointerActive = true;
}
const onLeave = () => { pointerActive = false; };
const onStart = () => { dragging = true; };
const onEnd = () => { dragging = false; };
window.addEventListener('pointermove', onPointer);
window.addEventListener('blur', onLeave);
controls.addEventListener('start', onStart);
controls.addEventListener('end', onEnd);

// INDE I JERES EKSISTERENDE render-loop, efter controls.update():
leafy.update(deltaSeconds, {
  pointer, pointerActive,
  azimuth: controls.getAzimuthalAngle(),
  dragging,
  viseme: 'rest', // erstat med speech.getViseme(), når Leafy taler
});
// Fortsæt med jeres renderer.render(scene, camera).

// Ved unmount (stop ikke platformens renderer eller controls):
window.removeEventListener('pointermove', onPointer);
window.removeEventListener('blur', onLeave);
controls.removeEventListener('start', onStart);
controls.removeEventListener('end', onEnd);
leafy.dispose();
```
Håndtér async load ved unmount: er komponenten allerede lukket, kald `leafy.dispose()` i stedet for at montere den. Aktivér ikke et ekstra render-loop. Kameraets azimut skal være relativt til orbRoot, hvis jeres orb-gruppe selv er roteret. Ved en specialbygget orbit kan jeres egen vinkel i radianer og isDragging sendes direkte. Automatisk rotation må aldrig sætte dragging=true.

## Placering og adfærd
Leafys underkant beregnes ud fra modellens geometri. Sæt nodeTop til højeste nodeoverflade i orbens lokale koordinater; clearance 0.28 giver plads til svæven og rotation ved standardstørrelsen. Ved større skalering øges clearance tilsvarende. Hvis noderne flytter sig: `leafy.setPlacement(newNodeTop, clearance)`. Leafys centrum forbliver på orbens X/Z-midte. Test også kameravinkler, hvis noder kan være foran figuren i skærmbilledet.

To hele brugertrukne omgange i samme retning udløser et hop på 0.75 sceneenheder og én fuld piruet på 1.35 sekunder. Vinkelgrænsen ved ±π håndteres. Retningsskift nulstiller optællingen; efter tre sekunders pause nulstilles den også. Kameraets efterløb og automatisk rotation tæller ikke. Cooldown: 2.5 sekunder. `leafy.celebrate()` kan bruges til en testknap; returnerer false under cooldown eller reduceret bevægelse. `leafy.gesture.progress` er 0–1.

`leafy.setReducedMotion(true)` stopper svæven og piruetter; øjne og rolig orientering kan stadig følge pointeren. Både demo og integration bruger samme aktørkode. Leafys mund, øjne og bagside følger med, når figuren drejer.

## Tale og mund
`LeafySpeech.ts` følger med. `speech.getViseme()` gives til `leafy.update`. Browserstemmens timing er tilnærmet. For præcis synkronisering brug `speech.play({audioUrl, visemes:[{time:0,duration:0.15,id:'MBP'}, ...]})`: tid og varighed er sekunder, og mundformen styres af lydens currentTime. Mundformer: rest, MBP, AA, EE, OH, OO, FV, L. Kald speech.dispose ved unmount. GIF'en er til inspektion; runtime bruger atlas for direkte tidsstyring.

## Afprøvning hos jer
1. Kontrollér Leafys afstand over højeste node ved alle relevante kameravinkler.
2. Bevæg musen: øjne reagerer hurtigt, hoved og krop følger blødere.
3. Træk to omgange samme vej: ét hop og én piruet, derefter normal svæven.
4. Kontrollér begge retninger, gentagelse, retningsskift, pause og rolig visning.
5. Navigér væk og tilbage: ingen ekstra canvas, animation loops eller event listeners.

Demoen er bygget og logikken testet. Platformens faktiske orb er ikke tilgængelig i dette projekt, så den endelige placering i platformen skal verificeres af Filip.
