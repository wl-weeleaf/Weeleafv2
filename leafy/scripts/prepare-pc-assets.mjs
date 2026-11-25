import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {zipSync} from 'fflate';
const files={};
for(const name of ['connect.mjs','operations.mjs','README.md']) files['leafy-pc-bridge/'+name]=new Uint8Array(await readFile(new URL('../integration/pc-bridge/'+name,import.meta.url)));
await mkdir(new URL('../public/downloads/',import.meta.url),{recursive:true});
await writeFile(new URL('../public/downloads/leafy-pc-bridge.zip',import.meta.url),zipSync(files));
console.log('Leafy PC: downloadpakke klar.');
