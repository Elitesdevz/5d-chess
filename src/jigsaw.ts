import {PUZZLE_SIZE} from './world/arcade.ts'
type Puzzle={tiles:number[];placed:boolean[]}
const COLS=40,ROWS=25,SIDE=5,UNIT=44
function panorama(){
  const canvas=document.createElement('canvas')
  canvas.width=COLS*UNIT;canvas.height=ROWS*UNIT
  const c=canvas.getContext('2d')!,w=canvas.width,h=canvas.height
  const sky=c.createLinearGradient(0,0,w,h)
  sky.addColorStop(0,'#183856');sky.addColorStop(.54,'#ee9b79');sky.addColorStop(1,'#f7ce80')
  c.fillStyle=sky;c.fillRect(0,0,w,h)
  for(let i=0;i<210;i++){
    const x=(i*137.51)%w,y=(i*i*47)%620
    c.fillStyle='#fff2c7';c.beginPath();c.arc(x,y,1+i%4,0,Math.PI*2);c.fill()
  }
  c.fillStyle='#ffcf7a';c.beginPath();c.arc(w*.74,h*.32,115,0,Math.PI*2);c.fill()
  for(let layer=0;layer<3;layer++){
    c.fillStyle=['#777897','#63556c','#354b62'][layer];c.beginPath();c.moveTo(0,h)
    for(let x=0;x<=w;x+=8)c.lineTo(x,h*(.48+.09*layer)+Math.sin(x*.011+layer)*53+Math.cos(x*.023-layer)*24)
    c.lineTo(w,h);c.fill()
  }
  for(let i=0;i<43;i++){
    const x=i*w/43,y=h*(.68+.09*Math.sin(i*7))
    c.fillStyle=['#285666','#573f54','#635053'][i%3];c.fillRect(x,y,w/43-2,h-y)
    c.fillStyle='#e4b373'
    for(let a=0;a<3;a++)for(let b=0;b<8;b++)if((a+b+i)%4)c.fillRect(x+4+a*12,y+9+b*19,5,7)
  }
  c.strokeStyle='#77b5b5';c.lineWidth=5
  for(let i=0;i<24;i++){c.beginPath();c.moveTo(i*90,h);c.lineTo(w*.48+i*8,h*.86);c.stroke()}
  return canvas
}
// Each shared edge uses the same curve in reverse on the adjoining piece.
function outline(c:CanvasRenderingContext2D,col:number,row:number){
  const edge=(x:number,y:number,dx:number,dy:number,sign:number)=>{
    const p=(along:number,out:number)=>[x+along*dx+out*dy*sign,y+along*dy-out*dx*sign] as const
    c.lineTo(...p(.36,0))
    if(sign){c.bezierCurveTo(...p(.46,0),...p(.32,.19),...p(.5,.19));c.bezierCurveTo(...p(.68,.19),...p(.54,0),...p(.64,0))}
    c.lineTo(...p(1,0))
  }
  const dir=(x:number,y:number)=>(x*7+y*13)%3?1:-1
  c.beginPath();c.moveTo(0,0)
  edge(0,0,1,0,row?-dir(col,row-1):0)
  edge(1,0,0,1,col<COLS-1?dir(col,row):0)
  edge(1,1,-1,0,row<ROWS-1?dir(col,row):0)
  edge(0,1,0,-1,col?-dir(col-1,row):0)
  c.closePath()
}
export async function jigsaw(host:HTMLElement){
  async function request(data?:object){
    const r=await fetch('/api/custody/puzzle',data?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}:{})
    const result=await r.json()
    if(!r.ok)throw Error(result.error)
    return result as {puzzle:Puzzle;released?:boolean}
  }
  let {puzzle}=await request(),page=0,selected=-1,busy=false
  const art=panorama()
  host.innerHTML='<h3>Meridian at dusk</h3><p>Choose a loose piece, then its matching space. Each section holds 25 pieces.</p><canvas class="puzzle-preview" width="400" height="250" aria-label="Meridian panorama and current puzzle section"></canvas><div class="puzzle-nav"><button data-prev>Previous section</button><strong></strong><button data-next>Next section</button></div><p role="status"></p><div class="puzzle-halves"><section><h4>Board</h4><div class="tile-grid board"></div></section><section><h4>Loose pieces</h4><div class="tile-grid tray"></div></section></div>'
  const status=host.querySelector<HTMLElement>('[role=status]')!
  function tile(target:number,placed:boolean,loose:boolean){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=84
    const c=canvas.getContext('2d')!,col=target%COLS,row=Math.floor(target/COLS)
    const margin=loose?12:0,scale=84-2*margin
    c.translate(margin,margin);c.scale(scale,scale)
    c.save();outline(c,col,row);c.clip();c.globalAlpha=placed||loose?1:.27
    c.drawImage(art,-col,-row,COLS,ROWS)
    c.restore();outline(c,col,row);c.lineWidth=.023;c.strokeStyle=placed?'#98debb':'#e3d7c0';c.stroke()
    return canvas
  }
  function render(){
    const firstX=(page%8)*SIDE,firstY=Math.floor(page/8)*SIDE
    const preview=host.querySelector<HTMLCanvasElement>('.puzzle-preview')!,ctx=preview.getContext('2d')!
    ctx.drawImage(art,0,0,400,250);ctx.fillStyle='#1b2c4266'
    for(const [piece,index] of puzzle.tiles.entries())if(!puzzle.placed[piece])ctx.fillRect(index%COLS*10,Math.floor(index/COLS)*10,10,10)
    ctx.strokeStyle='#ffebaa';ctx.lineWidth=2;ctx.strokeRect(firstX*10+1,firstY*10+1,48,48)
    preview.onclick=e=>{const r=preview.getBoundingClientRect();page=Math.min(4,Math.floor((e.clientY-r.top)/r.height*5))*8+Math.min(7,Math.floor((e.clientX-r.left)/r.width*8));selected=-1;render()}
    const targets=Array.from({length:25},(_,i)=>(firstY+Math.floor(i/SIDE))*COLS+firstX+i%SIDE)
    const board=host.querySelector('.board')!,tray=host.querySelector('.tray')!
    board.replaceChildren();tray.replaceChildren()
    host.querySelector('strong')!.textContent='Section '+(page+1)+'/40 · '+puzzle.placed.filter(Boolean).length+'/'+PUZZLE_SIZE+' placed'
    for(const [i,target] of targets.entries()){
      const piece=puzzle.tiles.indexOf(target),b=document.createElement('button')
      b.setAttribute('aria-label','Board row '+(1+Math.floor(i/5))+', column '+(1+i%5));b.disabled=puzzle.placed[piece]
      b.append(tile(target,puzzle.placed[piece],false));board.append(b)
      b.onclick=async()=>{
        if(busy||selected<0){status.textContent='Select a loose piece first.';return}
        busy=true
        try{
          const result=await request({piece:selected,target})
          if(result.released){location.replace('/chess/world.html?go=station');return}
          puzzle=result.puzzle;selected=-1;status.textContent=puzzle.placed.every(Boolean)?'Puzzle complete. Awaiting moderation release.':'Piece fitted.';render()
        }catch(e){status.textContent=e instanceof Error?e.message:'Please try again.'}finally{busy=false}
      }
    }
    for(const [piece,target] of puzzle.tiles.entries()){
      if(puzzle.placed[piece]||!targets.includes(target))continue
      const b=document.createElement('button');b.append(tile(target,false,true));tray.append(b)
      b.setAttribute('aria-label','Loose piece '+(piece+1));b.setAttribute('aria-pressed',String(selected===piece))
      b.onclick=()=>{selected=piece;for(const button of tray.querySelectorAll('button'))button.setAttribute('aria-pressed',String(b===button));status.textContent='Choose a space on the board.'}
    }
    host.querySelector<HTMLButtonElement>('[data-prev]')!.disabled=page===0
    host.querySelector<HTMLButtonElement>('[data-next]')!.disabled=page===39
  }
  host.querySelector<HTMLButtonElement>('[data-prev]')!.onclick=()=>{if(page>0){page--;selected=-1;render()}}
  host.querySelector<HTMLButtonElement>('[data-next]')!.onclick=()=>{if(page<39){page++;selected=-1;render()}}
  render()
}

