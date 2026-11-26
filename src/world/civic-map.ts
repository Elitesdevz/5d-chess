import {cells,civicRoom,deskFurniture,design,entrances,footprint,front,doorLeaves,levelOf,origins,shopCases,shopCounter,stair,type CivicRoom} from './civic-venues.ts'
import {circle,CROSSINGS,FLEET,LANDMARKS,PARKING,PARKS,STREETS,type Point} from './city-plan.ts'
import {PATHS} from './urban-layout.ts'
import {BUILDINGS,residentialPoints} from './residential.ts'
import {CITY_PORTALS,interactions,PLAN,type WorldView} from './model.ts'

export function civicMap(ctx:CanvasRenderingContext2D,w:number,h:number,view:WorldView,eye:Point&{yaw:number}){
  const room=view.you.zone,out=room==='city'
  if(!out&&!civicRoom(room))return false
  // The outdoor plan leaves enough street on screen to choose the next turn.
  const plot=out?undefined:footprint[design(room as CivicRoom)]
  // Keep the complete plan, including a player just inside the door, above
  // the interaction prompt and nine-slot hotbar on short screens.
  const planHeight=Math.max(h*.48,h-176)
  const size=plot?Math.min((w-24)/(plot.w+1),planHeight/(plot.d+1.35),52):Math.max(6,Math.min(13,w/61))
  const center=out?eye:origins[design(room as CivicRoom)],middle=out?h/2:35+planHeight/2
  const px=(x:number)=>w/2+(x-center.x)*size,py=(z:number)=>middle+(z-center.z)*size
  const visible=(x:number,z:number,margin=90)=>px(x)>-margin&&px(x)<w+margin&&py(z)>-margin&&py(z)<h+margin
  function rect(x:number,z:number,a:number,b:number,fill:string,line?:string){
    const l=px(x-a/2),t=py(z-b/2)
    ctx.fillStyle=fill;ctx.fillRect(l,t,a*size,b*size)
    if(line){ctx.strokeStyle=line;ctx.lineWidth=1.5;ctx.strokeRect(l,t,a*size,b*size)}
  }
  function path(points:readonly Point[],width:number,color:string){
    if(!points.length)return
    ctx.beginPath();ctx.moveTo(px(points[0].x),py(points[0].z))
    for(const p of points.slice(1))ctx.lineTo(px(p.x),py(p.z))
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,width*size);ctx.stroke()
  }
  function text(label:string,x:number,z:number,color='#fff1d1',font=12,bg?:string){
    if(!visible(x,z))return
    ctx.font='600 '+font+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle'
    if(bg){const tw=ctx.measureText(label).width;ctx.fillStyle=bg;ctx.fillRect(px(x)-tw/2-5,py(z)-font*.8,tw+10,font*1.65)}
    ctx.fillStyle=color;ctx.fillText(label,px(x),py(z))
  }
  ctx.fillStyle=out?'#536b5d':'#243637';ctx.fillRect(0,0,w,h)
  function street(){
    for(const p of PARKS)rect(p.x,p.z,p.w,p.d,'#476a50','#809879')
    for(const s of STREETS)path([s.a,s.b],s.width+s.walk*2,'#b2ab93')
    for(const s of STREETS)path([s.a,s.b],s.width,s.traffic?'#455153':'#b6a68a')
    ctx.setLineDash([size*.75,size*.95])
    for(const s of STREETS)if(s.traffic)path([s.a,s.b],.07,'#c9bc96')
    ctx.setLineDash([])
    ctx.beginPath();ctx.arc(px(circle.x),py(circle.z),circle.radius*size,0,Math.PI*2);ctx.lineWidth=circle.width*size;ctx.strokeStyle='#465253';ctx.stroke()
    for(const p of PATHS)path(p.points,p.width,'#b9ad90')
    for(const c of CROSSINGS)for(let i=-2;i<=2;i++)rect(c.x+(c.axis==='x'?i*.7:0),c.z+(c.axis==='z'?i*.7:0),c.axis==='x'?.25:1.2,c.axis==='x'?1.2:.25,'#ddd6bc')
    for(const b of LANDMARKS)if(b.id!=='police'){rect(b.x,b.z,b.w,b.d,'#75817a','#c1c6b3');text(b.name,b.x,b.z,'#fdf1d6',10,'#44524de8')}
    for(const b of BUILDINGS){const r=b.rect;rect(b.x+(r.l+r.r)/2*b.facing,b.z+(r.b+r.f)/2*b.facing,r.r-r.l,r.f-r.b,'#8a8075','#c4b8a3')}
    for(const id of ['hotel','casino','bank','exchange','kfc'] as const){
      const b=PLAN[id];rect(b.x,b.z+(b.front+b.back)/2,b.width*2,b.front-b.back,'#7d8782','#c9c4ac');text(CITY_PORTALS.find(p=>p.to===id)?.label??'Gaming floor',b.x,b.z,'#192e31',11)
    }
    for(const p of CITY_PORTALS){
      if(!p.label&&p.to==='cave'&&!view.caveOpen)continue
      rect(p.x,p.z,1.3,.21,'#e8c78a')
      if(!p.label)text('Passage',p.x,p.z-.64,'#fff0d2',10,'#42524c')
    }
    for(const p of [...interactions('city',view.housing?.keys),...residentialPoints('city',eye,view.housing?.keys??[],view.residential)]){
      if(p.id.startsWith('enter-')||Math.hypot(p.x-eye.x,p.z-eye.z)>10)continue
      rect(p.x,p.z,.25,.25,'#ffe0a5')
      text(p.label,p.x,p.z-.60,'#eff1dc',10,'#455551db')
    }
    for(const b of PARKING){
      ctx.save();ctx.translate(px(b.x),py(b.z));ctx.rotate(-b.yaw)
      ctx.strokeStyle='#ddd9c5';ctx.lineWidth=1;ctx.strokeRect(-size, -2.12*size,2*size,4.24*size);ctx.restore()
    }
    for(const id of ['station','gunshop'] as const){
      const o=origins[id],f=footprint[id],p=entrances[id]
      rect(o.x,o.z,f.w,f.d,id==='station'?'#34566a':'#694858','#e8c792')
      rect(p.x,o.z+front[id].z,1.9,.29,'#e6c67e')
      text(id==='station'?'Meridian Police':'Pulse & Pixel',o.x,o.z,'#fff0c3',12)
    }
    text('C I V I C   A V E N U E',-51.4,-65,'#eee7cf',10,'#455153')
    for(const v of view.traffic?.vehicles??[]){
      if(!visible(v.x,v.z,30))continue
      const f=FLEET[v.kind],a=f.w*size,b=f.length*size
      ctx.save();ctx.translate(px(v.x),py(v.z));ctx.rotate(-v.yaw)
      ctx.fillStyle=v.kind==='police'?'#e1e6db':v.kind==='fire'?'#aa5348':'#978474'
      ctx.fillRect(-a/2,-b/2,a,b)
      ctx.strokeStyle='#38494a';ctx.lineWidth=1;ctx.strokeRect(-a/2,-b/2,a,b)
      ctx.fillStyle='#526d76';ctx.fillRect(-a*.39,-b*.22,a*.78,b*.44)
      if(v.kind==='police'){ctx.fillStyle='#6fb3c6';ctx.fillRect(-a*.29,-b*.046,a*.58,b*.09)}
      ctx.restore()
    }
  }
  function interior(zone:CivicRoom){
    const id=design(zone),o=origins[id],f=footprint[id],n=levelOf(zone)
    const block=(x:number,z:number,a:number,b:number,c:string,line?:string)=>rect(o.x+x,o.z+z,a,b,c,line)
    const caption=(s:string,x:number,z:number,sz=11)=>text(s,o.x+x,o.z+z,'#fcf0d4',sz,'#203842eb')
    block(0,0,f.w,f.d,'#918f81','#e6dac1')
    for(let x=-f.w/2+.42;x<f.w/2;x+=.84)block(x,0,.018,f.d,'#797e75')
    for(let z=-f.d/2+.84;z<f.d/2;z+=.84)block(0,z,f.w,.018,'#797e75')
    for(const side of [-1,1]){block(side*f.w/2,0,.17,f.d,'#263c43');block(0,side*f.d/2,f.w,.17,'#263c43')}
    if(!n){
      for(const x of id==='gunshop'?[-2.93,2.93]:[-7.5,-4.25,3.6,7]){
        block(x,front[id].z,id==='gunshop'?3.24:2.3,.11,'#93dce0')
        block(x,front[id].z,.06,.19,'#cfad71')
      }
      block(front[id].x,front[id].z,1.9,.17,'#f2cc83')
      for(const r of doorLeaves(id))block(r.x,r.z,r.w,r.d,'#8fcad0','#bc9c68')
      caption('CIVIC AVE',front[id].x,front[id].z+front[id].sign*.42,9)
    }
    if(zone==='gunshop'){
      block(0,.72,2.5,5.1,'#845c65','#d5b87e');block(shopCounter.x,shopCounter.z,shopCounter.w,shopCounter.d,'#65473b','#f5d3a4')
      caption('ARMORY COUNTER',0,shopCounter.z)
      for(let i=0;i<5;i++)block((i-2)*1.49,-f.d/2+.33,1.38,.19,'#627775','#dfc18d')
      for(const r of shopCases){block(r.x,r.z,r.w,r.d,'#80a4a8','#ecddbd');for(const dz of [-.8,.65])block(r.x,r.z+dz,.46,.22,'#bf8f56')}
      caption('DISPLAY',-3.86,.4,9);caption('DISPLAY',3.86,.4,9)
    }else{
      if(!n)for(const r of deskFurniture){block(r.x,r.z,r.w,r.d,'#65493f','#efce91');caption(r.id==='desk'?'FRONT DESK':'BOOKING',r.x,r.z)}
      if(n<5){
        block(0,2.04,2.44,2.57,'#607372','#ded6bd')
        for(let j=0;j<10;j++)block(0,stair.start+j*.204,2.32,.035,'#bcb8a3')
        block(0,1.69,.07,1.76,'#ba9b69');caption('↑',stair.up,1.72);caption('↓',stair.down,1.72)
      }
      if(n){
        block(0,0,f.w-.3,1.57,'#b2ab95')
        for(const c of cells.filter(c=>c.level===n)){
          block(c.x,c.z,c.w-.04,c.d,'#475c63','#9da9a2')
          block(c.x-.67,c.z,.77,1.81,'#8baeb0','#e2cfb2');block(c.x-.67,c.z+c.row*.61,.66,.36,'#d6d6be')
          block(c.x+.65,c.z+c.row*.56,.70,.52,'#9a7459','#c3ae88')
          block(c.x+.65,c.z-c.row*.57,.43,.54,'#dedfd6')
          for(let j=-4;j<=4;j++)block(c.x+j*.27,c.z-c.row*c.d/2,.064,.17,'#e2d8b7')
          caption(String(c.number).padStart(2,'0'),c.x,c.z-c.row*.66)
        }
        caption('A · WEST',-5.0,0,10);caption('B · EAST',5.0,0,10)
        caption('↓ L'+(n-1),stair.down,.28,9)
      }
    }
  }
  if(out)street();else interior(room as CivicRoom)
  const inmates=view.players.filter(p=>p.zone===room),active=view.arcade?.contacts.filter(c=>c.kind!=='player'&&c.zone===room)??[]
  for(const p of active){if(!visible(p.x,p.z,10))continue;ctx.beginPath();ctx.arc(px(p.x),py(p.z),out?3:5,0,Math.PI*2);ctx.fillStyle=p.kind==='officer'?'#8ac9ea':'#edcd92';ctx.fill()}
  for(const p of inmates){ctx.beginPath();ctx.arc(px(p.x),py(p.z),5,0,Math.PI*2);ctx.fillStyle='#f4b576';ctx.fill();text(p.name,p.x,p.z+.38,'#fff4ce',10,'#364246')}
  for(const p of view.arcade?.drops??[])rect(p.x,p.z,.48,.42,'#deb879','#704c30')
  ctx.save();ctx.translate(px(eye.x),py(eye.z));ctx.rotate(-eye.yaw);ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(7,7);ctx.lineTo(0,4);ctx.lineTo(-7,7);ctx.closePath();ctx.fillStyle='#a3f9d9';ctx.fill();ctx.strokeStyle='#244f48';ctx.lineWidth=2;ctx.stroke();ctx.restore()
  const title=out?'MERIDIAN  /  STREET PLAN':room==='gunshop'?'PULSE & PIXEL  /  SHOWROOM':levelOf(room)?'MERIDIAN POLICE  /  JAIL LEVEL '+levelOf(room):'MERIDIAN POLICE  /  GROUND FLOOR'
  ctx.font='600 12px system-ui';ctx.textAlign='left';ctx.fillStyle='#1e353aee';ctx.fillRect(12,12,ctx.measureText(title).width+25,28);ctx.fillStyle='#f2d69f';ctx.textBaseline='middle';ctx.fillText(title,24,26)
  return true
}
