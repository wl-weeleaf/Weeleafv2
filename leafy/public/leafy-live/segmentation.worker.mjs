let segmenter,previous;
self.onmessage=async event=>{
 const {type,bitmap,timestamp}=event.data;
 try{
  if(type==='init'){
   // Classic dedicated worker: MediaPipe's Emscripten loader uses importScripts.
   const {FilesetResolver,ImageSegmenter}=await import('./vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks('/leafy-live/wasm');
   segmenter=await ImageSegmenter.createFromOptions(files,{canvas:new OffscreenCanvas(320,180),baseOptions:{modelAssetPath:'/leafy-live/selfie_segmenter.tflite',delegate:'CPU'},runningMode:'VIDEO',outputConfidenceMasks:true,outputCategoryMask:false});
   self.postMessage({type:'ready'});return;
  }
  if(type==='frame'&&segmenter){const start=performance.now();segmenter.segmentForVideo(bitmap,timestamp,result=>{
   // Selfie Segmenter has one output: foreground/person probability.
   const mask=result.confidenceMasks[0],data=mask.getAsFloat32Array(),alpha=new Uint8ClampedArray(data.length*4);
   let left=mask.width,top=mask.height,right=0,bottom=0;
   if(!previous||previous.length!==data.length)previous=new Float32Array(data.length);
   for(let i=0;i<data.length;i++){const value=Math.min(1,Math.max(0,(data[i]-.15)/.7));previous[i]=value*.8+previous[i]*.2;alpha[i*4+3]=Math.round(previous[i]*255);if(previous[i]>.4){const x=i%mask.width,y=Math.floor(i/mask.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
   self.postMessage({type:'mask',width:mask.width,height:mask.height,alpha:alpha.buffer,bounds:right>left?{x:Math.max(0,(left-5)/mask.width),y:Math.max(0,(top-5)/mask.height),right:Math.min(1,(right+6)/mask.width),bottom:Math.min(1,(bottom+6)/mask.height)}:null,ms:performance.now()-start},[alpha.buffer]);
  });}
 }catch(error){self.postMessage({type:'error',message:error.message});}finally{bitmap?.close();}
};
