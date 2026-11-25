import {cp,mkdir,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {zipSync} from 'fflate';

const root=process.cwd(),downloads=path.join(root,'public/downloads');
await mkdir(downloads,{recursive:true});
const filesUnder=async(dir)=>{const out=[];for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())out.push(...await filesUnder(file));else if(item.isFile())out.push(file);}return out;};
const addFiles=async(entries,files,base,prefix)=>{for(const file of files)entries[prefix+path.relative(base,file).split(path.sep).join('/')]=new Uint8Array(await readFile(file));};
const writeZip=async(name,entries)=>{const out=zipSync(entries,{level:9});await writeFile(path.join(downloads,name),out);console.log(`${name}: ${out.length} bytes`);};

// Complete source package, assembled from the current checkout and excluding generated downloads/build caches.
const listed=spawnSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'});
if(listed.status!==0)throw Error(listed.stderr||'Kunne ikke finde projektfilerne til app-zippen.');
const app={};
for(const name of listed.stdout.split(/\r?\n/).filter(Boolean)){
 if(name.startsWith('public/downloads/')||name==='tsconfig.tsbuildinfo'||name.startsWith('public/leafy-live/wasm/')||name==='public/leafy-live/vision_bundle.mjs'||name.startsWith('assets/')&&!name.endsWith('.md'))continue;
 const file=path.join(root,name);try{if((await stat(file)).isFile())app[`leafy-0.1/${name}`]=new Uint8Array(await readFile(file));}catch{}
}
await writeZip('leafy-grok-project.zip',app);
if((await stat(path.join(downloads,'leafy-grok-project.zip'))).size>26_214_400)throw Error('App-zippen er større end den understøttede downloadgrænse.');

const extension=await filesUnder(path.join(root,'integration/chrome-extension'));
const extensionZip={};await addFiles(extensionZip,extension,path.join(root,'integration/chrome-extension'),'leafy-chrome-extension/');
await writeZip('leafy-chrome-extension.zip',extensionZip);
const engine=(await filesUnder(path.join(root,'integration/browser-engine'))).filter(file=>!/^\.env(?:\.|$)/i.test(path.basename(file)));
const engineZip={};await addFiles(engineZip,engine,path.join(root,'integration/browser-engine'),'leafy-browser-engine/');
await writeZip('leafy-browser-engine.zip',engineZip);
const pc=(await filesUnder(path.join(root,'integration/pc-bridge'))).filter(file=>['connect.mjs','operations.mjs','README.md'].includes(path.basename(file)));
const pcZip={};await addFiles(pcZip,pc,path.join(root,'integration/pc-bridge'),'leafy-pc-bridge/');
await writeZip('leafy-pc-bridge.zip',pcZip);
const desktop=await filesUnder(path.join(root,'integration/desktop-agent'));
const desktopZip={};await addFiles(desktopZip,desktop,path.join(root,'integration/desktop-agent'),'leafy-desktop-agent/');
await writeZip('leafy-desktop-agent.zip',desktopZip);
const designs=await filesUnder(path.join(root,'assets'));
const designZip={};await addFiles(designZip,designs,path.join(root,'assets'),'assets/');
await writeZip('leafy-design-sources.zip',designZip);

// Small reusable actor bundle for an existing Three.js scene.
const orbOut=path.join(root,'.sites-runtime/leafy-orb-integration');
await mkdir(path.join(orbOut,'src'),{recursive:true});
for(const name of ['LeafyOrbActor.ts','OrbitGesture.ts','LeafyNPC.ts','LeafySpeech.ts','AnimatedFace.ts','createLeafy.ts','outline.json','sequence.json'])await cp(path.join(root,'components/leafy',name),path.join(orbOut,'src',name));
for(const name of ['npc-base.png','back.png','mouths/atlas.png','mouths/sequence.gif']){const target=path.join(orbOut,'public/leafy',name);await mkdir(path.dirname(target),{recursive:true});await cp(path.join(root,'public/leafy',name),target);}
await writeFile(path.join(orbOut,'README.md'),await readFile(path.join(root,'assets/leafy/ORB-INTEGRATION.md')));
await writeFile(path.join(orbOut,'package.json'),JSON.stringify({name:'leafy-orb-integration',version:'1.0.0',private:true,type:'module',peerDependencies:{three:'^0.180.0'},devDependencies:{'@types/three':'^0.180.0'},description:'Leafy actor for an existing Three.js scene; TypeScript source.'},null,2));
const orbZip={};await addFiles(orbZip,await filesUnder(orbOut),orbOut,'leafy-orb-integration/');
await writeZip('leafy-orb-integration.zip',orbZip);

// Portable Next.js model studio package (the browser-hosted Site is not embedded in the download).
const nextOut=path.join(root,'.sites-runtime/nextjs-package');
await mkdir(nextOut,{recursive:true});
for(const name of ['app','components/leafy','components/wardrobe','components/orb','lib/livi','public/leafy','public/icons','public/camera'])await cp(path.join(root,name),path.join(nextOut,name),{recursive:true,force:true});
for(const name of ['public/downloads/leafy-orb-integration.zip','public/manifest.webmanifest','public/sw.js','public/offline.html','public/favicon.svg','components/ui/tabs.tsx','components/ui/button.tsx','components/ui/switch.tsx','components/ui/textarea.tsx','lib/utils.ts','postcss.config.mjs']){const target=path.join(nextOut,name);await mkdir(path.dirname(target),{recursive:true});await cp(path.join(root,name),target);}
const packageJson={name:'leafy-nextjs',version:'1.0.0',private:true,type:'module',scripts:{dev:'next dev',build:'next build',start:'next start',typecheck:'tsc --noEmit'},dependencies:{},devDependencies:{}};
for(const [section,names] of [['dependencies',['next','react','react-dom','three','lucide-react','radix-ui','class-variance-authority','clsx','tailwind-merge']],['devDependencies',['typescript','@types/node','@types/react','@types/react-dom','@types/three','tailwindcss','@tailwindcss/postcss','tw-animate-css']]])for(const name of names){try{packageJson[section][name]=JSON.parse(await readFile(path.join(root,'node_modules',name,'package.json'),'utf8')).version;}catch{}}
await writeFile(path.join(nextOut,'package.json'),JSON.stringify(packageJson,null,2));
const ts=JSON.parse(await readFile(path.join(root,'tsconfig.json'),'utf8'));ts.compilerOptions.types=['node'];ts.exclude=['node_modules'];await writeFile(path.join(nextOut,'tsconfig.json'),JSON.stringify(ts,null,2));
await writeFile(path.join(nextOut,'next-env.d.ts'),'/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');
await writeFile(path.join(nextOut,'next.config.ts'),"import type { NextConfig } from 'next';\nconst config: NextConfig = {};\nexport default config;\n");
await writeFile(path.join(nextOut,'app/page.tsx'),"import Wardrobe from '@/components/wardrobe/Wardrobe';\nexport default function Home(){return <Wardrobe/>;}\n");
const readNext=async name=>readFile(path.join(nextOut,name),'utf8');
let studio=await readNext('components/leafy/LeafyStudio.tsx');
studio=studio.replace('<Button asChild variant="outline" className="download-code"><a href="/downloads/leafy-nextjs.zip" download><Code2 size={18}/>Hent Next.js-kode<MoveUpRight size={17}/></a></Button>','<Button asChild variant="outline" className="download-code"><a href="/leafy/leafy.glb" download><ArrowDownToLine size={18}/>Hent gemt GLB</a></Button>');
await writeFile(path.join(nextOut,'components/leafy/LeafyStudio.tsx'),studio);
let wardrobe=await readNext('components/wardrobe/Wardrobe.tsx');
wardrobe=wardrobe.replace('<Button asChild variant="ghost"><a href="/downloads/leafy-nextjs.zip" download>Kildekode</a></Button>','');
await writeFile(path.join(nextOut,'components/wardrobe/Wardrobe.tsx'),wardrobe);
let layout=await readNext('app/layout.tsx');
layout=layout.replace('  icons: {\n    icon: "/favicon.svg",\n    shortcut: "/favicon.svg",\n  },','');
await writeFile(path.join(nextOut,'app/layout.tsx'),layout);
await writeFile(path.join(nextOut,'README.md'),await readFile(path.join(root,'assets/leafy/NPC-INTEGRATION.md')));
const nextZip={};await addFiles(nextZip,await filesUnder(nextOut),nextOut,'leafy-nextjs/');
await writeZip('leafy-nextjs.zip',nextZip);

