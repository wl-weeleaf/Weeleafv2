import {copyFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=process.cwd(),source=resolve(root,'node_modules/@mediapipe/tasks-vision'),target=resolve(root,'public/leafy-live');
await mkdir(resolve(target,'wasm'),{recursive:true});
await copyFile(resolve(source,'vision_bundle.mjs'),resolve(target,'vision_bundle.mjs'));
for(const name of ['vision_wasm_internal.js','vision_wasm_internal.wasm','vision_wasm_nosimd_internal.js','vision_wasm_nosimd_internal.wasm'])await copyFile(resolve(source,'wasm',name),resolve(target,'wasm',name));
console.log('Leafy Live: lokale MediaPipe-runtimefiler klar.');

