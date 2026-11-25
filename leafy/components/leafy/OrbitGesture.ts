/** Accumulates real user-driven turns, not automatic rotation or camera damping. */
export class OrbitGesture {
 private last:number|null=null;private travel=0;private direction=0;private idle=0;
 constructor(readonly turns=2){if(!Number.isFinite(turns)||turns<=0)throw Error('turns must be positive');}
 reset(){this.last=null;this.travel=0;this.direction=0;this.idle=0;}
 get progress(){return Math.min(1,this.travel/(Math.PI*2*this.turns));}
 update(angle:number,dragging:boolean,dt:number){
  if(!Number.isFinite(angle))return false;
  const old=this.last;this.last=angle;
  if(!dragging){this.idle+=dt;if(this.idle>3){this.travel=0;this.direction=0;}return false;}
  this.idle=0;if(old===null)return false;
  const delta=Math.atan2(Math.sin(angle-old),Math.cos(angle-old));if(Math.abs(delta)<.0001)return false;
  const sign=Math.sign(delta);if(this.direction&&sign!==this.direction)this.travel=0;
  this.direction=sign;this.travel+=Math.abs(delta);
  if(this.progress>=1){this.travel=0;return true;}return false;
 }
}
