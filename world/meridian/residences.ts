import type {Resolved} from './parcels.ts'
import type {Unit,Tenure} from '../../src/world/housing.ts'
import type {Building,Door,Rect,Wall,Opening,Floor,Stair,Fixture,HomePose} from '../../src/world/residential.ts'
import {along} from '../../src/world/geo.ts'
import {layouts,houseStyles,houseDesign,flatEdges,towerClerk} from '../../src/world/house-styles.ts'
export function residences(s:Resolved){
  const {streets:STREETS,houses,apartments:RESIDENCES}=s
  const HOMES=houses.map(h=>[h.x,h.z])
  const address=(i:number)=>(i+1)+' '+STREETS.find(r=>r.id===houses[i].street)!.name
  const UNITS:Unit[]=[
    ...HOMES.map(([x,z],i)=>({id:houses[i].id,name:address(i),x,z,facing:houses[i].facing,width:6,floor:0,
      bedrooms:houseDesign(i)===2?2:1,layout:houseStyles[houseDesign(i)],tenure:(i%3===0?'resident':i%4===0?'resident':i%2?'buy':'rent') as Tenure,price:i%2?2800+i*135:140+i*8})),
    ...RESIDENCES.flatMap((b,block)=>[1,2,3,4].flatMap(floor=>layouts.map((layout,i)=>({
      id:'flat-'+block+'-'+(floor===1?i:(floor-1)*3+i),name:b.name+' · '+(floor*100+i+1),
      x:b.x+(flatEdges[i]+flatEdges[i+1])/2,z:b.z-4.85,facing:1,width:flatEdges[i+1]-flatEdges[i],block,floor,
      bedrooms:i===2?2:1,layout,tenure:(floor===1&&i===block||block===2?'resident':(i+block+floor-1)%2?'rent':'buy') as Tenure,
      price:((i+block+floor-1)%2?60+(4+i)*18:800+(4+i)*280)+(floor-1)*((i+block+floor-1)%2?18:180),
    })))),
    ...s.towers.flatMap((t,i)=>Array.from({length:t.levels-1},(_,j):Unit=>{
      const floor=j+1,block=RESIDENCES.length+i
      return {id:'loft-'+i+'-'+floor,name:t.name+' · '+floor+'01',x:t.x-1.43,z:t.z,facing:1,width:t.w-2.86,block,floor,
        bedrooms:1,layout:floor===t.levels-1?'Top-floor apartment':'Full-floor apartment',
        tenure:floor%2?'rent':'buy',price:floor%2?90+floor*16:1000+floor*240}
    })),
  ]
  const floor=():Floor=>({walls:[],fixtures:[],doors:[],points:[],units:[],tiles:[]})
  const all:Building[]=[]
  const bounds=(l:number,r:number,b:number,f:number):Rect=>({l,r,b,f})
  const win=(at:number,width=1.65):Opening=>({kind:'window',at,width})
  const door=(at:number,id:string,unit?:string,reverse?:boolean):Opening=>({kind:'door',at,width:unit?1.08:1.02,id,unit,reverse})
  function wall(f:Floor,axis:Wall['axis'],fixed:number,from:number,to:number,openings:Opening[]=[],outer=false){
    const at=(from+to)/2
    f.walls.push({axis,x:axis==='x'?at:fixed,z:axis==='x'?fixed:at,length:Math.abs(to-from),openings,outer})
    for(const o of openings)if(o.kind==='door'&&o.id){
      const d:Door={id:o.id,axis,x:axis==='x'?o.at:fixed,z:axis==='x'?fixed:o.at,width:o.width,unit:o.unit,reverse:o.reverse}
      f.doors.push(d)
      f.points.push({...d,id:'door:'+d.id,label:'Open door',range:1.29,door:d})
    }
  }
  function furnish(f:Floor,kind:Fixture['kind'],x:number,z:number,w:number,d:number,yaw=0,unit?:string,dining=false){
    const id=(unit??'lobby')+'-'+f.fixtures.length
    const item={id,kind,x,z,w,d,yaw,unit,dining}
    f.fixtures.push(item)
    if(kind==='chair'||kind==='sofa'||kind==='bed'){
      const count=kind==='sofa'?Math.round(w/.77):1
      for(let i=0;i<count;i++){
        const dx=(i-(count-1)/2)*.67
        const exit=kind==='bed'?along(item,w/2+.40,0,yaw):along(item,dx,(d/2+.38)*(dining?1:-1),yaw)
        const position=kind==='bed'?along(item,0,d*.35,yaw):along(item,dx,0,yaw)
        const pose:HomePose={...position,yaw,id:id+'-'+i,kind:kind==='bed'?'rest':'sit',height:kind==='bed'?.62:.46}
        f.points.push({...exit,id:'furniture:'+pose.id,label:kind==='bed'?'Lie down':'Sit down',range:1.02,pose,exit,unit})
      }
    }
    if(kind==='counter'&&unit)f.points.push({...along(item,0,-d/2-.4,yaw),id:'drawer:'+id,label:'Open storage drawer',range:1.08,unit})
    if(kind==='fridge')f.points.push({...along(item,0,-d/2-.4,yaw),id:'fridge:'+id,label:'Open fridge',range:1.08,unit})
  }
  function plan(f:Floor,r:Rect,id:string,template:number,upper=false,sideEntry=false){
    const {l,r:right,b,f:front}=r,w=right-l,row=b+(upper?3:3.18),family=template===2
    const split=l+w*(family?.5:.57)
    const interior=(label:string,at:number,reverse?:boolean)=>door(at,id+'-'+label,undefined,reverse)
    const fixture=(kind:Fixture['kind'],x:number,z:number,w:number,d:number,yaw=0,dining=false)=>furnish(f,kind,x,z,w,d,yaw,id,dining)
    const bedroom=(left:number,edge:number,head:number)=>{
      fixture('bed',left+.84,head+1.16,1.35,2.04)
      if(edge-left>2.7)fixture('wardrobe',edge-.39,head+.55,.68,.93)
    }
    const bathroom=(left:number,edge:number,back:number,end:number)=>{
      f.tiles.push({rect:bounds(left+.07,edge-.07,back+.07,end-.07),kind:'bath'})
      fixture('shower',edge-.53,back+.53,.86,.86)
      fixture('toilet',left+.43,back+.46,.43,.68)
      fixture('vanity',edge-.36,end-.53,.7,.48,Math.PI/2)
    }
    wall(f,'x',row,l,right,[interior('bedroom',split-.74,true),interior(family?'second-bedroom':'bathroom',split+.76)])
    wall(f,'z',split,b,row)
    bedroom(l,split,b)
    if(family)bedroom(split,right,b)
    else bathroom(split,right,b,row)
    if(upper){
      fixture('sofa',l+.96,front-.6,1.55,.78)
      return
    }
    const k=family?right-2.04:l+w*.61
    if(family){
      wall(f,'z',k,row,row+2.25,[interior('bathroom',row+1.12,true)])
      wall(f,'x',row+2.25,k,right)
      bathroom(k,right,row,row+2.25)
    }else if(template===1){
      wall(f,'z',k,row+.06,front,[interior('kitchen',row+1.43,true)])
      fixture('wardrobe',l+.39,row+.57,.59,.91)
    }
    const depth=front-row
    fixture('sofa',l+.51,row+depth*.61,depth>3.65?1.69:1.48,.77,-Math.PI/2)
    if(w>=6.1&&depth>=3.65)fixture('coffee',l+2.06,row+depth*.70,.67,.44,Math.PI/2)
    if(family&&w>7)fixture('media',l+2.32,front-.27,1.25,.39,Math.PI)
    const kitchenFront=family?row+2.25:row
    const run=Math.min(1.72,front-kitchenFront-1.04)
    if(sideEntry)fixture('counter',right-1.75,front-.36,run,.58)
    else fixture('counter',right-.34,kitchenFront+run/2+.09,run,.58,Math.PI/2)
    fixture('fridge',right-.4,front-.52,.67,.7,Math.PI/2)
    if(!family&&w>=5.7&&depth>=3.52){
      const tx=template===1?k+.62:right-1.83,tz=front-(template===1?.39:1.6)
      fixture('table',tx,tz,.72,.72)
      fixture('chair',tx,tz-.84,.49,.51,Math.PI,true)
    }else if(family&&w>=7.2){
      fixture('table',l+3.42,front-.72,.85,.7)
      fixture('chair',l+3.42,front-1.56,.51,.5,Math.PI,true)
    }
  }
  function shell(f:Floor,r:Rect,front:Opening[],rear:Opening[],sideWindows=false){
    wall(f,'x',r.f,r.l,r.r,front,true)
    wall(f,'x',r.b,r.l,r.r,rear,true)
    for(const x of [r.l,r.r])wall(f,'z',x,r.b,r.f,sideWindows?[win((r.b+r.f)/2,1.22)]:[],true)
  }
  function stairWalls(f:Floor,s:Stair,level:number,last:number){
    const {x,front,back,width}=s
    for(const side of [-1,1])wall(f,'z',x+side*width,back,front)
    wall(f,'x',back,x-width,x+width)
    wall(f,'x',front,x-width,x+width,[
      ...(level<last?[{kind:'lift' as const,at:x-width/2,width:width-.18}]:[]),
      ...(level>0?[{kind:'lift' as const,at:x+width/2,width:width-.18}]:[]),
    ])
  }
  for(const [block,place] of RESIDENCES.entries()){
    const rect=bounds(-10.4,10.4,-8.5,7.1)
    // The switchback runs towards the street. The hallway is on the north side.
    const stair={x:-8.05,front:1.55,back:6.61,width:1.68}
    const lift={x:8.45,z:3.02},levels=Array.from({length:place.levels},floor)
    const id=place.id
    for(const [level,f] of levels.entries()){
      const balcony=level>0&&(level+block)%2===0
      const rear=[-8.3,-5.75,-2.75,.55,3.65].map(n=>win(n,1.55))
      if(balcony){
        rear.push(win(7.01,1.08),door(8.63,id+'-balcony-'+level))
        f.tiles.push({rect:bounds(6.41,10.25,-9.95,-8.5),kind:'balcony'})
      }else rear.push(win(7.75,1.55))
      shell(f,rect,[win(-8,1.42),...(level===0?[door(0,id+'-street'),win(-3.75,2.3),win(4.6,2.2)]:[win(-3.75,2.3),win(0,1.5),win(4.6,2.2)])],
        rear,true)
      stairWalls(f,stair,level,4)
      for(const x of [lift.x-1.12,lift.x+1.12])wall(f,'z',x,2.03,4.42)
      wall(f,'x',4.42,lift.x-1.12,lift.x+1.12)
      wall(f,'x',2.03,lift.x-1.12,lift.x+1.12,[{kind:'lift',at:lift.x,width:1.53}])
      f.points.push({id:'call:'+id,x:lift.x-1.03,z:1.61,label:'Call elevator',range:1.03},{id:'lift:'+id,...lift,label:'Use elevator',range:.99})
      if(level===0){
        furnish(f,'desk',4.6,-.12,2.85,.83,Math.PI)
        furnish(f,'mail',-9.91,-2.93,1.38,.45,Math.PI/2)
        furnish(f,'sofa',-4.25,-6.75,2.22,.83,Math.PI)
        furnish(f,'coffee',-4.25,-5.16,1.25,.63)
        furnish(f,'chair',-6,-5.22,.72,.76,Math.PI/2)
        furnish(f,'chair',-2.35,-5.22,.72,.76,-Math.PI/2)
        furnish(f,'plant',-6.5,4.9,.55,.55)
        furnish(f,'plant',6,5.12,.55,.55)
        furnish(f,'sofa',4.9,-7.19,2.36,.86,Math.PI)
        furnish(f,'chair',7,-5.74,.70,.76,-Math.PI/2)
        furnish(f,'coffee',4.88,-5.68,1.19,.65)
        furnish(f,'plant',1.34,-7.64,.79,.79)
        furnish(f,'plant',9.74,-7.64,.71,.71)
        continue
      }
      const units=UNITS.filter(u=>u.block===block&&u.floor===level)
      for(const [i,u] of units.entries()){
        const l=flatEdges[i],r=flatEdges[i+1],unit=bounds(l,r,-8.5,-1.1)
        const entry=i===2?r-3.5:l+2.46
        wall(f,'x',-1.1,l,r,[door(entry,u.id,u.id)])
        if(i)wall(f,'z',l,-8.5,-1.1)
        f.units.push({id:u.id,rect:unit,exit:{x:entry,z:-.39}})
        plan(f,unit,u.id,i)
        if(i)wall(f,'z',entry-.75,-2.03,-1.1)
        if(i)f.tiles.push({rect:bounds(entry-.62,entry+.58,-2.04,-1.16),kind:'kitchen'})
      }
    }
    all.push({id,x:place.x,z:place.z,facing:1,rect,levels,style:block,block,stairs:stair,lift})
  }
  for(const [i,t] of s.towers.entries()){
    const block=RESIDENCES.length+i,id='block-'+block,rect=bounds(-t.w/2,t.w/2,4.6-t.d,4.6)
    const lift={x:rect.r-1.35,z:3.02},levels=Array.from({length:t.levels},floor)
    const split=rect.r-2.87
    for(const [level,f] of levels.entries()){
      const front=level||t.baseY?[win(-t.w*.25),win(t.w*.14,1.08)]:[door(0,id+'-street'),win(-t.w*.31,1.38)]
      shell(f,rect,front,[win(-t.w*.26,1.52),win(t.w*.22,1.36)],true)
      for(const x of [lift.x-1.12,lift.x+1.12])wall(f,'z',x,2.03,4.42)
      wall(f,'x',4.42,lift.x-1.12,lift.x+1.12)
      wall(f,'x',2.03,lift.x-1.12,lift.x+1.12,[{kind:'lift',at:lift.x,width:1.53}])
      f.points.push({id:'call:'+id,x:lift.x-1.03,z:1.61,label:'Call elevator',range:1.03},
        {id:'lift:'+id,...lift,label:'Use elevator',range:.99})
      if(level===0){
        furnish(f,'desk',towerClerk.x,towerClerk.z+.84,2.26,.76,Math.PI)
        furnish(f,'sofa',rect.l+.54,1.37,1.75,.80,-Math.PI/2)
        furnish(f,'mail',rect.r-.26,-.86,1.15,.41,Math.PI/2)
        furnish(f,'plant',rect.l+.53,rect.b+.61,.62,.62)
        if(t.baseY)f.points.push({id:'exchange-lobby',label:'Take the express lift to reception',x:0,z:rect.b+.85,range:1.30})
      }else{
        const u=UNITS.find(u=>u.block===block&&u.floor===level)!
        const unit=bounds(rect.l,split,rect.b,rect.f),entry=1.02
        wall(f,'z',split,rect.b,rect.f,[door(entry,u.id,u.id)])
        f.units.push({id:u.id,rect:unit,exit:{x:split+.66,z:entry}})
        plan(f,unit,u.id,0,false,true)
        furnish(f,'plant',rect.r-.49,rect.b+.58,.53,.53)
      }
    }
    all.push({id,x:t.x,z:t.z+t.d/2-rect.f,facing:1,rect,levels,style:t.style,block,lift,tower:true,baseY:t.baseY})
  }

  for(const [i,[x,z]] of HOMES.entries()){
    const u=UNITS[i],style=houseDesign(i),levels=Array.from({length:houses[i].levels},floor)
    const rect=style===3?bounds(-3.14,3.14,-4.1,3.35):bounds(-2.94,2.94,-3.85,3.35),id=u.id
    const stair=levels.length>1?{x:1.55,front:1.43,back:-3.51,width:1.25}:undefined
    for(const [level,f] of levels.entries()){
      shell(f,rect,level?[win(-1.45),win(1.52)]:[door(0,id,i%3===0?undefined:id),win(-1.89,1.05),win(1.89,1.05)],
        [win(-1.57,1.38),win(1.52,1.39)],true)
      f.units.push({id,rect,exit:{x:0,z:4.05}})
      if(stair){
        stairWalls(f,stair,level,1)
        const add=(kind:Fixture['kind'],x:number,z:number,w:number,d:number,yaw=0,dining=false)=>furnish(f,kind,x,z,w,d,yaw,id,dining)
        if(level===0){
          wall(f,'x',-2.15,-2.94,.3,[door(-1.35,id+'-wc')])
          f.tiles.push({rect:bounds(-2.85,.21,-3.76,-2.23),kind:'bath'})
          add('shower',-2.37,-3.25,.85,.85);add('toilet',-.2,-3.35,.43,.65)
          add('vanity',-.13,-2.59,.43,.65)
          add('counter',-2.55,-1.17,1.6,.61,-Math.PI/2);add('fridge',-2.53,.15,.68,.71,-Math.PI/2)
          add('sofa',-2.38,1.67,1.67,.79,-Math.PI/2);add('chair',1.25,2.83,.62,.63,-Math.PI/2,true)
          add('table',2.14,2.83,.72,.64)
        }else{
          wall(f,'x',-.93,-2.94,.3,[door(-1.03,id+'-bed-a')])
          wall(f,'z',-.56,1.36,3.35)
          wall(f,'x',1.36,-2.94,-.56,[door(-1.32,id+'-bed-b',undefined,true)])
          add('bed',-2.07,-2.58,1.38,1.99)
          add('bed',-1.96,2.45,1.18,1.52)
          add('wardrobe',-.27,-3.3,.71,.78)
        }
      }else plan(f,rect,id,style===1?1:0)
    }
    all.push({id,x,z,rect,style:style+2,facing:u.facing,levels,stairs:stair})
  }
  return {units:UNITS,buildings:all}
}
