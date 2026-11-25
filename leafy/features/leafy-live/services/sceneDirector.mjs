/** Normalised safe regions. Question has its own band; content and actors never overlap. */
export function directScene({preset='AUTO',presenterVisible=true,activeContent=false,audienceQuestion=false,mode='lecture'}={}){
 const hide={x:.5,y:.10,w:0,h:0};
 const bottom=audienceQuestion?.76:.91,top=.09,h=bottom-top;
 let p={x:.04,y:top,w:.43,h},l={x:.54,y:top,w:.42,h},c=hide;
 const content=preset==='CONTENT'||preset==='AUTO'&&activeContent;
 if(content){p={x:.01,y:.32,w:.21,h:bottom-.32};l={x:.78,y:.32,w:.21,h:bottom-.32};c={x:.245,y:.10,w:.51,h:bottom-.14};}
 else if(preset==='PRESENTER'){p={x:.04,y:top,w:.62,h};l={x:.70,y:.30,w:.26,h:bottom-.30};}
 else if(preset==='LEAFY'||preset==='AUTO'&&mode==='takeover'){p={x:.04,y:.30,w:.26,h:bottom-.30};l={x:.34,y:top,w:.62,h};}
 else if(preset==='FULL USER'){p={x:.04,y:.03,w:.92,h:bottom-.03};l={x:.99,y:top,w:0,h};}
 else if(preset==='FULL LEAFY'){p={x:0,y:top,w:0,h};l={x:.04,y:.03,w:.92,h:bottom-.03};}
 if(!presenterVisible){p={x:0,y:top,w:0,h};if(preset==='AUTO'&&!activeContent)l={x:.28,y:top,w:.44,h};}
 return {presenter:p,leafy:l,content:c,question:audienceQuestion?{x:.16,y:.80,w:.68,h:.14}:{x:.16,y:.80,w:.68,h:0}};
}
export function easeLayout(current,target,dt){const a=1-Math.exp(-Math.min(dt,.1)*6);const out={};for(const key of Object.keys(target)){out[key]={};for(const axis of ['x','y','w','h'])out[key][axis]=current[key][axis]+(target[key][axis]-current[key][axis])*a;}const left=out.presenter.w>.001?out.presenter.x+out.presenter.w+.012:0;const right=out.leafy.w>.001?out.leafy.x-.012:1;const edge=Math.min(out.content.x+out.content.w,right);out.content.x=Math.max(out.content.x,left);out.content.w=Math.max(0,edge-out.content.x);const bottom=Math.max(out.presenter.w>.001?out.presenter.y+out.presenter.h:0,out.leafy.w>.001?out.leafy.y+out.leafy.h:0,out.content.w>.001?out.content.y+out.content.h:0);out.question.y=Math.max(out.question.y,bottom+.018);return out;}
export function wakeCommand(text){const match=text.trim().match(/^(?:(?:øh|øhm|okay|ok|nå)[\s,.!?-]+)?(?:(?:hej|hey|hejsa|halløj|hallo)[\s,]+)?(?:leafy|leafie|leefi|lifey|lefy|lefi|leafi|lifi|leavy|le\s+fi|livi|livie|leevi|levy)\b[\s,.:!?-]*(.*)$/iu);return match?match[1].trim():null;}
