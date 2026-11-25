// Camera frames stay in this worker. Only face-centre coordinates return to the UI.
let detector;
self.onmessage=async ({data})=>{
 try{
  if(data.type==='init'){
   const {FaceDetector,FilesetResolver}=await import('/leafy-live/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks('/leafy-live/wasm');
   detector=await FaceDetector.createFromOptions(files,{canvas:new OffscreenCanvas(320,240),baseOptions:{modelAssetPath:'/camera/face-short-range.tflite',delegate:'CPU'},runningMode:'IMAGE',minDetectionConfidence:.65});
   self.postMessage({type:'ready'});
  }else if(data.type==='frame'){
   try{const result=detector.detect(data.bitmap);const face=result.detections.filter(d=>d.boundingBox).sort((a,b)=>b.boundingBox.width*b.boundingBox.height-a.boundingBox.width*a.boundingBox.height)[0];
    const eyes=face?.keypoints?.slice(0,2);
    const eye=eyes?.length===2?{x:(eyes[0].x+eyes[1].x)/2,y:(eyes[0].y+eyes[1].y)/2}:null;
    const f=face?.boundingBox;
    self.postMessage({type:'face',eye,point:f?{x:1-2*(f.originX+f.width/2)/data.bitmap.width,y:1-2*(f.originY+f.height/2)/data.bitmap.height}:null});}finally{data.bitmap.close();}
  }
 }catch{self.postMessage({type:'error'});}
};
