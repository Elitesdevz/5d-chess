const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))
export interface ThrowMotion{x:number;z:number;power:number;lift:number;turns:number}
/** Visual input only: the server has already settled the face before the throw. */
export function throwMotion(dx=0,dy=0,vx=0,vy=0,width=1000,height=800):ThrowMotion{
 const speed=Math.hypot(vx,vy),distance=Math.hypot(dx,dy),moving=speed>.08
 // The release flick wins over an earlier wind-up; a slow drag uses displacement.
 let x=moving?vx:dx/160,z=moving?vy:dy/160
 if(distance<7&&speed<.08){x=-.16;z=-1}
 const length=Math.hypot(x,z)||1;x/=length;z/=length
 const power=clamp(.22+distance/Math.max(220,Math.min(width,height)*.55)*.38+speed*.20,.22,1)
 return {x,z,power,lift:.20+power*.35,turns:7+power*13}
}
