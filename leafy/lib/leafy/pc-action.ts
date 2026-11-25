export const PC_ACTIONS=['status','list','read','search','write','implement','mkdir','open_file','open_folder','launch_program','run_command','project_scripts','run_script','install_dependencies','import_upload'] as const;
export function validatePCAction(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Ugyldig PC-handling.');const v=value as Record<string,unknown>;if(!PC_ACTIONS.includes(v.action as typeof PC_ACTIONS[number]))throw new Error('Ukendt PC-handling.');
 const path=String(v.path||'.');if(path.length>400||path.includes('\0')||path.startsWith('/')||/^[a-z]:|^\\\\|(^|[\\/])\.\.([\\/]|$)/i.test(path))throw new Error('Brug en relativ sti i den tilsluttede mappe.');
 const content=String(v.content||'');if(content.length>12000)throw new Error('Del dokumentet op i mindre filer.');
 const program=String(v.program||'');if(program&&!/^[a-z][a-z0-9-]{0,39}$/.test(program))throw new Error('Vælg et registreret programnavn.');
 const command=String(v.command||'');if(v.action==='run_command'&&!['node-version','python-version','git-status','git-diff','git-log'].includes(command))throw new Error('Vælg en af PC-forbindelsens faste terminalkommandoer.');
 const script=String(v.script||'');if(['run_script','project_scripts'].includes(String(v.action))&&script&&!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/.test(script))throw new Error('Vælg et gyldigt scriptnavn fra projektets package.json.');if(v.action==='run_script'&&!script)throw new Error('Vælg et script fra projektets package.json.');
 const uploadId=String(v.uploadId||'');if(v.action==='import_upload'&&!/^[a-f0-9-]{36}$/.test(uploadId))throw new Error('Vælg en uploadet fil.');
 let files:Record<string,string>[]|undefined;
 if(v.action==='implement'){
  if(!Array.isArray(v.files)||v.files.length<1||v.files.length>12)throw new Error('En implementering skal indeholde 1–12 færdige filer.');
  let total=0;const seen=new Set<string>();
  files=v.files.map((raw)=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Ugyldig fil i implementeringen.');const f=raw as Record<string,unknown>,p=String(f.path||''),text=String(f.content||'');if(!p||p.length>400||p.includes('\0')||p.startsWith('/')||/^[a-z]:|^\\\\|(^|[\\/])\.\.([\\/]|$)/i.test(p))throw new Error('Brug relative filstier i den tilsluttede mappe.');if(/(^|[\\/])(\.env(?:\.[^\\/]+)?|\.ssh|\.aws|\.git|\.leafy-pc-session\.json|leafy-pc\.json)([\\/]|$)/i.test(p))throw new Error('Nøgler og adgangsopsætning er ikke tilgængelige.');if(!text.trim()||text.length>12000)throw new Error('Hver fil skal indeholde 1–12.000 tegn.');const key=p.replaceAll('\\','/').toLowerCase();if(seen.has(key))throw new Error('Samme filsti optræder flere gange.');seen.add(key);total+=text.length;if(total>30000)throw new Error('En samlet implementering må højst fylde 30.000 tegn.');const expectedHash=typeof f.expectedHash==='string'?f.expectedHash.slice(0,64):'';return {path:p,content:text,...(expectedHash?{expectedHash}:{})};});
 }
 return {action:v.action,path,...(content?{content}:{}),...(files?{files}:{}),...(program?{program}:{}),...(command?{command}:{}),...(script?{script}:{}),...(uploadId?{uploadId}:{}),...(v.query?{query:String(v.query).slice(0,80)}:{}),...(typeof v.expectedHash==='string'?{expectedHash:v.expectedHash.slice(0,64)}:{})};
}
