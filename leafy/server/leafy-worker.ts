/// <reference types="vite/client" />
import handler from 'vinext/server/fetch-handler';
import {dispatchAPI,type ApiModule} from '../lib/leafy/api-router';
const routes=import.meta.glob('../app/api/**/route.ts',{eager:true}) as Record<string,ApiModule>;
export default {async fetch(request:Request,env:unknown,ctx:unknown){const response=await dispatchAPI(request,routes);return response||handler.fetch(request,env,ctx);}};
