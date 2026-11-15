import * as T from 'three'
import {ROULETTE_ORDER,pocketColor,rouletteWins,winProbability,grossMultiplier,casinoCoins,type RouletteChoice,type CasinoRound} from '../casino-model.ts'
import {rules} from './casino-panels.ts'
const tau=Math.PI*2,step=tau/37,v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),ease=(p:number)=>p*p*(3-2*p)
const mat=(color:number,metalness=0,roughness=.55)=>new T.MeshStandardMaterial({color,metalness,roughness})
interface Key {button:HTMLButtonElement;position:T.Vector3;width:number;depth:number;choice?:RouletteChoice;mesh?:T.Mesh}
/** A presentation of a previously settled round. No random outcome or payout logic lives here. */
export class RouletteRoom{
 private world=new T.Scene();private camera=new T.PerspectiveCamera(49,1,.1,70);private renderer:T.WebGLRenderer
 private room:HTMLElement;private canvas:HTMLCanvasElement;private keys:Key[]=[];private rotor=new T.Group();private wheel=new T.Group();private ball:T.Mesh;private chip:T.Mesh;private patrons:T.Group[]=[];private dealer:T.Group
 private busy=false;private active=false;private yaw=0;private pitch=0;private frame=0;private last=0;private observer:ResizeObserver;private disposed=false;private raf=0
 private choice:RouletteChoice='white';private stake=100;private coins=0;private rotation=0;private spinAt=0;private endRotation=0;private ballStart=0;private ballEnd=0;private result=0;private won=false;private rarity=0;private complete?:()=>void
 private sparkGeometry=new T.BufferGeometry();private halo:T.Mesh;private winLight:T.PointLight;private winCoins:T.InstancedMesh;private sparks:T.Points;private burstAt=-Infinity;private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;private drag?:{x:number;y:number;yaw:number;pitch:number}
 private look=v(0,.98,0);private spinLook=v(-1.03,1.05,-.02);private camBlend=0;private textureCache=new Map<string,T.CanvasTexture>();private fence:WebGLSync|null=null
 constructor(root:HTMLElement){
  this.room=document.createElement('section');this.room.className='roulette-room';this.room.innerHTML=`<canvas id="roulette-canvas" tabindex="0" aria-label="Royal Table roulette room. Drag empty space to look around; Home centers your view."></canvas><div class="roulette-room-vignette"></div><header class="roulette-room-tools"><div><span>THE CHESS CLUB · TABLE 01</span><h1>The Royal Table</h1></div><nav><button type="button" data-room-center>Center</button><button type="button" data-room-mat>Betting mat</button><button type="button" data-room-rules>Rules</button><button type="button" data-room-history>History</button></nav></header><div class="roulette-table-keys" aria-label="Physical table controls"></div><div class="roulette-room-hud"><div><small>YOUR WAGER</small><strong data-room-choice>White court</strong><span data-room-odds></span></div><div><small>WIN RETURN</small><strong data-room-return></strong><span>1% of profit goes to CasinoOwner</span></div></div><p class="roulette-room-announcement" role="status" aria-live="polite"></p><p class="roulette-room-hint">Drag to look · Choose a square · Pick a chip · Spin</p><dialog class="table-modal roulette-room-modal"><button type="button" data-close-room-modal aria-label="Close roulette information">×</button><div data-room-modal-content></div></dialog><dialog class="table-modal roulette-amount-modal"><form><h2>Place your chips</h2><label>Stake in coins<input type="number" min="1" max="100000" step="1" required></label><div class="modal-actions"><button type="button" data-cancel-room-amount>Cancel</button><button type="submit">Set stake</button></div></form></dialog>`
  root.prepend(this.room);this.canvas=this.room.querySelector('canvas')!
  try{this.renderer=new T.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:false,powerPreference:'high-performance'})}catch(e){this.room.remove();throw e}
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15
  this.world.background=new T.Color(0x162a32);this.world.fog=new T.Fog(0x162a32,9,24)
  this.world.add(new T.HemisphereLight(0xcfe9f3,0x5a3a26,2.1));const keyLight=new T.DirectionalLight(0xffe1b0,3.1);keyLight.position.set(1,7,4);this.world.add(keyLight)
  const rim=new T.PointLight(0x83c1e5,26,12);rim.position.set(-4,3,-2);this.world.add(rim)
  this.buildRoom();this.buildTable();this.buildWheel();this.dealer=this.human(-.3,-1.72,0x1b3642,0xb78260,true);this.patrons.push(this.human(-2.7,-1.25,0x682f3b,0xe0b391),this.human(2.7,-1.45,0x355346,0x946747))
  this.ball=this.mesh(new T.SphereGeometry(.025,16,12),mat(0xfff4db,.35,.17),v(-.5,1.15,0));this.chip=this.mesh(new T.CylinderGeometry(.066,.066,.025,24),mat(0xf2d29b,.4,.3),v(.3,1.08,0))
  const positions=new Float32Array(128*3);this.sparkGeometry.setAttribute('position',new T.BufferAttribute(positions,3));this.sparks=new T.Points(this.sparkGeometry,new T.PointsMaterial({color:0xffd58d,size:.045,transparent:true,depthWrite:false,blending:T.AdditiveBlending}));this.sparks.visible=false;this.world.add(this.sparks)
  this.halo=this.mesh(new T.TorusGeometry(.7,.008,8,80),new T.MeshBasicMaterial({color:0xffd58d,transparent:true,depthWrite:false,blending:T.AdditiveBlending}),v(-1.03,1.17,-.04));this.halo.rotation.x=-Math.PI/2;this.halo.visible=false;this.winLight=new T.PointLight(0xffd28a,0,5);this.winLight.position.set(-1.03,1.8,-.04);this.world.add(this.winLight);this.winCoins=new T.InstancedMesh(new T.CylinderGeometry(.04,.04,.012,12),new T.MeshStandardMaterial({color:0xe8bf65,metalness:.75,roughness:.24,transparent:true}),24);this.winCoins.visible=false;this.world.add(this.winCoins)
  for(const id of ['round-result','casino-error']){const panel=document.getElementById(id);if(panel)this.room.append(panel)}
  this.canvas.dataset.camera='seat'
  this.buildControls();this.bind();this.observer=new ResizeObserver(()=>this.fit());this.observer.observe(this.canvas);document.body.classList.add('roulette-immersive');this.room.classList.add('scene-ready');this.fit();this.tick(performance.now())
 }
 private mesh(geometry:T.BufferGeometry,material:T.Material,position:T.Vector3,parent:T.Object3D=this.world){const m=new T.Mesh(geometry,material);m.position.copy(position);parent.add(m);return m}
 private label(text:string,color='#ead9b5',background='transparent',size=256){const cache=text+color+background;if(this.textureCache.has(cache))return this.textureCache.get(cache)!
  const c=document.createElement('canvas');c.width=size;c.height=size/2;const x=c.getContext('2d')!;if(background!=='transparent'){x.fillStyle=background;x.fillRect(0,0,c.width,c.height)}x.fillStyle=color;x.font=`600 ${Math.floor(size*.34)}px Georgia`;x.textAlign='center';x.textBaseline='middle';x.fillText(text,size/2,size/4,size*.94);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;this.textureCache.set(cache,t);return t}
 private text(text:string,position:T.Vector3,width:number,depth:number,color='#ead9b5',parent:T.Object3D=this.world){const m=this.mesh(new T.PlaneGeometry(width,depth),new T.MeshBasicMaterial({map:this.label(text,color),transparent:true,depthWrite:false}),position,parent);m.rotation.x=-Math.PI/2;return m}
 private buildRoom(){
  this.mesh(new T.PlaneGeometry(40,40),mat(0x26343a,.1,.8),v()).rotation.x=-Math.PI/2
  this.mesh(new T.BoxGeometry(18,8,.3),mat(0x1d3d48),v(0,3,-5));this.mesh(new T.BoxGeometry(.3,8,15),mat(0x17353d),v(-7,3,0));this.mesh(new T.BoxGeometry(.3,8,15),mat(0x17353d),v(7,3,0))
  const brass=mat(0xae8b51,.65,.3),wood=mat(0x3c2b25,.05,.65)
  for(let i=-3;i<=3;i++){this.mesh(new T.BoxGeometry(.04,4,.05),brass,v(i*1.7,2,-4.8));this.mesh(new T.BoxGeometry(1.5,1.4,.09),wood,v(i*1.7,.75,-4.79));const glass=this.mesh(new T.BoxGeometry(1.25,2.3,.08),new T.MeshStandardMaterial({color:0x78a1b0,emissive:0x2a4b61,emissiveIntensity:.65,metalness:.5,roughness:.2}),v(i*1.7,3.35,-4.8));for(let j=0;j<3;j++)this.mesh(new T.BoxGeometry(.03,2.3,.12),brass,v(i*1.7+(j-1)*.4,3.35,-4.7))}
  for(const z of[-3,1])for(const x of[-4,4]){this.mesh(new T.CylinderGeometry(.025,.05,2,12),brass,v(x,1,z));this.mesh(new T.ConeGeometry(.5,.5,24,1,true),mat(0xe2c79b),v(x,2.2,z));const l=new T.PointLight(0xffc988,9,7);l.position.set(x,2,z);this.world.add(l)}
  this.mesh(new T.BoxGeometry(4,.06,2.3),mat(0x111f26),v(0,.03,0))
 }
 private buildTable(){
  const wood=mat(0x3c2821,.12,.4),gold=mat(0xc6a365,.7,.27),felt=mat(0x155a56,.05,.95)
  const hull=this.mesh(new T.BoxGeometry(4,.22,2.65),wood,v(0,.83,0));this.mesh(new T.BoxGeometry(3.87,.025,2.52),gold,v(0,.955,0));this.mesh(new T.BoxGeometry(3.72,.025,2.38),felt,v(0,.978,0))
  for(const x of[-1.5,1.5])for(const z of[-.85,.85]){this.mesh(new T.CylinderGeometry(.07,.1,.8,16),wood,v(x,.4,z));this.mesh(new T.CylinderGeometry(.105,.105,.1,16),gold,v(x,.08,z))}
  this.text('THE ROYAL TABLE',v(-.7,1.001,1.02),1.3,.13,'#c7b887')
  this.mesh(new T.BoxGeometry(.65,.04,.25),wood,v(-1.45,1.02,-.95));for(let i=0;i<5;i++)for(let j=0;j<5;j++)this.mesh(new T.CylinderGeometry(.05,.05,.025,16),mat([0xc9bba3,0x243944,0xb65d6e,0x739789,0xcda555][i],.2,.4),v(-1.7+i*.12,1.06+j*.026,-.95))
 }
 private buildWheel(){
  this.wheel.position.set(-1.03,1.015,-.04);this.world.add(this.wheel);const gold=mat(0xcbb280,.75,.25)
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
 private human(x:number,z:number,suit:number,skin:number,dealer=false){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=-Math.atan2(x,3);this.world.add(g);const cloth=mat(suit),face=mat(skin),white=mat(0xf1e8d8),hair=mat(0x302723)
  this.mesh(new T.CylinderGeometry(.18,.23,.62,12),cloth,v(0,1.12,0),g);this.mesh(new T.SphereGeometry(.16,20,16),face,v(0,1.62,0),g);const cap=this.mesh(new T.SphereGeometry(.163,16,12,0,tau,0,Math.PI*.43),hair,v(0,1.66,0),g)
  this.mesh(new T.BoxGeometry(.13,.35,.03),white,v(0,1.25,.18),g);this.mesh(new T.BoxGeometry(.035,.21,.04),mat(dealer?0xb99659:0x1b2834),v(0,1.25,.205),g)
  for(const side of[-1,1]){const arm=this.mesh(new T.CapsuleGeometry(.065,.38,4,8),cloth,v(side*.26,1.15,.10),g);arm.rotation.z=side*.28;arm.rotation.x=-.6;this.mesh(new T.SphereGeometry(.066,12,8),face,v(side*.29,.95,.23),g);this.mesh(new T.CylinderGeometry(.075,.06,.78,10),cloth,v(side*.1,.47,0),g);this.mesh(new T.BoxGeometry(.13,.09,.26),hair,v(side*.1,.08,.06),g)}
  for(const side of[-1,1])this.mesh(new T.SphereGeometry(.012,8,6),mat(0x202829),v(side*.06,1.65,.145),g)
  if(!dealer){this.mesh(new T.BoxGeometry(.56,.1,.5),mat(0x623c36),v(0,.65,-.08),g);this.mesh(new T.BoxGeometry(.54,.67,.1),mat(0x623c36),v(0,.94,-.31),g)}
  return g
 }
 private addKey(label:string,position:T.Vector3,width:number,depth:number,action:()=>void,choice?:RouletteChoice,background=0x294747){
  const physical=this.mesh(new T.BoxGeometry(width,.024,depth),mat(background,.15,.65),position.clone().add(v(0,-.012,0)))
  this.text(typeof choice==='number'?String(choice):label,position.clone().add(v(0,.004,0)),width*.9,depth*.88,background===0xe3d8bc?'#173139':'#f3e3b6')
  const button=document.createElement('button');button.type='button';button.className='roulette-world-key';button.setAttribute('aria-label',label==='SPIN'?'Place bet & spin':label);button.title=label;button.dataset.tableBet=choice===undefined?'':String(choice);button.innerHTML=`<span>${label}</span>`;button.onclick=()=>{if(!this.busy)action()};this.room.querySelector('.roulette-table-keys')!.append(button);this.keys.push({button,position,width,depth,choice,mesh:physical})
 }
 private buildControls(){
  for(let n=1;n<=36;n++){const color=pocketColor(n);this.addKey('Bet on '+n,v(.04+(n-1)%6*.265,1.008,-.70+Math.floor((n-1)/6)*.20),.246,.183,()=>document.querySelector<HTMLButtonElement>(`[data-pocket="${n}"]`)!.click(),n,color==='white'?0xe3d8bc:0x1b3038)}
  this.addKey('Bet on rift zero',v(.70,1.008,-.92),1.58,.17,()=>document.querySelector<HTMLButtonElement>('[data-pocket="0"]')!.click(),0,0x765185)
  ;(['white','black','odd','even','low','high'] as const).forEach((c,i)=>this.addKey(c==='low'?'1–18':c==='high'?'19–36':c,v(.04+i*.265,1.008,.59),.246,.19,()=>document.querySelector<HTMLButtonElement>(`[data-outside="${c}"]`)!.click(),c,c==='white'?0xe3d8bc:0x294747))
  ;[25,100,500,1000].forEach((amount,i)=>{const p=v(-1.55+i*.33,1.035,.77);this.mesh(new T.CylinderGeometry(.12,.12,.035,24),mat([0xd4c7ab,0x4c8092,0xb46879,0xc7a256][i],.25,.5),p);this.addKey(String(amount),p.clone().add(v(0,.023,0)),.24,.18,()=>{const input=document.getElementById('stake') as HTMLInputElement;input.value=String(amount);input.dispatchEvent(new Event('input'))},undefined,[0xa99a7e,0x385f74,0x89485c,0x997335][i])})
  this.addKey('Edit stake',v(-.73,1.014,1.04),.62,.17,()=>this.amount())
  this.addKey('SPIN',v(1.15,1.02,.99),.66,.30,()=>document.getElementById('place-bet')!.click(),undefined,0xa6874b)
 }
 private amount(){const dialog=this.room.querySelector<HTMLDialogElement>('.roulette-amount-modal')!,input=dialog.querySelector('input')!;input.value=String(this.stake);dialog.showModal();input.focus()}
 private bind(){
  this.room.querySelector<HTMLButtonElement>('[data-room-center]')!.onclick=()=>{this.yaw=this.pitch=0}
  this.room.querySelector<HTMLButtonElement>('[data-room-history]')!.onclick=()=>document.getElementById('open-roulette-history')!.click()
  this.room.querySelector<HTMLButtonElement>('[data-room-rules]')!.onclick=()=>{const d=this.room.querySelector<HTMLDialogElement>('.roulette-room-modal')!;d.querySelector('[data-room-modal-content]')!.innerHTML=rules('roulette');d.querySelectorAll('details').forEach(detail=>detail.open=true);d.showModal()}
  this.room.querySelector<HTMLButtonElement>('[data-close-room-modal]')!.onclick=()=>this.room.querySelector<HTMLDialogElement>('.roulette-room-modal')!.close()
  this.room.querySelector<HTMLButtonElement>('[data-room-mat]')!.onclick=()=>document.body.classList.toggle('roulette-mat-open')
  document.querySelectorAll<HTMLButtonElement>('[data-pocket],[data-outside]').forEach(b=>b.addEventListener('click',()=>{if(!this.busy)document.body.classList.remove('roulette-mat-open')}))
  const amount=this.room.querySelector<HTMLDialogElement>('.roulette-amount-modal')!;amount.querySelector<HTMLButtonElement>('[data-cancel-room-amount]')!.onclick=()=>amount.close();amount.querySelector('form')!.onsubmit=e=>{e.preventDefault();if(this.busy)return;const input=document.getElementById('stake') as HTMLInputElement;input.value=amount.querySelector('input')!.value;input.dispatchEvent(new Event('input'));amount.close()}
  this.canvas.addEventListener('pointerdown',e=>{if(this.active)return;this.drag={x:e.clientX,y:e.clientY,yaw:this.yaw,pitch:this.pitch};this.canvas.setPointerCapture(e.pointerId)})
  this.canvas.addEventListener('pointermove',e=>{if(!this.drag||this.active)return;this.yaw=T.MathUtils.clamp(this.drag.yaw+(e.clientX-this.drag.x)*.002,-.5,.5);this.pitch=T.MathUtils.clamp(this.drag.pitch+(e.clientY-this.drag.y)*.0015,-.18,.2)})
  this.canvas.addEventListener('lostpointercapture',()=>this.drag=undefined);this.canvas.addEventListener('keydown',e=>{if(e.key==='Home'){this.yaw=this.pitch=0;e.preventDefault()}})
  window.addEventListener('pagehide',e=>{if(!e.persisted)this.dispose()},{once:true})
 }
 setState(coins:number,stake:number,choice:RouletteChoice,busy:boolean){this.coins=coins;this.stake=stake;this.choice=choice;this.busy=busy
  const name=typeof choice==='number'?choice===0?'The rift · 0':'Square '+choice:({white:'White court',black:'Black court',odd:'Odd',even:'Even',low:'1–18',high:'19–36'})[choice]
  this.room.querySelector('[data-room-choice]')!.textContent=`${casinoCoins(stake)} coins · ${name}`;this.room.querySelector('[data-room-odds]')!.textContent=`${(winProbability('roulette',choice)*100).toFixed(2).replace(/\.00$/,'')}% chance · ${grossMultiplier('roulette',choice)}× gross`
  const gross=stake*grossMultiplier('roulette',choice);this.room.querySelector('[data-room-return]')!.textContent=casinoCoins(gross-Math.max(0,gross-stake)*.01)+' coins'
  this.keys.forEach(k=>{k.button.disabled=busy;k.button.setAttribute('aria-pressed',String(k.choice===choice));if(k.mesh)(k.mesh.material as T.MeshStandardMaterial).emissive.setHex(k.choice===choice?0x315f50:0x000000)})
  const key=this.keys.find(k=>k.choice===choice);if(key)this.chip.position.copy(key.position).add(v(.05,.04,0));this.room.dataset.busy=String(busy);this.room.querySelector<HTMLButtonElement>('[data-room-mat]')!.disabled=busy
  this.canvas.dataset.choice=String(choice);this.canvas.dataset.stake=String(stake)
 }
 land(result:number){this.result=result;this.rotation=this.rotor.rotation.y;const angle=ROULETTE_ORDER.indexOf(result)*step+step/2-this.rotation;this.ball.position.set(-1.03+Math.cos(angle)*.435,1.173,-.04-Math.sin(angle)*.435);this.canvas.dataset.result=String(result)}
 async spin(round:CasinoRound){
  this.active=true;this.drag=undefined;document.body.classList.remove('roulette-mat-open');this.room.dataset.phase='spin';this.canvas.dataset.camera='wheel';this.spinAt=performance.now();this.result=round.result;this.won=round.won;this.rarity=winProbability('roulette',round.choice)<.025?3:winProbability('roulette',round.choice)<.1?2:1;this.rotation=this.rotor.rotation.y;this.endRotation=this.rotation+tau*5+.37;this.ballStart=0;this.ballEnd=ROULETTE_ORDER.indexOf(round.result)*step+step/2-this.endRotation;this.room.querySelector('.roulette-room-announcement')!.textContent='No more bets. Watch the wheel.';await new Promise<void>(r=>this.complete=r)
 }
 private fit(){const w=Math.max(1,this.canvas.clientWidth),h=Math.max(1,this.canvas.clientHeight);this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix()}
 private projectKeys(){const rect=this.canvas.getBoundingClientRect();for(const k of this.keys){const p=k.position.clone().project(this.camera),left=k.position.clone().add(v(-k.width/2,0,0)).project(this.camera),right=k.position.clone().add(v(k.width/2,0,0)).project(this.camera),front=k.position.clone().add(v(0,0,k.depth/2)).project(this.camera),back=k.position.clone().add(v(0,0,-k.depth/2)).project(this.camera)
   const width=Math.max(12,Math.abs(right.x-left.x)*rect.width/2),height=Math.max(12,Math.abs(front.y-back.y)*rect.height/2);k.button.style.left=(p.x+1)*rect.width/2+'px';k.button.style.top=(1-p.y)*rect.height/2+'px';k.button.style.width=width*.94+'px';k.button.style.height=height*.94+'px';k.button.hidden=this.active||p.z>1||p.x<-1||p.x>1||p.y<-1||p.y>1
  }}
 private tick=(now:number)=>{
  if(this.disposed)return;this.raf=requestAnimationFrame(this.tick);if(document.visibilityState!=='visible'||now-this.last<(this.active?24:50))return
  const gl=this.renderer.getContext() as WebGL2RenderingContext;if(this.fence){if(gl.clientWaitSync(this.fence,0,0)===gl.TIMEOUT_EXPIRED)return;gl.deleteSync(this.fence);this.fence=null}this.last=now
  const duration=this.reduced?650:6500,elapsed=this.active?now-this.spinAt:0,p=Math.min(1,elapsed/duration)
  if(this.active){
   const move=ease(Math.min(1,p/.17)),returning=p>.88?ease((p-.88)/.12):0;this.camBlend=move*(1-returning)
   const roll=Math.min(1,p/.78),slow=1-Math.pow(1-roll,3);this.rotor.rotation.y=T.MathUtils.lerp(this.rotation,this.endRotation,slow)
   const ballProgress=Math.min(1,p/.79),ballEase=1-Math.pow(1-ballProgress,2.4),angle=T.MathUtils.lerp(tau*9,this.ballEnd,ballEase),drop=ease(Math.max(0,Math.min(1,(p-.48)/.30))),radius=T.MathUtils.lerp(.715,.435,drop)
   this.ball.position.set(-1.03+Math.cos(angle)*radius,1.173+(1-drop)*.055+(!this.reduced&&p>.52&&p<.78?Math.abs(Math.sin(p*160))*(1-drop)*.04:0),-.04-Math.sin(angle)*radius)
   if(p>=.79&&this.room.dataset.phase==='spin'){this.room.dataset.phase='landed';this.canvas.dataset.result=String(this.result);this.room.querySelector('.roulette-room-announcement')!.textContent=(this.result===0?'The rift · 0':String(this.result))+(this.won?' · The table pays.':' · The next turn is yours.');if(this.won){this.burstAt=now;this.canvas.dataset.winTier=String(this.rarity)}}
   if(p===1){this.active=false;this.camBlend=0;this.room.dataset.phase='idle';this.canvas.dataset.camera='seat';this.rotation=this.endRotation;const done=this.complete;this.complete=undefined;done?.()}
  }
  const portrait=this.camera.aspect<1,seat=portrait?v(0,6.2,9.3):v(0,2.65,3.6),over=portrait?v(-1.03,5.9,.35):v(-1.03,3.3,.55)
  seat.x+=Math.sin(this.yaw)*2;seat.y+=this.pitch*2;seat.z-=1-Math.cos(this.yaw);this.camera.position.copy(seat.lerp(over,this.camBlend));this.camera.lookAt(this.look.clone().lerp(this.spinLook,this.camBlend));this.camera.updateMatrixWorld()
  const q=(now-this.burstAt)/(this.reduced?650:2200);this.sparks.visible=q>=0&&q<1;if(this.sparks.visible){const count=this.rarity===3?128:this.rarity===2?90:30,positions=this.sparkGeometry.getAttribute('position') as T.BufferAttribute;for(let i=0;i<128;i++){const a=i*2.399,r=q*(.3+(i%9)*.08);positions.setXYZ(i,-1.03+Math.cos(a)*r,1.2+Math.sin(q*Math.PI)*(this.rarity*.24+.2)+(i%5)*.02,-.04+Math.sin(a)*r)}positions.needsUpdate=true;this.sparkGeometry.setDrawRange(0,count);const material=this.sparks.material as T.PointsMaterial;material.opacity=Math.sin(q*Math.PI);material.color.setHex(this.rarity===3?0xd4a6ff:0xffd58d);this.canvas.dataset.winGlow='true'}else this.canvas.dataset.winGlow='false'
  this.halo.visible=this.winCoins.visible=this.sparks.visible
  if(this.sparks.visible){const fade=Math.sin(q*Math.PI),m=new T.Matrix4(),rotation=new T.Quaternion();this.halo.scale.setScalar(1+q*.65);(this.halo.material as T.MeshBasicMaterial).opacity=fade*.55;this.winLight.intensity=fade*this.rarity*7;this.winCoins.count=this.rarity*8;for(let i=0;i<this.winCoins.count;i++){const a=i*2.399,r=q*(.25+i%4*.12);rotation.setFromEuler(new T.Euler(q*8+i,a,q*5));m.compose(v(-1.03+Math.cos(a)*r,1.2+Math.sin(q*Math.PI)*(.35+i%3*.08),-.04+Math.sin(a)*r),rotation,v(1,1,1));this.winCoins.setMatrixAt(i,m)}this.winCoins.instanceMatrix.needsUpdate=true;(this.winCoins.material as T.MeshStandardMaterial).opacity=fade}else this.winLight.intensity=0
  this.dealer.rotation.z=Math.sin(now*.0012)*.008;this.patrons.forEach((person,i)=>person.rotation.z=Math.sin(now*.0008+i)*.015)
  this.projectKeys();this.renderer.render(this.world,this.camera);this.canvas.dataset.frame=String(++this.frame);this.fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush()
 }
 dispose(){if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.raf);this.observer.disconnect();this.complete?.();this.world.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose()}});this.textureCache.forEach(t=>t.dispose());this.renderer.dispose()}
}
