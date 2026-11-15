/** Presentation only. Simulation and saved positions stay in logical coordinates. */
export interface BoardProjection {shear:number;tilt:number}
export const FLAT_VIEW:BoardProjection={shear:0,tilt:1}
export const ANGLED_VIEW:BoardProjection={shear:.16,tilt:.82}
export const project=(p:{x:number;y:number},view:BoardProjection)=>({x:p.x+view.shear*p.y,y:p.y*view.tilt})
export const unproject=(p:{x:number;y:number},view:BoardProjection)=>({x:p.x-view.shear*p.y/view.tilt,y:p.y/view.tilt})
export function projectedBounds(width:number,height:number,view:BoardProjection){return {width:width+Math.abs(view.shear)*height,height:height*view.tilt}}
