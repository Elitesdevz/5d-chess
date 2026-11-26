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
let saving:Promise<unknown>=Promise.resolve()
export async function jigsaw(host:HTMLElement,noRelease=false){
  async function request(data?:object){
    const r=await fetch('/api/custody/puzzle',data?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}:{})
    const result=await r.json()
    if(!r.ok)throw Error(result.error||'Puzzle unavailable. Close the table and try again.')
    return result as {puzzle:Puzzle;released?:boolean}
  }
  await saving
  let {puzzle}=await request()
  if(!host.isConnected)return
  const art=panorama(),sectionCount=COLS*ROWS/(SIDE*SIDE)
  const sectionOf=(target:number)=>Math.floor(target%COLS/SIDE)+Math.floor(target/COLS/SIDE)*(COLS/SIDE)
  const firstOpen=Math.min(...puzzle.tiles.filter((_,i)=>!puzzle.placed[i]).map(sectionOf))
  let page=Number.isFinite(firstOpen)?firstOpen:0,selected=-1,busy=false
  host.innerHTML=`<div class="puzzle-overview"><canvas class="puzzle-preview" width="400" height="250" aria-label="Panorama with the current section highlighted"></canvas>
    <div><p class="puzzle-total"></p><progress max="${PUZZLE_SIZE}" aria-label="Overall puzzle progress"></progress>
    <p>${noRelease?'Your progress is saved. Only a moderator can release you.':'Fit all 1,000 pieces to earn your release. Progress saves after each piece.'}</p></div></div>
    <nav class="puzzle-nav" aria-label="Puzzle sections"><button data-prev aria-label="Previous section">‹</button><select aria-label="Puzzle section"></select><button data-next aria-label="Next section">›</button></nav>
    <div class="puzzle-switch" role="group" aria-label="Table view"><button data-pane="tray">Loose pieces</button><button data-pane="board">Board</button></div>
    <div class="puzzle-instruction"><p role="status" class="puzzle-status"></p><span class="puzzle-selection" aria-label="Selected piece"></span></div>
    <div class="puzzle-halves"><section><h3>Board</h3><div class="tile-grid board"></div></section><section><h3>Loose pieces</h3><div class="tile-grid tray"></div></section></div>
`
  const status=host.querySelector<HTMLElement>('[role=status]')!
  const sample=host.querySelector<HTMLElement>('.puzzle-selection')!
  const hint='Choose a loose piece, then its matching space on the board.'
  status.textContent=hint
  const sections=host.querySelector('select')!
  const panes=host.querySelector<HTMLElement>('.puzzle-halves')!
  const switches=host.querySelectorAll<HTMLButtonElement>('[data-pane]')
  function showPane(pane:string){
    panes.dataset.show=pane
    for(const control of switches)control.setAttribute('aria-pressed',String(control.dataset.pane===pane))
  }
  for(const control of switches)control.onclick=()=>showPane(control.dataset.pane!)

  for(let i=0;i<sectionCount;i++)sections.add(new Option('Section '+(i+1)+' of '+sectionCount,String(i)))
  function go(next:number){
    if(busy)return
    page=next;selected=-1;status.textContent=hint;render()
  }
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
    const targets=Array.from({length:25},(_,i)=>(firstY+Math.floor(i/SIDE))*COLS+firstX+i%SIDE)
    const board=host.querySelector('.board')!,tray=host.querySelector('.tray')!
    board.replaceChildren();tray.replaceChildren()
    const count=puzzle.placed.filter(Boolean).length
    host.querySelector('.puzzle-total')!.textContent=count.toLocaleString()+' / 1,000 pieces placed'
    host.querySelector('progress')!.value=count
    sections.value=String(page)
    showPane('tray');sample.replaceChildren()
    for(const [i,target] of targets.entries()){
      const piece=puzzle.tiles.indexOf(target),b=document.createElement('button')
      b.setAttribute('aria-label','Board row '+(1+Math.floor(i/5))+', column '+(1+i%5));b.disabled=puzzle.placed[piece]
      b.append(tile(target,puzzle.placed[piece],false));board.append(b)
      b.onclick=async()=>{
        if(busy)return
        if(selected<0){status.textContent='Select a loose piece first.';return}
        busy=true
        try{
          const move=request({piece:selected,target})
          saving=move.catch(()=>{})
          const result=await move
          if(result.released){location.replace('/chess/world.html');return}
          if(!host.isConnected)return
          puzzle=result.puzzle;selected=-1;status.textContent='Piece fitted and saved.';render()
          const next=tray.querySelector<HTMLButtonElement>('button')??sections
          next.focus({preventScroll:true})
        }catch(e){status.textContent=e instanceof Error?e.message:'Please try again.'}finally{busy=false}
      }
    }
    for(const [piece,target] of puzzle.tiles.entries()){
      if(puzzle.placed[piece]||!targets.includes(target))continue
      const b=document.createElement('button');b.append(tile(target,false,true));tray.append(b)
      b.setAttribute('aria-label','Loose piece '+(piece+1));b.setAttribute('aria-pressed',String(selected===piece))
      b.onclick=event=>{
        if(busy)return
        selected=piece;sample.replaceChildren(tile(target,false,true))
        for(const button of tray.querySelectorAll('button'))button.setAttribute('aria-pressed',String(b===button))
        status.textContent='Choose a space on the board.'
        showPane('board')
        if(event.detail===0)board.querySelector<HTMLButtonElement>('button:enabled')?.focus()
      }
    }
    if(!tray.childElementCount){
      showPane('board')
      tray.textContent='All 25 pieces fitted.'
      status.textContent=count===PUZZLE_SIZE?'Panorama complete. Your progress is saved.':'Section complete. Choose another section to continue.'
    }
    host.querySelector<HTMLButtonElement>('[data-prev]')!.disabled=page===0
    host.querySelector<HTMLButtonElement>('[data-next]')!.disabled=page===sectionCount-1
  }
  sections.onchange=()=>{if(busy)sections.value=String(page);else go(Number(sections.value))}
  host.querySelector<HTMLButtonElement>('[data-prev]')!.onclick=()=>go(page-1)
  host.querySelector<HTMLButtonElement>('[data-next]')!.onclick=()=>go(page+1)
  render()
}
