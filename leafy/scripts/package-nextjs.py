from pathlib import Path
import shutil,json,zipfile
root=Path.cwd();out=root/'.sites-runtime/nextjs-package';out.mkdir(parents=True,exist_ok=True)
for name in ['app','components/leafy','components/wardrobe','components/orb','lib/livi','public/leafy','public/icons','public/camera']:
 shutil.copytree(root/name,out/name,dirs_exist_ok=True)
for name in ['public/downloads/leafy-orb-integration.zip','public/manifest.webmanifest','public/sw.js','public/offline.html','public/favicon.svg','components/ui/tabs.tsx','components/ui/button.tsx','components/ui/switch.tsx','components/ui/textarea.tsx','lib/utils.ts','public/leafy/leafy.png','public/leafy/leafy.glb','postcss.config.mjs']:
 dst=out/name;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy(root/name,dst)
pkg={'name':'leafy-nextjs','version':'1.0.0','private':True,'type':'module','scripts':{'dev':'next dev','build':'next build','start':'next start','typecheck':'tsc --noEmit'},'dependencies':{},'devDependencies':{}}
for section,names in [('dependencies',['next','react','react-dom','three','lucide-react','radix-ui','class-variance-authority','clsx','tailwind-merge']),('devDependencies',['typescript','@types/node','@types/react','@types/react-dom','@types/three','tailwindcss','@tailwindcss/postcss','tw-animate-css'])]:
 for name in names:pkg[section][name]=json.loads((root/'node_modules'/name/'package.json').read_text())['version']
(out/'package.json').write_text(json.dumps(pkg,indent=2))
ts=json.loads((root/'tsconfig.json').read_text());ts['compilerOptions']['types']=['node'];ts['exclude']=['node_modules'];(out/'tsconfig.json').write_text(json.dumps(ts,indent=2))
(out/'next-env.d.ts').write_text('/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n')
(out/'next.config.ts').write_text("import type { NextConfig } from 'next';\nconst config: NextConfig = {};\nexport default config;\n")
(out/'app/page.tsx').write_text("import Wardrobe from '@/components/wardrobe/Wardrobe';\nexport default function Home(){return <Wardrobe/>;}\n")
# The portable project does not link to its own packaging artifact.
p=out/'components/leafy/LeafyStudio.tsx';s=p.read_text();s=s.replace('<Button asChild variant="outline" className="download-code"><a href="/downloads/leafy-nextjs.zip" download><Code2 size={18}/>Hent Next.js-kode<MoveUpRight size={17}/></a></Button>','<Button asChild variant="outline" className="download-code"><a href="/leafy/leafy.glb" download><ArrowDownToLine size={18}/>Hent gemt GLB</a></Button>');p.write_text(s)
p=out/'app/layout.tsx';s=p.read_text();s=s.replace('  icons: {\n    icon: "/favicon.svg",\n    shortcut: "/favicon.svg",\n  },','');p.write_text(s)
readme=(root/'assets/leafy/NPC-INTEGRATION.md').read_text()
(out/'README.md').write_text(readme)
p=out/'components/wardrobe/Wardrobe.tsx';s=p.read_text();s=s.replace('<Button asChild variant="ghost"><a href="/downloads/leafy-nextjs.zip" download>Kildekode</a></Button>','');p.write_text(s)
with zipfile.ZipFile(root/'public/downloads/leafy-nextjs.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in out.rglob('*'):
  if p.is_file() and 'node_modules' not in p.parts and '.next' not in p.parts and not p.name.endswith('.tsbuildinfo'):z.write(p,Path('leafy-nextjs')/p.relative_to(out))
print(out)
