import {boardBounds,initialState} from '../../src/model.ts'
// Locate squares from the visible board attachment, independent of island placement.
export async function matchSquare(page,x,y,count=4,u=0){
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
 const canvas=await page.locator('#scene').boundingBox(),card=await page.locator(`.board-roster[data-universe="${u}"]`).boundingBox(),scale=Number((await page.locator('#scale').innerText()).replace('%',''))/100,angled=(await page.locator('#scene').getAttribute('data-view'))==='angled',b=boardBounds(initialState(count))
 let dx=(x-b.minX+.5)*32-(b.maxX-b.minX+1)*32-16,dy=(y-b.minY+.5)*32
 if(canvas.width<600){dx=(x-b.minX+.5)*32;dy-=(b.maxY-b.minY+1)*32+34}
 return {x:card.x-canvas.x+(dx+(angled?.16:0)*dy)*scale,y:card.y-canvas.y+dy*(angled?.82:1)*scale}
}
export async function clickMatchSquare(page,x,y,count=4,u=0){await page.locator('#scene').click({position:await matchSquare(page,x,y,count,u)})}
