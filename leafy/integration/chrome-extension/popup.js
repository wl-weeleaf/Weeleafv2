const el=id=>document.getElementById(id);
async function send(message){const response=await chrome.runtime.sendMessage(message);if(response.error)throw new Error(response.error);return response.value;}
async function run(fn){el('notice').textContent='';try{await fn();await refresh();}catch(e){el('notice').textContent=e.message;}}
async function refresh(){const s=await send({op:'status'});el('connected').hidden=!s;el('setup').hidden=!!s;const labels={AGENT_CONTROL:'Leafy har kontrollen',PROTECTED_HUMAN_CONTROL:'Venter på dig',PAUSED:'På pause',DISCONNECTED:'Forbindelsen er afbrudt'};el('status').textContent=s?`${labels[s.control]||'Du har kontrollen'}${s.error?' · '+s.error:''}`:'';}
// Ask once for all public HTTPS sites, directly from this user gesture.
el('connect').onclick=()=>run(async()=>{if(!el('code').value.trim())throw new Error('Indsæt parringskoden fra Leafy først.');const granted=await chrome.permissions.request({origins:['https://*/*']});if(!granted)throw new Error('Samlet websiteadgang blev ikke givet.');await send({op:'connect',code:el('code').value.trim()});el('code').value='';});
el('show').onclick=()=>run(()=>send({op:'show'}));
el('pause').onclick=()=>run(()=>send({op:'control',control:'PROTECTED_HUMAN_CONTROL'}));
el('resume').onclick=()=>run(()=>send({op:'control',control:'AGENT_CONTROL'}));
el('disconnect').onclick=()=>run(()=>send({op:'control',control:'DISCONNECTED'}));
void refresh();
