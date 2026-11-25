// Three-ball practice uses a fixed simulation step so shot distance is independent of frame rate.
type Ball={x:number;y:number;vx:number;vy:number;color:string;sunk:boolean}
const width=540,height=256,r=8,rail=17
const pockets=[rail,width/2,width-rail].flatMap(x=>[rail,height-rail].map(y=>({x,y})))
const ball=(x:number,y:number,color:string):Ball=>({x,y,color,vx:0,vy:0,sunk:false})
export function billiards(root:HTMLElement){
  root.innerHTML=`<canvas class="royal-felt" width="540" height="256" aria-label="Three-ball pool table"></canvas><p>Clear the three object balls in as few shots as you can. Tap the felt or use the angle control to aim.</p>
    <div class="royal-order"><label>Angle<input name="angle" type="range" min="-180" max="180" value="0"></label><label>Power<input name="power" type="range" min="20" max="100" value="70"></label><button type="button" data-shoot>Shoot</button></div><p role="status"></p>`
  const canvas=root.querySelector('canvas')!,ctx=canvas.getContext('2d')!
  const angle=root.querySelector<HTMLInputElement>('[name=angle]')!,power=root.querySelector<HTMLInputElement>('[name=power]')!
  const shoot=root.querySelector<HTMLButtonElement>('[data-shoot]')!,status=root.querySelector<HTMLElement>('[role=status]')!
  const cue=ball(134,128,'#f6eddd'),balls=[cue,ball(358,128,'#d19e42'),ball(373,119,'#8e4460'),ball(373,137,'#4b76b2')]
  let shots=0
  const radians=()=>Number(angle.value)*Math.PI/180
  function paint(moving=false){
    ctx.fillStyle='#49362b';ctx.fillRect(0,0,width,height)
    ctx.fillStyle='#366357';ctx.fillRect(7,7,width-14,height-14)
    ctx.fillStyle='#244f49';ctx.fillRect(rail,rail,width-2*rail,height-2*rail)
    function circle(x:number,y:number,radius:number,color:string){
      ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,radius,0,2*Math.PI);ctx.fill()
    }
    for(const p of pockets)circle(p.x,p.y,13,'#172823')
    if(!moving&&!cue.sunk){
      ctx.strokeStyle='#d7c8a0';ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(cue.x,cue.y)
      ctx.lineTo(cue.x+100*Math.cos(radians()),cue.y+100*Math.sin(radians()));ctx.stroke();ctx.setLineDash([])
    }
    for(const b of balls)if(!b.sunk){circle(b.x,b.y,r,b.color);circle(b.x-2,b.y-3,1.7,'#faf0d7')}
  }
  function step(){
    for(const b of balls){
      if(b.sunk)continue
      b.x+=b.vx;b.y+=b.vy
      if(pockets.some(p=>Math.hypot(b.x-p.x,b.y-p.y)<13)){b.sunk=true;b.vx=b.vy=0;continue}
      for(const [p,v,max] of [['x','vx',width],['y','vy',height]] as const){
        if(b[p]<rail+r||b[p]>max-rail-r){
          b[p]=Math.max(rail+r,Math.min(max-rail-r,b[p]));b[v]*=-.83
        }
      }
      b.vx*=.989;b.vy*=.989
      if(Math.hypot(b.vx,b.vy)<.042)b.vx=b.vy=0
    }
    for(let i=0;i<balls.length;i++)for(const b of balls.slice(i+1)){
      const a=balls[i],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)
      if(a.sunk||b.sunk||d===0||d>=2*r)continue
      const nx=dx/d,ny=dy/d,gap=(2*r-d)/2
      a.x-=nx*gap;a.y-=ny*gap;b.x+=nx*gap;b.y+=ny*gap
      const impulse=(a.vx-b.vx)*nx+(a.vy-b.vy)*ny
      if(impulse>0){a.vx-=nx*impulse;a.vy-=ny*impulse;b.vx+=nx*impulse;b.vy+=ny*impulse}
    }
  }
  angle.oninput=()=>paint()
  canvas.onclick=event=>{
    if(shoot.disabled)return
    const rect=canvas.getBoundingClientRect()
    angle.value=String(Math.round(Math.atan2((event.clientY-rect.top)*height/rect.height-cue.y,(event.clientX-rect.left)*width/rect.width-cue.x)*180/Math.PI))
    paint()
  }
  shoot.onclick=()=>{
    if(balls.slice(1).every(b=>b.sunk)){billiards(root);return}
    shots++;status.textContent='Shot '+shots
    cue.vx=Math.cos(radians())*Number(power.value)*.081;cue.vy=Math.sin(radians())*Number(power.value)*.081
    shoot.disabled=angle.disabled=power.disabled=true
    let last=performance.now(),carry=0
    function frame(now:number){
      if(!root.isConnected||!root.closest('dialog[open]'))return
      carry+=Math.min(50,now-last);last=now
      while(carry>=8){step();carry-=8}
      const moving=balls.some(b=>b.vx||b.vy)
      paint(moving)
      if(moving){requestAnimationFrame(frame);return}
      const remaining=balls.slice(1).filter(b=>!b.sunk).length,scratch=cue.sunk
      if(scratch){
        cue.x=134;cue.y=128
        while(balls.slice(1).some(b=>!b.sunk&&Math.hypot(cue.x-b.x,cue.y-b.y)<2*r+1))cue.y+=2*r+1
        cue.sunk=false
      }
      shoot.disabled=angle.disabled=power.disabled=false
      status.textContent=(scratch?'Scratch. ':'')+(remaining?remaining+' balls left · '+shots+' shots':'Table cleared in '+shots+' shots')
      if(!remaining)shoot.textContent='Rack again'
      paint()
    }
    requestAnimationFrame(frame)
  }
  paint()
}
