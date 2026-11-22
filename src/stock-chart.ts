import type {PricePoint} from './stock-model.ts'

const date=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'Europe/Amsterdam'})
const eventDate=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Amsterdam'})
const price=new Intl.NumberFormat('en-GB',{maximumFractionDigits:2})
const volume=new Intl.NumberFormat('en-GB',{notation:'compact',maximumFractionDigits:1})

export class StockChart {
  private points:PricePoint[]=[]
  private accent='#8ce1b2'
  private current=-1
  private positions:number[]=[]
  private observer:ResizeObserver
  constructor(private canvas:HTMLCanvasElement,private readout:HTMLElement,private timeSeries=false){
    const inspect=(clientX:number)=>{
      const x=clientX-this.canvas.getBoundingClientRect().left
      let closest=0
      for(let i=1;i<this.positions.length;i++)if(Math.abs(x-this.positions[i])<Math.abs(x-this.positions[closest]))closest=i
      this.select(closest)
    }
    canvas.addEventListener('pointerdown',e=>inspect(e.clientX))
    canvas.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||e.buttons===1)inspect(e.clientX)})
    canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){this.current=-1;this.draw()}})
    canvas.addEventListener('blur',()=>{this.current=-1;this.draw()})
    canvas.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)||!this.points.length)return
      e.preventDefault()
      const last=this.points.length-1
      this.select(e.key==='Home'?0:e.key==='End'?last:(this.current<0?last:this.current)+(e.key==='ArrowRight'?1:-1))
    })
    this.observer=new ResizeObserver(()=>this.draw())
    this.observer.observe(canvas)
  }
  set(points:PricePoint[],accent:string){
    if(points.length!==this.points.length||points[0]?.at!==this.points[0]?.at||points.at(-1)?.at!==this.points.at(-1)?.at)this.current=-1
    this.points=points;this.accent=accent
    this.draw()
  }
  private select(index:number){
    if(!this.points.length)return
    this.current=Math.max(0,Math.min(index,this.points.length-1))
    this.draw()
  }
  private draw(){
    const rect=this.canvas.getBoundingClientRect(),ctx=this.canvas.getContext('2d')
    if(!ctx||rect.width<1||rect.height<1)return
    const {width:w,height:h}=rect,dpr=Math.min(2,devicePixelRatio||1)
    this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);ctx.scale(dpr,dpr)
    const left=12,right=Math.max(24,w-67),top=15,volumeHeight=this.points.some(p=>(p.volume??0)>0)?Math.min(40,h*.16):0
    const bottom=h-29-volumeHeight,plot=bottom-top
    const data=this.points
    this.canvas.tabIndex=data.length>1?0:-1
    const latest=data.at(-1),point=data[this.current]??latest
    this.readout.textContent=point?`${eventDate.format(point.at)} · ${price.format(point.price)} coins${point.volume===undefined?'':` · ${volume.format(point.volume)} volume`}`:''
    if(!latest){
      ctx.fillStyle='#a4b8b0';ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillText('No prices for this range',w/2,h/2)
      return
    }
    const low=Math.min(...data.map(p=>p.price)),high=Math.max(...data.map(p=>p.price))
    const extension=Math.max((high-low)*.115,high*.003,.02),min=low-extension,max=high+extension
    const span=latest.at-data[0].at
    const position=(index:number)=>data.length===1?(right+left)/2:left+(right-left)*(this.timeSeries&&span>0?(data[index].at-data[0].at)/span:index/(data.length-1))
    this.positions=data.map((_,i)=>position(i))
    const y=(p:number)=>bottom-(p-min)/(max-min)*plot
    ctx.lineWidth=1;ctx.font='10px system-ui'
    for(let i=0;i<=4;i++){
      const level=max-i*(max-min)/4,py=y(level)
      ctx.beginPath();ctx.moveTo(left,py);ctx.lineTo(right,py);ctx.strokeStyle='#a8cdc625';ctx.stroke()
      ctx.fillStyle='#9cafaa';ctx.textAlign='left';ctx.fillText(price.format(level),right+10,py+3)
    }
    const indices=data.length>4?(w>490?[0,.25,.5,.75,1]:[0,.5,1]).map(p=>Math.round((data.length-1)*p)):[0,data.length-1]
    let previous=-Infinity
    for(const i of new Set(indices)){
      const px=position(i),str=date.format(data[i].at)
      if(px-previous<43)continue
      ctx.fillStyle='#9cafaa';ctx.textAlign=i===0?'left':i===data.length-1?'right':'center';ctx.fillText(str,px,h-7);previous=px
    }
    if(volumeHeight){
      const maxVolume=Math.max(1,...data.map(p=>p.volume??0))
      const width=Math.min(8,Math.max(1,(right-left)/data.length*.68))
      data.forEach((p,i)=>{
        const vh=(p.volume??0)/maxVolume*(volumeHeight-5)
        ctx.fillStyle=p.price>=(data[i-1]?.price??p.price)?'#6eb79d60':'#d4857e65'
        ctx.fillRect(position(i)-width/2,bottom+volumeHeight-vh,width,vh)
      })
    }
    const path=new Path2D()
    data.forEach((p,i)=>i?path.lineTo(position(i),y(p.price)):path.moveTo(position(i),y(p.price)))
    if(data.length>1){
      const area=new Path2D(path)
      area.lineTo(right,bottom);area.lineTo(left,bottom);area.closePath()
      const shade=ctx.createLinearGradient(0,top,0,bottom)
      shade.addColorStop(0,this.accent+'56');shade.addColorStop(1,this.accent+'04')
      ctx.fillStyle=shade;ctx.fill(area)
      ctx.lineWidth=2;ctx.strokeStyle=this.accent;ctx.lineJoin='round';ctx.stroke(path)
    }
    const active=this.current<0?data.length-1:this.current,px=position(active),py=y(data[active].price)
    if(this.current>=0){
      ctx.beginPath();ctx.setLineDash([3,4]);ctx.strokeStyle='#cce6d5aa';ctx.lineWidth=1
      ctx.moveTo(px,top);ctx.lineTo(px,bottom+volumeHeight);ctx.stroke();ctx.setLineDash([])
    }
    ctx.beginPath();ctx.arc(px,py,this.current<0?3:4,0,Math.PI*2)
    ctx.fillStyle=this.accent;ctx.fill()
    if(this.current>=0){
      ctx.beginPath();ctx.arc(px,py,7,0,Math.PI*2);ctx.strokeStyle=this.accent+'55';ctx.stroke()
    }
  }
}

export function sparkline(canvas:HTMLCanvasElement,prices:number[],color:string){
  if(prices.length<2)return
  const ctx=canvas.getContext('2d')
  if(!ctx)return
  canvas.width=132;canvas.height=42
  const min=Math.min(...prices),max=Math.max(...prices),range=Math.max(max-min,max*.002)
  ctx.beginPath()
  prices.forEach((price,i)=>{
    const x=2+i/(prices.length-1)*128,y=30-(price-min)/range*23
    if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y)
  })
  ctx.lineWidth=3;ctx.lineJoin='round';ctx.strokeStyle=color;ctx.stroke()
  ctx.lineTo(130,41);ctx.lineTo(2,41);ctx.closePath()
  const shade=ctx.createLinearGradient(0,0,0,42)
  shade.addColorStop(0,color+'46');shade.addColorStop(1,color+'00')
  ctx.fillStyle=shade;ctx.fill()
}
