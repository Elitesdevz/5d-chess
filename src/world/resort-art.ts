import * as T from 'three'
import {salonGames} from './salon-games.ts'
import {Scenery} from './landscape.ts'
import {ROOMS,TIERS,venues,center,bedAt,fridgeAt,dresserAt,bathAt,HOTEL_LIFT,gameStations,guestFloor,type HotelRoom,type GuestFloor} from './resort.ts'
import {floorHeight,type WorldView} from './model.ts'

type Sign=(parent:T.Object3D,text:string,size:[number,number],point:number[],color?:string,backdrop?:string)=>T.Mesh
const plum=0x623c4b,jade=0x28575a,gold=0xc69e61,ivory=0xe6d7b8,walnut=0x503a32,night=0x213639
const linen=[0xaba18e,0xd6c7ae,0xcbb8a6,0xebdcc0,0xf3e6c6]
const velvet=[0x777461,0x927560,0x85465e,0x38655e,0x805275]

export function royalResort(hotel:T.Group,sign:Sign){
  const glazing=new T.MeshStandardMaterial({color:0x8abfc5,metalness:.36,roughness:.21,transparent:true,opacity:.28,depthWrite:false,side:T.DoubleSide})
  function pane(parent:T.Group,x:number,y:number,z:number,w:number,h:number,yaw:number){
    const panel=new T.Mesh(new T.PlaneGeometry(w,h),glazing)
    panel.position.set(x,y,z);panel.rotation.y=yaw;parent.add(panel)
  }
  let games:ReturnType<typeof salonGames>|undefined
  const showers:{spray:T.Group;room:HotelRoom}[]=[]
  const levels:{floor:GuestFloor;group:T.Group;inside:T.Group}[]=[]
  const doors:{mesh:T.Group;room:HotelRoom}[]=[]
  const makeSign=(parent:T.Object3D,text:string,x:number,y:number,z:number,w:number,h:number,yaw=0)=>{
    const s=sign(parent,text,[w,h],[x,y,z],'#ffe6b8','#273a3c')
    s.rotation.y=yaw
  }
  function lift(g:T.Group,p:Scenery,label:string){
    const {x,z}=HOTEL_LIFT
    p.add('box',x,1.62,z+1.02,2.44,3.25,.18,night)
    for(const s of [-1,1]){
      p.add('box',x+s*.53,1.38,z+.90,.99,2.72,.12,0x846f57)
      for(const dx of [-.3,0,.3])p.add('box',x+s*.53+dx,1.4,z+.81,.028,2.56,.05,gold)
    }
    makeSign(g,label,x,2.99,z+.88,2.30,.37,Math.PI)
    // An overhead blade faces arrivals from the boulevard.
    makeSign(g,'GUEST LIFT',x,3.27,z+1.13,2.6,.4)
  }
  const lobby=new T.Group();hotel.add(lobby)
  const p=new Scenery()
  lift(lobby,p,'HOTEL LIFT')
  makeSign(lobby,'RECEPTION',-6.25,3.17,-7.36,3.3,.50)
  makeSign(lobby,'ROOMS  /  CARD SALON  /  PALM BATHS',0,4.55,-7.62,6.2,.44)
  p.add('box',5.8,.55,-6.2,2.86,1.1,.94,jade)
  p.add('box',5.8,1.14,-6.2,3.02,.10,1.04,ivory)
  for(const x of [4.43,7.17])p.add('post',x,1.81,-6.42,.10,1.54,.10,gold)
  p.add('box',5.8,2.59,-6.42,3.1,.5,.36,plum)
  makeSign(lobby,'WEEKLY LOTTERY',5.8,2.60,-6.21,2.86,.39)
  for(let i=0;i<7;i++)p.add('box',4.92+i*.27,1.22,-6.13,.21,.055,.34,i%2?ivory:gold)
  p.add('crown',6.65,1.49,-6.28,.46,.50,.46,0xb28853)
  p.finish(lobby)
  for(const level of ['hotel:2','hotel:3'] as GuestFloor[]){
    const group=new T.Group(),inside=new T.Group(),parts=new Scenery(),shell=new Scenery()
    hotel.add(group);group.add(inside);group.position.y=floorHeight(level)
    levels.push({floor:level,group,inside})
    const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:number)=>parts.add('box',x,y,z,w,h,d,c)
    const outer=(x:number,y:number,z:number,w:number,h:number,d:number,c:number)=>shell.add('box',x,y,z,w,h,d,c)
    const top=level==='hotel:3'
    // Continuous bands frame recessed windows on the three street-facing elevations.
    for(const z of [-23.18,7.82]){
      outer(0,.54,z,19.25,1.08,.28,plum);outer(0,3.56,z,19.25,1.05,.28,plum)
      for(let i=-4;i<=4;i++){
        outer(i*2.09,2.04,z,.48,2.65,.36,plum)
        outer(i*2.09,2.04,z+.19,.075,2.74,.075,gold)
      }
      pane(group,0,2.11,z,18.97,2.18,0)
      outer(0,2.63,z,19.12,.046,.34,gold)
      outer(0,4.38,z,19.65,.24,.55,gold)
    }
    for(const side of [-1,1]){
      const x=side*9.5
      outer(x,.62,-7.66,.27,1.24,31.20,plum);outer(x,3.8,-7.66,.28,1.38,31.2,plum)
      for(let i=0;i<=14;i++)outer(x,2.2,-22.75+i*2.14,.4,2.46,.49,plum)
      pane(group,x,2.13,-7.66,30.95,2.11,Math.PI/2)
      outer(x,2.60,-7.66,.33,.044,31.1,gold)
      outer(x,4.38,-7.66,.55,.24,31.6,gold)
    }
    // Keep the water below the deck, with a cutout over the second-floor ceiling.
    if(!top)outer(0,-.10,-7.67,19.0,.2,31.1,0x8e7c70)
    else{
      outer(-3,-.10,-7.67,12.98,.2,31.1,ivory)
      outer(8.98,-.10,-7.67,1.04,.2,31.1,ivory)
      outer(5.975,-.10,-22.57,4.95,.2,1.34,ivory)
      outer(5.975,-.10,-2.11,4.95,.2,19.98,ivory)
      outer(0,4.64,-7.67,19.47,.26,31.6,plum)
      for(const s of [-1,1])for(let j=0;j<3;j++)outer(s*(8.64-j*.32),4.93+j*.18,7.75,.23,1.1+j*.36,.62,gold)
      outer(0,5.06,7.85,13,.94,.54,night)
      makeSign(group,'T H E   R O Y A L',0,5.10,8.14,8.35,.80)
      outer(0,5.58,7.82,13.3,.10,.61,gold)
    }
    for(const z of [2.5,-3.5,-9.5,-15.5,-21.5]){
      for(const s of [-1,1]){
        box(s*1.48,2.37,z,.16,.72,.16,gold);box(s*1.38,2.40,z,.16,.45,.19,0xffda94)
        box(s*1.41,.49,z,.14,.73,.11,gold)
      }
      box(0,4.34,z,3.58,.12,.32,walnut);box(0,4.25,z,1.04,.10,.21,0xffdfaa)
    }
    box(0,.023,-8.65,2.99,.044,28.9,plum)
    for(const side of [-1,1])box(side*1.39,.052,-8.65,.035,.016,28.9,gold)
    lift(inside,parts,top?'03   /   PALM BATHS':'02   /   CARD SALON')
    makeSign(inside,top?'SUITES 301–305   ·   PALM BATHS':'ROOMS 201–206   ·   CARDS & SLOTS',0,2.75,3.97,3.28,.40)
    for(const bay of [...ROOMS,...venues].filter(r=>r.floor===level)){
      const s=bay.side,mid=center(bay),depth=bay.front-bay.back,room='number' in bay?bay:undefined
      const trim=room&&room.tier>=3?gold:walnut,wall=top?0xc9b79e:0xb9a69d
      box(s*5.62,2.16,bay.front,7.82,4.32,.13,wall)
      for(const direction of [-1,1]){
        const d=depth/2-.76
        box(s*1.71,2.16,mid+direction*(.76+d/2),.17,4.32,d,wall)
        box(s*1.59,.60,mid+direction*(.76+d/2),.09,1.2,d,top?jade:plum)
        box(s*1.54,1.21,mid+direction*(.76+d/2),.075,.05,d,gold)
        box(s*1.70,1.19,mid+direction*.78,.24,2.38,.075,trim)
      }
      box(s*1.71,3.35,mid,.17,2.02,1.53,wall)
      makeSign(inside,room?String(room.number):('name' in bay?bay.name.toUpperCase():''),s*1.59,2.63,mid,room?.tier===4?1.65:1.50,.31,-s*Math.PI/2)
      if(!room)continue
      const door=new T.Group(),leaf=new Scenery();inside.add(door);door.position.set(s*1.71,0,mid-.74)
      leaf.add('box',0,1.14,.73,.1,2.28,1.46,room.tier>=3?jade:walnut)
      leaf.add('box',-s*.061,1.34,.73,.025,1.57,1.11,room.tier>=3?0x39716c:0x745747)
      leaf.add('box',-s*.096,1.01,1.23,.075,.07,.20,gold)
      leaf.finish(door);doors.push({mesh:door,room})
      const tier=room.tier,bed=bedAt(room),fridge=fridgeAt(room),bath=bathAt(room)
      const wide=1.12+tier*.18
      box(bed.x,.27,bed.z,2.16,.52,wide+.12,walnut)
      box(bed.x,.57,bed.z,2.13,.20,wide,linen[tier])
      box(bed.x-s*.28,.69,bed.z,1.46,.08,wide+.035,velvet[tier])
      box(bed.x+s*.78,.74,bed.z,.40,.12,wide*.78,ivory)
      box(bed.x+s*1.12,.76,bed.z,.13,1.45,wide+.3,velvet[tier])
      if(tier>=2){
        for(let j=-3;j<=3;j++)box(bed.x+s*1.035,1.01,bed.z+j*wide/7,.092,.91,wide/8,velvet[tier])
        for(const dz of [-.28,.28])box(bed.x+s*.63,.82,bed.z+dz,.40,.15,wide*.39,linen[tier])
        box(bed.x-s*.53,.745,bed.z,.28,.03,wide+.04,tier===4?gold:jade)
      }
      const dresser=dresserAt(room),finish=tier>2?jade:walnut
      box(dresser.x,.43,dresser.z,1.42,.81,.68,finish)
      box(dresser.x,.88,dresser.z,1.48,.09,.73,tier===4?ivory:trim)
      for(const y of [.27,.62]){
        box(dresser.x,y,dresser.z-.35,1.31,.30,.055,finish)
        box(dresser.x,y+.025,dresser.z-.397,.28,.047,.052,tier>1?gold:ivory)
      }
      if(tier>=1){
        // The suites have a wider, stepped gilt frame above the dresser.
        const width=tier>=3?1.48:.92,wallZ=room.front-.12
        box(dresser.x,1.89,wallZ,width,1.13,.06,trim)
        box(dresser.x,1.89,wallZ-.04,width-.10,1.03,.035,0x9bbbc0)
        if(tier>=3){
          for(const side of [-1,1]){
            box(dresser.x+side*(width/2+.08),1.89,wallZ,.12,.87,.07,gold)
            box(dresser.x+side*(width/2+.17),1.89,wallZ,.05,.62,.06,gold)
          }
          const lampX=dresser.x+s*.44
          parts.add('post',lampX,.95,dresser.z,.26,.055,.26,gold)
          parts.add('post',lampX,1.12,dresser.z,.046,.30,.046,gold)
          parts.add('post',lampX,1.33,dresser.z,.29,.27,.29,ivory)
        }
      }
      box(fridge.x,.55,fridge.z,.83,1.10,.78,tier<2?0xa29d8c:night)
      box(fridge.x,.56,fridge.z-.40,.77,1.02,.035,tier<2?0xb8b7a9:jade)
      box(fridge.x+.24,.79,fridge.z-.44,.05,.32,.06,gold)
      box(bath.x,.07,bath.z,1.83,.14,1.53,tier>=3?ivory:0x79898b)
      box(bath.x,1.23,bath.z-.74,1.82,2.4,.1,tier===4?0xba9857:0x71908b)
      for(let i=-2;i<=2;i++)box(bath.x+i*.34,1.23,bath.z-.67,.025,2.28,.025,tier===4?gold:ivory)
      box(bath.x+s*.59,1.24,bath.z-.52,.07,1.6,.07,gold)
      box(bath.x+s*.59,2.04,bath.z-.31,.28,.05,.45,gold)
      const spray=new T.Group(),drops=new Scenery()
      spray.position.set(bath.x+s*.59,0,bath.z-.31);spray.visible=false;inside.add(spray)
      for(let i=0;i<24;i++){
        const angle=i*2.4,radius=.18*Math.sqrt(i/24)
        drops.add('post',radius*Math.cos(angle),.32+(i*37%17)/12,radius*Math.sin(angle),.014,.27,.014,0xb5dddf)
      }
      drops.finish(spray);showers.push({spray,room})
      // A tiled wet area with a vanity, cistern and partial privacy screen.
      const tile=tier===4?0xdac7a1:tier>=2?0x8caba3:0x94938a
      box(s*6.6,.029,room.back+1.08,5.22,.05,1.98,tile)
      box(s*6.33,1.06,room.back+1.89,3.9,2.12,.083,tier===4?0xe7d6b5:0xa5b4ad)
      box(s*6.33,2.14,room.back+1.89,3.92,.065,.10,trim)
      box(s*4.81,.47,room.back+.41,1.02,.89,.59,walnut)
      box(s*4.81,.95,room.back+.41,1.08,.10,.66,ivory)
      parts.add('post',s*4.81,1.02,room.back+.41,.42,.12,.32,0xacc7bd)
      box(s*4.81,1.70,room.back+.14,.79,.73,.045,0xb8d0ca)
      box(s*6.12,.62,room.back+.25,.48,.66,.23,ivory)
      parts.add('post',s*6.12,.35,room.back+.60,.49,.38,.61,ivory)
      if(tier===0){
        for(let n=0;n<5;n++)box(bed.x-s*(.11+n*.15),.738,bed.z+.14-.06*(n%2),.11,.014,.09,n%2?0x847e66:0x918575)
      }
      if(tier>=2){
        box(s*8.98,1.13,mid,.52,.085,1.43,ivory)
        for(const dz of [-.62,.62])box(s*8.90,.53,mid+dz,.38,1,.10,walnut)
        box(s*8.97,1.30,mid,.24,.20,.27,ivory)
        parts.add('crown',s*8.97,1.54,mid,.35,.39,.34,0x54745b)
        parts.add('post',s*8.76,.61,bed.z-1.32,.52,.06,.52,gold)
        parts.add('post',s*8.76,.84,bed.z-1.32,.055,.46,.055,gold)
        parts.add('post',s*8.76,1.18,bed.z-1.32,.38,.37,.38,ivory)
      }
      if(tier>=3){
        box(s*4.72,.39,mid,1.1,.65,2.12,velvet[tier]);box(s*5.2,.80,mid,.18,.68,2.18,velvet[tier])
        for(const dz of [-.68,0,.68])box(s*4.6,.75,mid+dz,.86,.16,.62,velvet[tier])
        for(const dz of [-1.01,1.01])box(s*4.65,.71,mid+dz,1.00,.42,.17,walnut)
        box(s*3.56,.40,mid,.65,.09,1.2,ivory)
        for(const dz of [-.46,.46])box(s*3.56,.21,mid+dz,.36,.37,.09,gold)
        box(s*3.56,.47,mid-.12,.29,.055,.38,plum)
        // Full-height drapery frames the corner view.
        for(const z of [room.front-1.2,room.back+2.65])for(let j=0;j<6;j++){
          box(s*(9.16+.07*(j%2)),2.33,z+j*.13,.12,4.3,.16,velvet[tier])
        }
      }
      if(tier===4){
        box(s*6.09,.045,mid,5.52,.055,4.32,plum)
        for(const dx of [-2.54,2.54])box(s*6.09+dx,.084,mid,.04,.03,4.10,gold)
        for(const dz of [-1.99,1.99])box(s*6.09,.084,mid+dz,5.13,.03,.04,gold)
        for(let k=0;k<7;k++)box(s*6.5+k*.12,1.3,bay.back+.11,.05,2.55,.06,gold)
      }
    }
    if(!top){
      games=salonGames(inside)
      for(const [i,station] of gameStations.entries()){
        const z=station.z
        if(i<2){
          parts.add('post',-6,.47,z,1.10,.9,1.2,walnut)
          parts.add('post',-6,.96,z,2.28,.16,2.47,gold)
          parts.add('post',-6,1.057,z,2.17,.05,2.35,i===0?jade:plum)
          for(const side of [-1,1]){
            const x=-6+side*1.64
            parts.add('post',x,.15,z,.58,.10,.58,gold)
            parts.add('post',x,.32,z,.14,.36,.14,walnut)
            box(x,.51,z,.66,.17,.68,velvet[2]);box(x+side*.30,.76,z,.12,.59,.67,walnut)
            box(x+side*.231,.80,z,.09,.38,.57,velvet[2])
            for(let k=0;k<5;k++)parts.add('post',-6+side*.81,1.105+k*.024,z-.37,.12,.024,.12,k%2?ivory:plum)
          }
          for(let j=0;j<7;j++)box(-6,1.093+j*.012,z-.86,.19,.011,.26,j%2?ivory:night)
          parts.add('post',-6,3.88,z,.048,.95,.048,gold)
          parts.add('pine',-6,3.32,z,1.51,.50,1.51,jade)
          parts.add('post',-6,3.075,z,1.49,.045,1.49,0xffe2ac)
          makeSign(inside,i===0?'FIVE-CARD DRAW':'BLACKJACK',-9.28,2.23,z,2.4,.41,Math.PI/2)
        }else{
          box(8.66,.85,z,.95,1.70,1.20,jade);box(8.37,1.84,z,.58,1.22,1.32,plum)
          box(8.06,1.81,z,.08,.60,1.18,gold)
          for(const side of [-1,1]){
            box(8.035,1.82,z+side*.62,.09,1.22,.068,gold)
            for(let k=0;k<6;k++)parts.add('crown',7.979,1.32+k*.187,z+side*.62,.06,.066,.066,0xffd494)
          }
          box(8.07,1.19,z,.66,.13,1.19,walnut);parts.add('post',7.88,1.28,z+.28,.17,.055,.17,gold)
          box(7.88,1.27,z-.23,.19,.038,.29,night)
          parts.add('post',6.72,.08,z,.60,.11,.60,gold)
          parts.add('post',6.72,.32,z,.14,.45,.14,walnut)
          parts.add('post',6.72,.54,z,.64,.15,.64,plum)
          makeSign(inside,'STARLIGHT',8.03,2.28,z,1.13,.23,-Math.PI/2)
        }
      }
    }else{
      // A dry billiards lounge beside the guest lift.
      box(-5.6,.94,6.05,3.62,.23,1.62,walnut)
      box(-5.6,1.07,6.05,3.41,.06,1.41,jade)
      for(const dx of [-1.50,1.50])for(const dz of [-.56,.56])box(-5.6+dx,.45,6.05+dz,.19,.90,.19,walnut)
      for(const dx of [-1.68,0,1.68])for(const dz of [-.69,.69])parts.add('post',-5.6+dx,1.11,6.05+dz,.16,.026,.16,night)
      for(const [dx,dz,c] of [[-.8,.06,ivory],[.48,0,plum],[.63,.08,gold],[.63,-.08,0x315b68]])parts.add('crown',-5.6+dx,1.16,6.05+dz,.11,.11,.11,c)
      makeSign(inside,'BILLIARD LOUNGE',-5.6,2.6,7.57,3.3,.44,Math.PI)
      for(const z of [-12.1,-21.6]){
        parts.add('post',2.46,.36,z,.65,.72,.65,ivory)
        parts.add('post',2.46,1.13,z,.115,1.37,.115,walnut)
        for(let i=0;i<7;i++){
          const a=i*Math.PI*2/7
          parts.add('crown',2.46+.29*Math.sin(a),1.94,z+.29*Math.cos(a),.32,.20,.98,i%2?0x618569:0x487361,a)
        }
      }
      // Tiled sunken basin with lane mosaics and gently lit water.
      box(5.975,-1.28,-17,4.95,.18,9.80,0x468e92)
      for(const x of [3.52,8.43])box(x,-.6,-17,.09,1.24,9.80,0x78aca5)
      for(const z of [-21.88,-12.12])box(5.97,-.6,z,4.95,1.24,.09,0x78aca5)
      for(const x of [4.7,7.1])box(x,-1.18,-17,.12,.02,8.96,0x234f5b)
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128
      const ctx=canvas.getContext('2d')!;ctx.fillStyle='#70beb5';ctx.fillRect(0,0,128,128)
      for(let n=0;n<38;n++){
        const x=n*41%128,y=n*37%124
        ctx.strokeStyle=n%3?'#c2f0db68':'#539b9588';ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(x-5,y);ctx.bezierCurveTo(x+3,y+1,x+8,y-4,x+15,y-2);ctx.stroke()
      }
      const water=new T.CanvasTexture(canvas);water.colorSpace=T.SRGBColorSpace;water.wrapS=water.wrapT=T.RepeatWrapping;water.repeat.set(2,4)
      const surface=new T.Mesh(new T.PlaneGeometry(4.94,9.78),new T.MeshStandardMaterial({map:water,color:0xb4e6d8,transparent:true,opacity:.64,roughness:.20,metalness:.16,side:T.DoubleSide}))
      surface.rotation.x=-Math.PI/2;surface.position.set(5.975,-.13,-17);inside.add(surface)
      for(let n=0;n<20;n++)for(const x of [3.39,8.56])box(x,.03,-21.73+n*.50,.19,.055,.46,n%4?ivory:jade)
      for(let n=0;n<10;n++)for(const z of [-22,-12])box(3.72+n*.50,.03,z,.46,.055,.19,n%4?ivory:jade)
      for(const x of [4.64,7.31]){
        parts.add('post',x,.46,-12.05,.07,.93,.07,gold)
        parts.add('post',x,.46,-12.84,.07,.93,.07,gold)
        box(x,.94,-12.45,.07,.07,.86,gold)
      }
      for(let i=0;i<4;i++)box(5.975,-.2-i*.24,-12.35-i*.35,2.29,.18,.40,0x9ac2b4)
      makeSign(inside,'PALM BATHS',5.9,2.58,-22.96,4.65,.53)
    }
    parts.finish(inside);shell.finish(group)
  }
  const update=(v:WorldView,prepared:boolean)=>{
    games?.update(v)
    for(const level of levels){
      level.group.visible=!prepared||(v.you.zone!=='hotel'&&v.you.zone!=='casino')
      level.inside.visible=!prepared||v.you.zone===level.floor
    }
    const people=[v.you,...v.players]
    for(const {spray,room} of showers){
      spray.visible=people.some(p=>p.zone===room.floor&&p.shower?.room===room.number&&p.shower.until>v.now)
      if(spray.visible)spray.position.y=.18*Math.sin(v.now/180)
    }
    for(const {mesh,room} of doors){
      const open=guestFloor(v.you.zone)&&v.you.zone===room.floor&&v.housing?.keys.includes(room.id)
      mesh.rotation.y=open?room.side*Math.PI/2:0
    }
  }
  return {update,tick:(reduced:boolean)=>games?.tick(reduced)}
}
