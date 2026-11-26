import * as T from 'three'
import {gameStations,cardLabel,slotSymbols,type TableView} from './resort.ts'
import type {WorldView} from './model.ts'

const ink='#203d45',red='#a33d48',gold='#ad813f'
const glyphs=['🍒','🍋','●','♟','♛','★']
function illustration(width:number,height:number,paint:(c:CanvasRenderingContext2D)=>void){
  const canvas=document.createElement('canvas')
  canvas.width=width;canvas.height=height;paint(canvas.getContext('2d')!)
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace
  return texture
}
function cardFace(value:number){
  return illustration(128,176,c=>{
    c.fillStyle=value<0?'#24474b':'#fff4d9';c.fillRect(0,0,128,176)
    c.strokeStyle=gold;c.lineWidth=3;c.strokeRect(5,5,118,166)
    if(value<0){
      c.save();c.beginPath();c.rect(9,9,110,158);c.clip();c.strokeStyle='#ae986d';c.lineWidth=1.8
      for(let i=-176;i<304;i+=15){
        c.beginPath();c.moveTo(i,0);c.lineTo(i+176,176);c.moveTo(i,0);c.lineTo(i-176,176);c.stroke()
      }
      c.restore();return
    }
    const [rank,suit]=cardLabel(value)
    c.fillStyle='♦♥'.includes(suit)?red:ink;c.font='bold 31px Georgia';c.fillText(rank==='T'?'10':rank,12,38)
    c.textAlign='center';c.font='67px Georgia';c.fillText(suit,64,112)
    c.translate(128,176);c.rotate(Math.PI);c.textAlign='left';c.font='bold 31px Georgia';c.fillText(rank==='T'?'10':rank,12,38)
  })
}
const reelStrip=()=>illustration(128,768,c=>{
  for(let i=0;i<6;i++){
    const y=i*128
    c.fillStyle='#fff3d2';c.fillRect(0,y,128,128)
    c.fillStyle=[red,gold,'#735684',red,gold,ink][i];c.font='bold 67px Georgia';c.textAlign='center';c.fillText(glyphs[i],64,y+80)
    c.font='bold 17px Georgia';c.fillText(slotSymbols[i].toUpperCase(),64,y+106)
    c.fillRect(10,y+122,108,2)
  }
})
export function salonGames(parent:T.Group){
  const strip=reelStrip(),paper=new T.PlaneGeometry(.215,.30)
  const faces=new Map<number,T.MeshBasicMaterial>()
  const cards=new Map<string,{mesh:T.Mesh;value:number;x:number;z:number;angle:number;dealt:number}>()
  const machines=gameStations.slice(2).map(({z})=>{
    const reels=Array.from({length:3},(_,i)=>{
      const texture=strip.clone();texture.wrapT=T.RepeatWrapping;texture.repeat.y=1/6;texture.offset.y=(5-i)/6
      const reel=new T.Mesh(new T.PlaneGeometry(.285,.37),new T.MeshBasicMaterial({map:texture}))
      reel.rotation.y=-Math.PI/2;reel.position.set(7.994,1.81,z+(i-1)*.34);parent.add(reel)
      return {texture,from:texture.offset.y,to:texture.offset.y}
    })
    return {z,reels,started:0}
  })
  let lastStation='',lastSequence=-1,tableRevision=''
  function deal(table:TableView,self:string,z:number,now:number){
    const active=new Set<string>()
    const playerRow=table.seats.findIndex(s=>s.name===self)
    const ownSide=seatSide
    const row=(values:number[],side:number,lane:number,key:string)=>{
      values.forEach((value,i)=>{
        const id=key+':'+i
        active.add(id)
        const spread=Math.min(.22,1.25/Math.max(1,values.length-1))
        const dz=(i-(values.length-1)/2)*spread
        const x=-6+side*(.54-lane*.27),targetZ=z+dz*side
        let card=cards.get(id)
        if(card?.value!==value){
          let mat=faces.get(value)
          if(!mat){mat=new T.MeshBasicMaterial({map:cardFace(value),side:T.DoubleSide});faces.set(value,mat)}
          if(!card){const mesh=new T.Mesh(paper,mat);parent.add(mesh);card={mesh,value,x,z:targetZ,angle:0,dealt:now};cards.set(id,card)}
          card.value=value;card.mesh.material=mat;card.dealt=now+i*68
        }
        card.x=x;card.z=targetZ;card.angle=side*Math.PI/2+dz*.14
      })
    }
    table.seats.forEach((s,i)=>{
      const side=i===(playerRow<0?0:playerRow)?ownSide:-ownSide
      if(table.hands)table.hands.filter(h=>h.name===s.name).forEach((h,l)=>row(h.cards,side,l,'hand'+i+'-'+l))
      else row(s.cards.length?s.cards:Array(s.count).fill(-1),side,0,'player'+i)
    })
    if(table.dealer.length)row([...table.dealer,...(table.phase==='play'?[-1]:[])],-ownSide,2,'dealer')
    for(const [id,card] of cards)if(!active.has(id)){card.mesh.removeFromParent();cards.delete(id)}
  }
  let seatSide=1
  const update=(v:WorldView)=>{
    const seat=v.you.homePose?.id??'',sequence=v.resort?.sequence??-1,now=performance.now()
    if(seat.startsWith('salon-slots')&&v.resort?.slots){
      const machine=machines.find(m=>seat==='salon-slots-'+m.z)
      if(machine&&(seat!==lastStation||lastSequence!==sequence)){
        machine.started=seat===lastStation?now:0
        machine.reels.forEach((r,i)=>{
          r.from=r.texture.offset.y%1
          r.to=(5-v.resort!.slots!.reels[i])/6+(machine.started?3+i:0)
          if(!machine.started)r.texture.offset.y=r.to
        })
      }
    }
    const table=v.resort?.table,key=table?seat+table.id+':'+table.revision:''
    if(key!==tableRevision){
      if(table){
        seatSide=v.you.x> -6?1:-1
        const station=gameStations.find(s=>'resort:'+s.id===v.interaction)!
        deal(table,v.you.name,station.z,now)
      }else{for(const c of cards.values())c.mesh.removeFromParent();cards.clear()}
      tableRevision=key
    }
    lastSequence=sequence;lastStation=seat
  }
  return {update,tick:(reduced:boolean)=>{
    const now=performance.now()
    for(const machine of machines)if(machine.started){
      machine.reels.forEach((r,i)=>{
        const t=reduced?1:Math.min(1,(now-machine.started)/(850+i*320))
        r.texture.offset.y=r.to+(r.from-r.to)*(1-t)**2
      })
      if(reduced||now>machine.started+1490)machine.started=0
    }
    for(const c of cards.values()){
      const t=reduced?1:T.MathUtils.clamp((now-c.dealt)/360,0,1),a=1-(1-t)**3
      c.mesh.visible=t>0;c.mesh.position.set(-6+(c.x+6)*a,1.102+.11*Math.sin(Math.PI*t),c.z+(1-a)*.55)
      c.mesh.rotation.set(-Math.PI/2,0,c.angle+(1-a)*.46,'XYZ')
    }
  }}
}
