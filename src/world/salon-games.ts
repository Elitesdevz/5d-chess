import * as T from 'three'
import {gameStations,cardLabel,slotSymbols,type TableView} from './resort.ts'
import {CityGuest} from './guest.ts'
import type {WorldView} from './model.ts'

const ink='#203d45',red='#a33d48',gold='#ad813f'
// Layer the printed reel symbols so they also render on systems without an emoji font.
const reelArt=[
  [['#427153','M36 38 Q62 17 65 5 Q68 23 88 32 L85 35 Q72 27 64 16 Q52 32 39 41 Z'],[red,'M38 31 C63 29 63 65 39 69 C13 68 16 37 38 31 Z M84 27 C109 25 111 59 86 65 C63 64 61 34 84 27 Z']],
  [['#537b51','M71 19 Q63 1 40 5 Q44 24 71 19 Z'],['#daa637','M23 38 Q22 23 36 27 C49 10 81 10 91 23 Q111 32 103 40 Q101 47 92 47 C74 69 42 68 29 52 Q14 51 23 38 Z']],
  [['#594367','M62 19 C103 12 103 55 72 68 Q60 78 46 63 C21 37 31 13 62 19 Z'],['#537b51','M58 19 Q65 0 88 7 Q75 23 58 19 Z']],
  [['#cc9341','M27 54 Q34 47 37 28 Q40 10 59 8 Q65 -3 71 8 Q91 14 93 35 Q95 48 103 54 L100 60 L29 60 Z'],[ink,'M54 63 L76 63 Q65 79 54 63 Z']],
  [['#c69345','M24 21 L46 36 L64 8 L81 36 L105 20 L96 56 L33 56 Z M33 60 L96 60 L96 67 L33 67 Z'],[red,'M59 44 L64 38 L69 44 L64 50 Z']],
  [[ink,'M64 4 L75 28 L103 29 L82 47 L88 73 L64 60 L40 73 L46 47 L25 29 L53 28 Z'],['#e5bd74','M64 22 L69 36 L84 37 L72 46 L75 60 L64 52 L51 60 L55 46 L44 37 L59 36 Z']],
]
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
    c.save();c.translate(0,y+10)
    for(const [colour,shape] of reelArt[i]){c.fillStyle=colour;c.fill(new Path2D(shape))}
    c.restore();c.fillStyle=ink;c.textAlign='center'
    c.font='bold 17px Georgia';c.fillText(slotSymbols[i].toUpperCase(),64,y+106)
    c.fillRect(10,y+122,108,2)
  }
})
function tableCloth(name:string,poker:boolean){
  return illustration(512,512,c=>{
    c.fillStyle=poker?'#1d5a52':'#653749';c.fillRect(0,0,512,512)
    c.strokeStyle='#ffffff0c';c.lineWidth=1
    for(let i=-512;i<1024;i+=5){c.beginPath();c.moveTo(i,0);c.lineTo(i+512,512);c.stroke()}
    c.translate(256,256);c.strokeStyle='#d1ac72'
    for(const radius of [238,229]){c.beginPath();c.arc(0,0,radius,0,2*Math.PI);c.lineWidth=radius===238?4:1.5;c.stroke()}
    for(const side of [-1,1]){
      c.save();c.scale(1,side);c.beginPath();c.arc(0,-44,190,.28*Math.PI,.72*Math.PI);c.stroke()
      for(const x of [-74,0,74]){c.beginPath();c.arc(x,135-Math.abs(x)*.17,15,0,2*Math.PI);c.stroke()}
      c.restore()
    }
    c.fillStyle='#f8e3b4';c.textAlign='center';c.font='bold 26px Georgia';c.fillText(name,0,3)
    c.font='19px Georgia';c.fillText('♣   ♦   ♥   ♠',0,33)
  })
}
export function salonGames(parent:T.Group){
  const dealers=gameStations.slice(0,2).map(({z},i)=>{
    const texture=tableCloth(i?'BLACKJACK':'FIVE-CARD DRAW',!i)
    const felt=new T.Mesh(new T.CircleGeometry(1,48),new T.MeshStandardMaterial({map:texture,roughness:.97}))
    felt.position.set(-6,1.084,z);felt.rotation.set(-Math.PI/2,0,Math.PI/2);felt.scale.set(1.15,1.065,1);parent.add(felt)
    const actor=new CityGuest(parent,-6,z-1.37,i?0xbf916e:0x986e55,i?0x423747:0x274e48,true,i+1)
    return {z,actor,reached:0}
  })
  const strip=reelStrip(),paper=new T.PlaneGeometry(.215,.30)
  const faces=new Map<number,T.MeshBasicMaterial>()
  const cards=new Map<string,{mesh:T.Mesh;value:number;x:number;z:number;angle:number;originZ:number;dealt:number}>()
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
    const active=new Set<string>(),dealer=dealers.find(d=>d.z===z)!
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
          if(!card){const mesh=new T.Mesh(paper,mat);parent.add(mesh);card={mesh,value,x,z:targetZ,angle:0,originZ:z-.86,dealt:now};cards.set(id,card)}
          dealer.reached=now
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
        const station=gameStations.find(s=>'resort:'+s.id===v.interaction)
        if(station)deal(table,v.you.name,station.z,now)
      }else{for(const c of cards.values())c.mesh.removeFromParent();cards.clear()}
      tableRevision=key
    }
    lastSequence=sequence;lastStation=seat
  }
  return {update,tick:(reduced:boolean)=>{
    const now=performance.now()
    for(const d of dealers){
      const phase=T.MathUtils.clamp((now-d.reached)/550,0,1)
      const reach=d.reached&&!reduced?Math.sin(phase*Math.PI):0
      d.actor.pose(now,.33*reach,undefined,new T.Vector3(.23-.17*reach,1.07+.08*reach,.29+.36*reach))
    }
    for(const machine of machines)if(machine.started){
      machine.reels.forEach((r,i)=>{
        const t=reduced?1:Math.min(1,(now-machine.started)/(850+i*320))
        r.texture.offset.y=r.to+(r.from-r.to)*(1-t)**2
      })
      if(reduced||now>machine.started+1490)machine.started=0
    }
    for(const c of cards.values()){
      const t=reduced?1:T.MathUtils.clamp((now-c.dealt)/360,0,1),a=1-(1-t)**3
      c.mesh.visible=t>0;c.mesh.position.set(-6+(c.x+6)*a,1.102+.11*Math.sin(Math.PI*t),T.MathUtils.lerp(c.originZ,c.z,a))
      c.mesh.rotation.set(-Math.PI/2,0,c.angle+(1-a)*.46,'XYZ')
    }
  }}
}
