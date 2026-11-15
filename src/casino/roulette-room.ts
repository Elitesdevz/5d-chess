import {RouletteConsole,CHIP_VALUES} from './roulette-console.ts'
import {PlayerRig} from './scene/rig.ts'
import {coinGeometry,box} from './scene/geometry.ts'
import type {Materials} from './scene/materials.ts'
import {ClubGuest} from './roulette-cast.ts'
import {buildSalon} from './roulette-salon.ts'
import * as T from 'three'
import {ROULETTE_ORDER,pocketColor,rouletteWins,winProbability,grossMultiplier,casinoCoins,type RouletteChoice,type CasinoRound} from '../casino-model.ts'
import {rules} from './casino-panels.ts'
const tau=Math.PI*2,step=tau/37,v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),ease=(p:number)=>p*p*(3-2*p)
const mat=(color:number,metalness=0,roughness=.55)=>new T.MeshStandardMaterial({color,metalness,roughness})
interface Key {button:HTMLButtonElement;position:T.Vector3;width:number;depth:number;choice?:RouletteChoice;mesh?:T.Mesh;mode?:'mat'|'chips'|'seat';zone?:'mat'|'chips'}
/** A presentation of a previously settled round. No random outcome or payout logic lives here. */
export class RouletteRoom{
 private world=new T.Scene();private camera=new T.PerspectiveCamera(49,1,.1,70);private renderer:T.WebGLRenderer
 private room:HTMLElement;private canvas:HTMLCanvasElement;private keys:Key[]=[];private rotor=new T.Group();private wheel=new T.Group();private ball:T.Mesh;private chip:T.Mesh;private patrons:ClubGuest[]=[];private dealer:ClubGuest;private player:PlayerRig;private finishes!:Materials;private wagerCoins=new T.Group();private coinOwner='tray';private focusMode:'seat'|'mat'|'chips'='seat';private matBlend=0;private chipBlend=0;private furniture!:RouletteConsole;private matEdge!:T.Mesh;private chipCounts:number[]=[0,0,1,0,0];private hotZone?:'mat'|'chips';private inputEvents=new AbortController()
 private busy=false;private active=false;private cameraLocked=false;private yaw=0;private pitch=0;private frame=0;private last=0;private observer:ResizeObserver;private disposed=false;private raf=0
 private choice:RouletteChoice='white';private stake=100;private coins=0;private rotation=0;private spinAt=0;private animationCheckpoint=0;private endRotation=0;private ballStart=0;private ballEnd=0;private result=0;private won=false;private rarity=0;private complete?:()=>void
 private sparkGeometry=new T.BufferGeometry();private halo:T.Mesh;private winLight:T.PointLight;private winCoins:T.InstancedMesh;private sparks:T.Points;private burstAt=-Infinity;private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;private drag?:{x:number;y:number;yaw:number;pitch:number}
 private look=v(.05,1.02,.08);private spinLook=v(-1.03,1.08,-.45);private camBlend=0;private textureCache=new Map<string,T.CanvasTexture>();private fence:WebGLSync|null=null
 constructor(root:HTMLElement){
  this.room=document.createElement('section');this.room.className='roulette-room';this.room.innerHTML=`<canvas id="roulette-canvas" tabindex="0" aria-label="Royal Table roulette room. Drag empty space to look around; Home centers your view."></canvas><div class="roulette-room-vignette"></div><header class="roulette-room-tools"><div><span>THE CHESS CLUB · TABLE 01</span><h1>The Royal Table</h1></div><nav><button type="button" data-room-center>Center</button><button type="button" data-room-bets>All bets</button><button type="button" data-room-rules>Rules</button><button type="button" data-room-history>History</button></nav></header><div class="roulette-table-keys" aria-label="Physical table controls"></div><div class="roulette-room-hud"><div><small>YOUR WAGER</small><strong data-room-choice>White court</strong><span data-room-odds></span></div><div><small>WIN RETURN</small><strong data-room-return></strong><span>1% of profit goes to CasinoOwner</span></div></div><p class="roulette-room-announcement" role="status" aria-live="polite"></p><p class="roulette-room-hint">Look around · Touch the mat or chips to play</p><section class="roulette-focus-summary" role="status" aria-live="polite" hidden><span data-focus-title>CHOOSE YOUR BET</span><strong><span data-focus-stake>100</span><small> COINS BET</small></strong><span data-focus-multiplier>2× return</span></section><section class="roulette-chip-picker" hidden aria-label="Choose chips"><header><span>BUILD YOUR STAKE</span><button type="button" data-chip-custom>Custom amount</button></header><div class="roulette-chip-rows">${CHIP_VALUES.map((value,i)=>`<div class="roulette-chip-row" style="--chip-color:${['#ded5bb','#548b7e','#426e91','#a75365','#b98b43'][i]}"><span class="roulette-chip-badge">${value.toLocaleString()}</span><button type="button" data-chip-minus="${i}" aria-label="Remove ${value} coin chip">−</button><output data-chip-count="${i}">0</output><button type="button" data-chip-plus="${i}" aria-label="Add ${value} coin chip">+</button></div>`).join('')}</div></section><button type="button" class="roulette-focus-back" hidden>↓ Back to your seat <small>Esc / swipe down</small></button><dialog class="table-modal roulette-room-modal"><button type="button" data-close-room-modal aria-label="Close roulette information">×</button><div data-room-modal-content></div></dialog><dialog class="table-modal roulette-amount-modal"><form><h2>Place your chips</h2><label>Stake in coins<input type="number" min="1" max="100000" step="1" required></label><div class="modal-actions"><button type="button" data-cancel-room-amount>Cancel</button><button type="submit">Set stake</button></div></form></dialog>`
  root.prepend(this.room);this.canvas=this.room.querySelector('canvas')!
  try{this.renderer=new T.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:false,powerPreference:'high-performance'})}catch(e){this.room.remove();throw e}
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15
  this.world.background=new T.Color(0x162a32);this.world.fog=new T.Fog(0x162a32,9,24)
  this.world.add(new T.HemisphereLight(0xc4dcde,0x3a2822,1.2));const keyLight=new T.DirectionalLight(0xffe1b0,3.1);keyLight.position.set(1,7,4);this.world.add(keyLight)
  const rim=new T.PointLight(0x83c1e5,26,12);rim.position.set(-4,3,-2);this.world.add(rim)
  this.buildRoom();this.buildTable();this.buildWheel();this.player=new PlayerRig(this.world,this.finishes);this.dealer=new ClubGuest(this.world,.15,-1.35,0xb58262,0x26333a,true);this.patrons.push(new ClubGuest(this.world,-2.4,-.6,0xd3a580,0x50313d,false,1),new ClubGuest(this.world,2.4,-.7,0x916447,0x2e4942,false,2));const minted=coinGeometry();for(let i=0;i<7;i++){const coin=this.mesh(minted,this.finishes.gold,v(0,i*.008,0),this.wagerCoins);coin.scale.setScalar(.65)}this.world.add(this.wagerCoins);this.wagerCoins.visible=false;this.furniture=new RouletteConsole(this.world,this.finishes)
  this.ball=this.mesh(new T.SphereGeometry(.025,16,12),mat(0xfff4db,.35,.17),v(-.5,1.15,0));this.chip=this.mesh(new T.CylinderGeometry(.066,.066,.025,24),mat(0xf2d29b,.4,.3),v(.3,1.08,0))
  const positions=new Float32Array(128*3);this.sparkGeometry.setAttribute('position',new T.BufferAttribute(positions,3));this.sparks=new T.Points(this.sparkGeometry,new T.PointsMaterial({color:0xffd58d,size:.045,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));this.sparks.visible=false;this.world.add(this.sparks)
  this.halo=this.mesh(new T.TorusGeometry(.7,.008,8,80),new T.MeshBasicMaterial({color:0xffd58d,transparent:true,depthWrite:false,blending:T.AdditiveBlending}),v(-1.03,1.17,-.45));this.halo.rotation.x=-Math.PI/2;this.halo.visible=false;this.winLight=new T.PointLight(0xffd28a,0,5);this.winLight.position.set(-1.03,1.8,-.45);this.world.add(this.winLight);this.winCoins=new T.InstancedMesh(new T.CylinderGeometry(.04,.04,.012,12),new T.MeshStandardMaterial({color:0xe8bf65,metalness:.75,roughness:.24,transparent:true}),24);this.winCoins.visible=false;this.world.add(this.winCoins)
  for(const id of ['round-result','casino-error']){const panel=document.getElementById(id);if(panel)this.room.append(panel)}
  this.canvas.dataset.camera='seat';this.canvas.dataset.lookLocked='false'
  this.buildControls();this.bind();this.observer=new ResizeObserver(()=>this.fit());this.observer.observe(this.canvas);document.body.classList.add('roulette-immersive');this.room.classList.add('scene-ready');this.fit();this.tick(performance.now())
 }
 private mesh(geometry:T.BufferGeometry,material:T.Material,position:T.Vector3,parent:T.Object3D=this.world){const m=new T.Mesh(geometry,material);m.position.copy(position);parent.add(m);return m}
 private label(text:string,color='#ead9b5',background='transparent',size=256){const cache=text+color+background;if(this.textureCache.has(cache))return this.textureCache.get(cache)!
  const c=document.createElement('canvas');c.width=size;c.height=size/2;const x=c.getContext('2d')!;if(background!=='transparent'){x.fillStyle=background;x.fillRect(0,0,c.width,c.height)}x.fillStyle=color;x.font=`600 ${Math.floor(size*.34)}px Georgia`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,size/2,size/4,size*.94);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;this.textureCache.set(cache,t);return t}
 private text(text:string,position:T.Vector3,width:number,depth:number,color='#ead9b5',parent:T.Object3D=this.world){const m=this.mesh(new T.PlaneGeometry(width,depth),new T.MeshBasicMaterial({map:this.label(text,color),transparent:true,depthWrite:false}),position,parent);m.rotation.x=-Math.PI/2;return m}
 private buildRoom(){this.finishes=buildSalon(this.world)}
 private buildTable(){
  const wood=this.finishes.wood,gold=this.finishes.brass,felt=this.finishes.felt
  box(this.world,[4,.22,2.65],[0,.83,0],wood,.10);box(this.world,[3.87,.025,2.52],[0,.955,0],gold,.08);box(this.world,[3.72,.025,2.38],[0,.978,0],felt,.07);this.matEdge=box(this.world,[1.79,.010,1.79],[.70,.996,-.10],this.finishes.darkGold.clone(),.06);box(this.world,[1.72,.004,1.72],[.70,1.001,-.10],felt,.05)
  for(const x of[-1.5,1.5])for(const z of[-.85,.85]){this.mesh(new T.CylinderGeometry(.07,.1,.8,16),wood,v(x,.4,z));this.mesh(new T.CylinderGeometry(.105,.105,.1,16),gold,v(x,.08,z))}
  this.text('THE ROYAL TABLE',v(-.3,1.001,.73),.7,.06,'#a89771')
  this.mesh(new T.BoxGeometry(.65,.04,.25),wood,v(-1.45,1.02,-.95));for(let i=0;i<5;i++)for(let j=0;j<5;j++)this.mesh(new T.CylinderGeometry(.05,.05,.025,16),mat([0xc9bba3,0x243944,0xb65d6e,0x739789,0xcda555][i],.2,.4),v(-1.7+i*.12,1.06+j*.026,-.95))
 }
 private buildWheel(){
  this.wheel.position.set(-1.03,1.015,-.45);this.world.add(this.wheel);const gold=mat(0xcbb280,.75,.25)
  this.mesh(new T.CylinderGeometry(.82,.76,.12,80),mat(0x482f23,.2,.35),v(0,.035,0),this.wheel)
  for(const [radius,tube,y]of [[.77,.027,.12],[.66,.018,.13],[.29,.018,.13]]){const ring=this.mesh(new T.TorusGeometry(radius,tube,10,80),gold,v(0,y,0),this.wheel);ring.rotation.x=-Math.PI/2}
  this.wheel.add(this.rotor)
  this.mesh(new T.CylinderGeometry(.65,.65,.04,80),mat(0x19323b,.4,.3),v(0,.105,0),this.rotor)
  ROULETTE_ORDER.forEach((n,i)=>{const a=i*step,color=pocketColor(n),tile=this.mesh(new T.RingGeometry(.4,.645,8,1,a,step*.97),mat(color==='rift'?0x8a5d9f:color==='white'?0xe4d9be:0x17272f,.15,.45),v(0,.132,0),this.rotor);tile.rotation.x=-Math.PI/2
   const mid=a+step/2;this.text(String(n),v(Math.cos(mid)*.565,.135,-Math.sin(mid)*.565),.072,.05,color==='white'?'#182e38':'#fff1cc',this.rotor)
   const rail=this.mesh(new T.BoxGeometry(.21,.014,.005),gold,v(Math.cos(a)*.425,.143,-Math.sin(a)*.425),this.rotor);rail.rotation.y=a
  })
  this.mesh(new T.ConeGeometry(.31,.10,48),gold,v(0,.16,0),this.rotor);this.mesh(new T.SphereGeometry(.055,16,12),gold,v(0,.245,0),this.rotor)
  for(const a of[0,Math.PI/2]){const handle=this.mesh(new T.CylinderGeometry(.014,.014,.41,12),gold,v(0,.235,0),this.rotor);handle.rotation.z=Math.PI/2;handle.rotation.y=a}
 }
 private addKey(label:string,position:T.Vector3,width:number,depth:number,action:()=>void,choice?:RouletteChoice,background=0x294747){
  box(this.world,[width+.008,.018,depth+.008],[position.x,position.y-.016,position.z],this.finishes.darkGold,.009)
  const physical=box(this.world,[width,.022,depth],[position.x,position.y-.009,position.z],mat(background,.15,.65),.008)
  this.text(typeof choice==='number'?String(choice):label,position.clone().add(v(0,.004,0)),width*.9,depth*.88,background===0xe3d8bc?'#173139':'#f3e3b6')
  const button=document.createElement('button');button.type='button';button.className='roulette-world-key';button.setAttribute('aria-label',label==='SPIN'?'Place bet & spin':label);button.title=label;button.dataset.tableBet=choice===undefined?'':String(choice);button.innerHTML=`<span>${label}</span>`;button.onclick=()=>{if(!this.busy)action()};this.room.querySelector('.roulette-table-keys')!.append(button);this.keys.push({button,position,width,depth,choice,mesh:physical,mode:choice===undefined?'seat':'mat'})
 }
 private buildControls(){
  for(let n=1;n<=36;n++){const color=pocketColor(n);this.addKey('Bet on '+n,v(.04+(n-1)%6*.265,1.008,-.70+Math.floor((n-1)/6)*.17),.246,.153,()=>document.querySelector<HTMLButtonElement>(`[data-pocket="${n}"]`)!.click(),n,color==='white'?0xe3d8bc:0x1b3038)}
  this.addKey('Bet on rift zero',v(.70,1.008,-.92),1.58,.17,()=>document.querySelector<HTMLButtonElement>('[data-pocket="0"]')!.click(),0,0x765185)
  ;(['white','black','odd','even','low','high'] as const).forEach((c,i)=>this.addKey(c==='low'?'1–18':c==='high'?'19–36':c,v(.18+i%3*.50,1.008,.37+Math.floor(i/3)*.19),.47,.17,()=>document.querySelector<HTMLButtonElement>(`[data-outside="${c}"]`)!.click(),c,c==='white'?0xe3d8bc:0x294747))
  this.addZone('mat','Choose a bet on the mat',v(.70,1.02,-.12),1.8,1.72)
  this.addZone('chips','Choose your chips',v(-.88,1.14,.55),1.05,.58)
  const button=document.createElement('button');button.type='button';button.className='roulette-world-key roulette-spin-key';button.setAttribute('aria-label','Place bet & spin');button.innerHTML='<span>Spin</span>';button.onclick=()=>{if(!this.busy)document.getElementById('place-bet')!.click()};this.room.querySelector('.roulette-table-keys')!.append(button)
  this.keys.push({button,position:this.furniture.spinPosition.clone().add(v(0,.04,0)),width:.47,depth:.31,mode:'seat'})
 }
 private addZone(zone:'mat'|'chips',title:string,position:T.Vector3,width:number,depth:number){
  const button=document.createElement('button');button.type='button';button.className='roulette-world-key roulette-focus-zone';button.setAttribute('aria-label',title);button.dataset.focusZone=zone;button.innerHTML=`<span>${zone==='mat'?'Choose your bet':'Choose your chips'}</span>`;button.onclick=()=>{this.focus(zone);this.canvas.focus({preventScroll:true})};button.onpointerenter=()=>this.hotZone=zone;button.onpointerleave=()=>this.hotZone=undefined;button.onfocus=()=>this.hotZone=zone;button.onblur=()=>this.hotZone=undefined;this.room.querySelector('.roulette-table-keys')!.append(button);this.keys.push({button,position,width,depth,mode:'seat',zone})
 }
 private focus(mode:'seat'|'mat'|'chips'){
  if(this.cameraLocked||this.busy)return;this.focusMode=mode;this.drag=undefined;this.hotZone=undefined;this.room.dataset.focus=mode;this.canvas.dataset.lookLocked=String(mode!=='seat');this.keys.forEach(k=>k.button.hidden=k.mode!==mode)
  this.room.querySelector<HTMLElement>('.roulette-chip-picker')!.hidden=mode!=='chips';this.room.querySelector<HTMLElement>('.roulette-focus-summary')!.hidden=mode==='seat';this.room.querySelector<HTMLElement>('.roulette-focus-back')!.hidden=mode==='seat'
  this.room.querySelector('[data-focus-title]')!.textContent=mode==='mat'?'CHOOSE YOUR BET':'YOUR CHIP TRAY'
  this.room.querySelector('.roulette-room-hint')!.textContent=mode==='seat'?'Look around · Touch the mat or chips to play':'Esc or swipe down to return to your seat'
 }
 private changeChip(index:number,direction:number){
  if(this.busy)return;const counts=[...this.chipCounts];counts[index]=Math.max(0,counts[index]+direction)
  const total=counts.reduce((sum,n,i)=>sum+n*CHIP_VALUES[i],0);if(total<1||total>100000||total>Math.floor(this.coins))return
  const input=document.getElementById('stake') as HTMLInputElement;this.chipCounts=counts;input.value=String(total);input.dispatchEvent(new Event('input'))

 }
 private amount(){const dialog=this.room.querySelector<HTMLDialogElement>('.roulette-amount-modal')!,input=dialog.querySelector('input')!;input.value=String(this.stake);dialog.showModal();input.focus()}
 private bind(){
  this.room.querySelector<HTMLButtonElement>('[data-room-center]')!.onclick=()=>{if(this.cameraLocked)return;this.yaw=this.pitch=0;this.focus('seat')}
  this.room.querySelector<HTMLButtonElement>('[data-room-history]')!.onclick=()=>document.getElementById('open-roulette-history')!.click()
  this.room.querySelector<HTMLButtonElement>('[data-room-rules]')!.onclick=()=>{const d=this.room.querySelector<HTMLDialogElement>('.roulette-room-modal')!;d.querySelector('[data-room-modal-content]')!.innerHTML=rules('roulette');d.querySelectorAll('details').forEach(detail=>detail.open=true);d.showModal()}
  this.room.querySelector<HTMLButtonElement>('[data-close-room-modal]')!.onclick=()=>this.room.querySelector<HTMLDialogElement>('.roulette-room-modal')!.close()
  this.room.querySelector<HTMLButtonElement>('[data-chip-custom]')!.onclick=()=>this.amount()
  this.room.querySelector<HTMLButtonElement>('.roulette-focus-back')!.onclick=()=>this.focus('seat')
  this.room.querySelectorAll<HTMLButtonElement>('[data-chip-plus],[data-chip-minus]').forEach(b=>b.onclick=()=>this.changeChip(Number(b.dataset.chipPlus??b.dataset.chipMinus),b.dataset.chipPlus===undefined?-1:1))
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!this.room.querySelector('dialog[open]'))this.focus('seat')},{signal:this.inputEvents.signal})
  let swipe:{x:number;y:number}|undefined
  this.room.addEventListener('touchstart',e=>{if(e.touches.length===1)swipe={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true})
  this.room.addEventListener('touchend',e=>{const t=e.changedTouches[0];if(swipe&&t&&t.clientY-swipe.y>75&&Math.abs(t.clientX-swipe.x)<70)this.focus('seat');swipe=undefined},{passive:true})
  this.room.querySelector<HTMLButtonElement>('[data-room-bets]')!.onclick=()=>document.body.classList.toggle('roulette-mat-open')
  document.querySelectorAll<HTMLButtonElement>('[data-pocket],[data-outside]').forEach(b=>b.addEventListener('click',()=>{if(!this.busy)document.body.classList.remove('roulette-mat-open')}))
  const amount=this.room.querySelector<HTMLDialogElement>('.roulette-amount-modal')!;amount.querySelector<HTMLButtonElement>('[data-cancel-room-amount]')!.onclick=()=>amount.close();amount.querySelector('form')!.onsubmit=e=>{e.preventDefault();if(this.busy)return;const input=document.getElementById('stake') as HTMLInputElement;input.value=amount.querySelector('input')!.value;input.dispatchEvent(new Event('input'));amount.close()}
  this.canvas.addEventListener('pointerdown',e=>{if(this.cameraLocked||this.focusMode!=='seat')return;this.drag={x:e.clientX,y:e.clientY,yaw:this.yaw,pitch:this.pitch};this.canvas.setPointerCapture(e.pointerId)})
  this.canvas.addEventListener('pointermove',e=>{if(!this.drag||this.cameraLocked||this.focusMode!=='seat')return;this.yaw=T.MathUtils.clamp(this.drag.yaw+(e.clientX-this.drag.x)*.002,-.5,.5);this.pitch=T.MathUtils.clamp(this.drag.pitch+(e.clientY-this.drag.y)*.0015,-.28,.65)})
  this.canvas.addEventListener('lostpointercapture',()=>this.drag=undefined);this.canvas.addEventListener('keydown',e=>{if(e.key==='Home'&&!this.cameraLocked){this.yaw=this.pitch=0;e.preventDefault()}})
  window.addEventListener('pagehide',e=>{if(!e.persisted)this.dispose()},{once:true})
 }
 setState(coins:number,stake:number,choice:RouletteChoice,busy:boolean){this.coins=coins;this.stake=stake;this.choice=choice;this.busy=busy;if(!this.active){this.cameraLocked=busy;this.canvas.dataset.lookLocked=String(busy||this.focusMode!=='seat')}
  const name=typeof choice==='number'?choice===0?'The rift · 0':'Square '+choice:({white:'White court',black:'Black court',odd:'Odd',even:'Even',low:'1–18',high:'19–36'})[choice]
  this.room.querySelector('[data-room-choice]')!.textContent=`${casinoCoins(stake)} coins · ${name}`;this.room.querySelector('[data-room-odds]')!.textContent=`${(winProbability('roulette',choice)*100).toFixed(2).replace(/\.00$/,'')}% chance · ${grossMultiplier('roulette',choice)}× gross`
  const gross=stake*grossMultiplier('roulette',choice);this.room.querySelector('[data-room-return]')!.textContent=casinoCoins(gross-Math.max(0,gross-stake)*.01)+' coins'
  this.keys.forEach(k=>{k.button.disabled=busy;k.button.setAttribute('aria-pressed',String(k.choice===choice));if(k.mesh)(k.mesh.material as T.MeshStandardMaterial).emissive.setHex(k.choice===choice?0x315f50:0x000000)})
  const key=this.keys.find(k=>k.choice===choice);if(key)this.chip.position.copy(key.position).add(v(.05,.04,0));this.room.dataset.busy=String(busy);this.room.querySelector<HTMLButtonElement>('[data-room-center]')!.disabled=busy;this.room.querySelector<HTMLButtonElement>('[data-room-bets]')!.disabled=busy
  const returns=gross-Math.max(0,gross-stake)*.01
  if(this.chipCounts.reduce((sum,n,i)=>sum+n*CHIP_VALUES[i],0)!==stake){let remaining=Math.max(0,Math.floor(stake));this.chipCounts=CHIP_VALUES.map(()=>0);for(let i=CHIP_VALUES.length-1;i>=0;i--){this.chipCounts[i]=Math.floor(remaining/CHIP_VALUES[i]);remaining%=CHIP_VALUES[i]}}
  this.furniture.update(coins,stake,returns,busy,this.chipCounts)
  this.room.querySelector('[data-focus-stake]')!.textContent=casinoCoins(stake);this.room.querySelector('[data-focus-multiplier]')!.textContent=`${grossMultiplier('roulette',choice)}× · ${casinoCoins(returns)} win return`
  this.room.querySelectorAll<HTMLButtonElement>('[data-chip-plus],[data-chip-minus],[data-chip-custom]').forEach(b=>{const i=Number(b.dataset.chipPlus??b.dataset.chipMinus);b.disabled=busy||(b.dataset.chipPlus!==undefined&&(stake+CHIP_VALUES[i]>Math.min(100000,Math.floor(coins))))||(b.dataset.chipMinus!==undefined&&(this.chipCounts[i]===0||stake-CHIP_VALUES[i]<1))})
  this.chipCounts.forEach((count,i)=>this.room.querySelector(`[data-chip-count="${i}"]`)!.textContent=String(count))
  this.canvas.dataset.choice=String(choice);this.canvas.dataset.stake=String(stake)
 }
 land(result:number){this.result=result;this.rotation=this.rotor.rotation.y;const angle=ROULETTE_ORDER.indexOf(result)*step+step/2-this.rotation;this.ball.position.set(-1.03+Math.cos(angle)*.435,1.173,-.45-Math.sin(angle)*.435);this.canvas.dataset.result=String(result)}
 async spin(round:CasinoRound){
  this.focusMode='seat';this.room.dataset.focus='seat';this.room.querySelectorAll<HTMLElement>('.roulette-chip-picker,.roulette-focus-summary,.roulette-focus-back').forEach(e=>e.hidden=true);this.active=true;this.cameraLocked=true;this.animationCheckpoint=0;this.drag=undefined;this.coinOwner='tray';this.wagerCoins.visible=false;this.canvas.dataset.lookLocked='true';document.body.classList.remove('roulette-mat-open');this.room.dataset.phase='exchange';this.canvas.dataset.camera='seat';this.spinAt=performance.now();this.result=round.result;this.won=round.won;this.rarity=winProbability('roulette',round.choice)<.025?3:winProbability('roulette',round.choice)<.1?2:1;this.rotation=this.rotor.rotation.y;this.endRotation=this.rotation+tau*5+.37;this.ballStart=0;this.ballEnd=ROULETTE_ORDER.indexOf(round.result)*step+step/2-this.endRotation;this.room.querySelector('.roulette-room-announcement')!.textContent='Your wager crosses the felt.';await new Promise<void>(r=>this.complete=r)
 }
 private posePeople(now:number,p:number,payoutMs:number){
  const h=Math.min(1,p/.24),lerp=(a:T.Vector3,b:T.Vector3,t:number)=>a.clone().lerp(b,ease(Math.max(0,Math.min(1,t))))
  const path=(t:number,points:[number,T.Vector3][])=>{for(let i=1;i<points.length;i++)if(t<=points[i][0])return lerp(points[i-1][1],points[i][1],(t-points[i-1][0])/(points[i][0]-points[i-1][0]));return points[points.length-1][1].clone()}
  const restL=v(-.46,1.02,1.02),restR=v(.46,1.02,1.02),tray=v(-.45,1.07,.98),exchange=v(.14,1.08,.15),dealerL=v(-.15,1.04,-.83),dealerR=v(.40,1.04,-.83),rack=v(-.45,1.12,-.92)
  let left=restL,right=restR,dl=dealerL,dr=dealerR,lean=0,dealerLean=0,curl=.16,owner='tray'
  if(this.active&&p<.24){lean=Math.sin(h*Math.PI)*.93;dealerLean=Math.sin(h*Math.PI)*1.12;curl=h>.18&&h<.65?.85:.17
   right=path(h,[[0,restR],[.18,tray],[.28,tray],[.55,exchange],[.65,exchange],[1,restR]])
   dl=path(h,[[0,dealerL],[.30,dealerL],[.55,exchange],[.65,exchange],[.90,rack],[1,dealerL]])
   owner=h<.18?'tray':h<.60?'player':h<.93?'dealer':'tray'
   this.canvas.dataset.coinOwner=owner;this.room.dataset.phase='exchange'
  }else if(this.active&&p<.80){if(this.room.dataset.phase!=='spin')this.room.querySelector('.roulette-room-announcement')!.textContent='No more bets. Watch the wheel.';this.room.dataset.phase='spin';this.canvas.dataset.camera=this.camBlend>.95?'wheel':'travel'}
  const payout=this.active&&this.won&&p>=1?Math.min(1,payoutMs/(this.reduced?200:2200)):0
  if(payout>0){this.room.dataset.phase='payout';this.canvas.dataset.camera='seat';dealerLean=Math.sin(payout*Math.PI)*1.12;lean=Math.sin(payout*Math.PI)*.9
   const receive=v(-.10,1.08,.20);dl=path(payout,[[0,rack],[.18,rack],[.53,receive],[.65,receive],[1,dealerL]]);left=path(payout,[[0,restL],[.25,restL],[.53,receive],[.65,receive],[1,restL]]);owner=payout<.12?'tray':payout<.60?'dealer':payout<.96?'playerLeft':'tray';this.canvas.dataset.coinOwner=owner
  }
  this.player.pose(lean,left,right,.16,curl);this.dealer.pose(now,dealerLean,dl,dr,.6,true)
  const parent=owner==='player'?this.player.right.hand.grip:owner==='dealer'?this.dealer.left.hand.grip:owner==='dealerRight'?this.dealer.right.hand.grip:owner==='playerLeft'?this.player.left.hand.grip:undefined
  this.world.updateMatrixWorld(true)
  if(parent){if(this.coinOwner!==owner){parent.attach(this.wagerCoins);this.wagerCoins.position.set(0,.01,0);this.wagerCoins.rotation.set(0,0,0)}this.wagerCoins.visible=true}else this.wagerCoins.visible=false
  this.coinOwner=owner
 }
 private fit(){const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.furniture.layout(w<h);for(const k of this.keys){if(k.zone==='chips'){k.position.set(w<h?-.48:-.88,1.1,w<h?.43:.55);k.width=w<h?.6:1.05;k.depth=w<h?.4:.58}else if(k.zone==='mat'){k.position.set(w<h?.35:.70,1.02,-.12);k.width=w<h?1.1:1.8}else if(k.button.classList.contains('roulette-spin-key')){k.position.copy(this.furniture.spinPosition).add(v(0,.04,0));k.width=w<h?.40:.47;k.depth=w<h?.26:.31}}this.camera.fov=this.camera.aspect<1?74:62;this.camera.updateProjectionMatrix()}
 private projectKeys(){const rect=this.canvas.getBoundingClientRect();for(const k of this.keys){const p=k.position.clone().project(this.camera),left=k.position.clone().add(v(-k.width/2,0,0)).project(this.camera),right=k.position.clone().add(v(k.width/2,0,0)).project(this.camera),front=k.position.clone().add(v(0,0,k.depth/2)).project(this.camera),back=k.position.clone().add(v(0,0,-k.depth/2)).project(this.camera)
   const width=Math.max(12,Math.abs(right.x-left.x)*rect.width/2),height=Math.max(12,Math.abs(front.y-back.y)*rect.height/2);k.button.style.left=(p.x+1)*rect.width/2+'px';k.button.style.top=(1-p.y)*rect.height/2+'px';k.button.style.width=width*.94+'px';k.button.style.height=height*.94+'px';k.button.hidden=this.active||k.mode!==this.focusMode||p.z>1||(p.x+1)*rect.width/2+width/2<0||(p.x+1)*rect.width/2-width/2>rect.width||(1-p.y)*rect.height/2+height/2<0||(1-p.y)*rect.height/2-height/2>rect.height
  }}
 private tick=(now:number)=>{
  if(this.disposed)return;this.raf=requestAnimationFrame(this.tick);if(document.visibilityState!=='visible'||now-this.last<(this.active?24:50))return
  const gl=this.renderer.getContext() as WebGL2RenderingContext;if(this.fence){if(gl.clientWaitSync(this.fence,0,0)===gl.TIMEOUT_EXPIRED)return;gl.deleteSync(this.fence);this.fence=null}const delta=Math.min(.1,(now-this.last)/1000||.016);this.last=now
  const duration=this.reduced?1300:11000;let elapsed=this.active?now-this.spinAt:0,p=Math.min(1,elapsed/duration)
  // Important physical actions must get a rendered frame even on a slow GPU.
  const checkpoints=[.05,.16,.38,.80,.93,1]
  if(this.active&&this.animationCheckpoint<checkpoints.length&&p>=checkpoints[this.animationCheckpoint]){p=checkpoints[this.animationCheckpoint++];elapsed=p*duration;this.spinAt=now-elapsed}
  if(this.active){
   const move=ease(Math.max(0,Math.min(1,(p-.24)/.13))),returning=p>.90?ease((p-.90)/.10):0;this.camBlend=move*(1-returning)
   const roll=Math.max(0,Math.min(1,(p-.34)/.46)),slow=1-Math.pow(1-roll,3);this.rotor.rotation.y=T.MathUtils.lerp(this.rotation,this.endRotation,slow)
   const ballProgress=Math.max(0,Math.min(1,(p-.34)/.46)),ballEase=1-Math.pow(1-ballProgress,2.4),angle=T.MathUtils.lerp(tau*9,this.ballEnd,ballEase),drop=ease(Math.max(0,Math.min(1,(p-.56)/.24))),radius=T.MathUtils.lerp(.715,.435,drop)
   this.ball.position.set(-1.03+Math.cos(angle)*radius,1.173+(1-drop)*.055+(!this.reduced&&p>.56&&p<.80?Math.abs(Math.sin(p*160))*(1-drop)*.04:0),-.45-Math.sin(angle)*radius)
   if(p>=.80&&this.room.dataset.phase==='spin'){this.room.dataset.phase='landed';this.canvas.dataset.result=String(this.result);this.room.querySelector('.roulette-room-announcement')!.textContent=(this.result===0?'The rift · 0':String(this.result))+(this.won?' · The table pays.':' · The next turn is yours.');if(this.won){this.burstAt=now;this.canvas.dataset.winTier=String(this.rarity)}}
   if(p===1){this.cameraLocked=false;this.canvas.dataset.lookLocked='false';this.room.querySelector<HTMLButtonElement>('[data-room-center]')!.disabled=false}
   if(p===1&&(!this.won||elapsed>=duration+(this.reduced?200:2200))){this.active=false;this.camBlend=0;this.room.dataset.phase='idle';this.canvas.dataset.camera='seat';this.rotation=this.endRotation;this.canvas.dataset.lookLocked='false';this.wagerCoins.visible=false;const done=this.complete;this.complete=undefined;done?.()}
  }
  const portrait=this.camera.aspect<1,seat=v(0,portrait?1.50:1.75,portrait?1.72:2.15),over=v(-1.03,portrait?4.2:3.05,-.449)
  const breath=this.reduced?0:Math.sin(now*.0012)*.0015;seat.y+=breath
  const direction=this.look.clone().sub(seat).applyEuler(new T.Euler(-this.pitch,-this.yaw,0,'YXZ')),seatLook=seat.clone().add(direction)
  this.matBlend=T.MathUtils.damp(this.matBlend,this.focusMode==='mat'&&!this.active?1:0,10,delta);if(this.matBlend<.002)this.matBlend=0
  seat.lerp(v(.70,portrait?3.6:2.45,.72),this.matBlend);seatLook.lerp(v(.70,1.01,-.12),this.matBlend)
  this.chipBlend=T.MathUtils.damp(this.chipBlend,this.focusMode==='chips'&&!this.active?1:0,10,delta);if(this.chipBlend<.002)this.chipBlend=0
  seat.lerp(v(portrait?-.48:-.90,portrait?2.25:2.05,portrait?.32:.621),this.chipBlend);seatLook.lerp(v(portrait?-.48:-.90,1.04,portrait?.57:.62),this.chipBlend)
  this.camera.position.copy(seat.lerp(over,this.camBlend));this.camera.up.set(0,1,0).lerp(v(0,0,-1),Math.max(this.camBlend,this.chipBlend)).normalize();this.camera.lookAt(seatLook.lerp(this.spinLook,this.camBlend));this.camera.updateMatrixWorld()
  this.canvas.dataset.lookYaw=this.yaw.toFixed(3);this.canvas.dataset.lookPitch=this.pitch.toFixed(3);this.canvas.dataset.eyeHeight=this.camera.position.y.toFixed(3);this.canvas.dataset.view=!this.active&&this.focusMode!=='seat'?this.focusMode:'first-person'
  this.posePeople(now,this.active?p:0,elapsed-duration)

  const q=(now-this.burstAt)/(this.reduced?650:2200);this.sparks.visible=q>=0&&q<1;if(this.sparks.visible){const count=this.rarity===3?128:this.rarity===2?90:30,positions=this.sparkGeometry.getAttribute('position') as T.BufferAttribute;for(let i=0;i<128;i++){const a=i*2.399,r=q*(.3+(i%9)*.08);positions.setXYZ(i,-1.03+Math.cos(a)*r,1.2+Math.sin(q*Math.PI)*(this.rarity*.24+.2)+(i%5)*.02,-.45+Math.sin(a)*r)}positions.needsUpdate=true;this.sparkGeometry.setDrawRange(0,count);const material=this.sparks.material as T.PointsMaterial;material.opacity=Math.sin(q*Math.PI);material.color.setHex(this.rarity===3?0xd4a6ff:0xffd58d);this.canvas.dataset.winGlow='true'}else this.canvas.dataset.winGlow='false'
  this.halo.visible=this.winCoins.visible=this.sparks.visible
  if(this.sparks.visible){const fade=Math.sin(q*Math.PI),m=new T.Matrix4(),rotation=new T.Quaternion();this.halo.scale.setScalar(1+q*.65);(this.halo.material as T.MeshBasicMaterial).opacity=fade*.55;this.winLight.intensity=fade*this.rarity*7;this.winCoins.count=this.rarity*8;for(let i=0;i<this.winCoins.count;i++){const a=i*2.399,r=q*(.25+i%4*.12);rotation.setFromEuler(new T.Euler(q*8+i,a,q*5));m.compose(v(-1.03+Math.cos(a)*r,1.2+Math.sin(q*Math.PI)*(.35+i%3*.08),-.45+Math.sin(a)*r),rotation,v(1,1,1));this.winCoins.setMatrixAt(i,m)}this.winCoins.instanceMatrix.needsUpdate=true;(this.winCoins.material as T.MeshStandardMaterial).opacity=fade}else this.winLight.intensity=0
  this.patrons.forEach((person,i)=>person.pose(now+i*1700))
  this.projectKeys()
  const gaze=this.keys.find(k=>k.zone&&!k.button.hidden&&Math.abs(parseFloat(k.button.style.left)-this.canvas.clientWidth/2)<parseFloat(k.button.style.width)/2&&Math.abs(parseFloat(k.button.style.top)-this.canvas.clientHeight/2)<parseFloat(k.button.style.height)/2)?.zone
  const hot=this.focusMode==='seat'&&!this.busy?(this.hotZone??gaze):undefined;(this.matEdge.material as T.MeshStandardMaterial).emissive.setHex(hot==='mat'?0x7a5b2c:0);this.furniture.highlight(hot==='chips');this.keys.forEach(k=>{if(k.zone)k.button.dataset.highlight=String(k.zone===hot)})
  this.renderer.render(this.world,this.camera);this.canvas.dataset.frame=String(++this.frame);this.fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush()
 }
 dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.raf);this.observer.disconnect();this.inputEvents.abort();this.furniture.dispose();this.complete?.();this.world.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});this.textureCache.forEach(t=>t.dispose());this.renderer.dispose()}
}
