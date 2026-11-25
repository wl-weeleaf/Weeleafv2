import {directScene} from '@/features/leafy-live/services/sceneDirector.mjs';
export function needsBoard(text:string,request=''){
 return text.length>350||(/(^|\n)(#{1,6}\s|[-*]\s|\d+[.)]\s|```)/.test(text)&&text.length>140)||text.length>100&&/fordyb|grundig|uddyb|forklar|gennemgå|præsent|visualiser/i.test(request);
}
export function roomBoardLayout(){const scene=directScene({preset:'AUTO',presenterVisible:false,activeContent:true});return {board:{x:scene.content.x,y:.18,w:scene.content.w},actor:{x:scene.leafy.x+scene.leafy.w/2,scale:.75}};}
