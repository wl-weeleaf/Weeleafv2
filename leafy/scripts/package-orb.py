from pathlib import Path
import shutil,zipfile,json
root=Path.cwd();out=root/'.sites-runtime/leafy-orb-integration'
if out.exists():shutil.rmtree(out)
(out/'src').mkdir(parents=True)
for name in ['LeafyOrbActor.ts','OrbitGesture.ts','LeafyNPC.ts','LeafySpeech.ts','AnimatedFace.ts','createLeafy.ts','outline.json','sequence.json']:
 shutil.copy(root/'components/leafy'/name,out/'src'/name)
for name in ['npc-base.png','back.png','mouths/atlas.png','mouths/sequence.gif']:
 target=out/'public/leafy'/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy(root/'public/leafy'/name,target)
shutil.copy(root/'assets/leafy/ORB-INTEGRATION.md',out/'README.md')
(out/'package.json').write_text(json.dumps({'name':'leafy-orb-integration','version':'1.0.0','private':True,'type':'module','peerDependencies':{'three':'^0.180.0'},'devDependencies':{'@types/three':'^0.180.0'},'description':'Leafy actor for an existing Three.js scene; TypeScript source.'},indent=2))
with zipfile.ZipFile(root/'public/downloads/leafy-orb-integration.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in out.rglob('*'):
  if p.is_file():z.write(p,Path('leafy-orb-integration')/p.relative_to(out))
print('Packaged Leafy actor, textures, mouth atlas and integration guide.')
