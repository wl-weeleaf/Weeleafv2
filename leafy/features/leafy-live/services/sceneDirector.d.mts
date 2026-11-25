import type {SceneLayout,LiveMode,LayoutPreset} from '../types';
export function directScene(input?:{preset?:LayoutPreset;presenterVisible?:boolean;activeContent?:boolean;audienceQuestion?:boolean;mode?:LiveMode}):SceneLayout;
export function easeLayout(current:SceneLayout,target:SceneLayout,dt:number):SceneLayout;
export function wakeCommand(text:string):string|null;
