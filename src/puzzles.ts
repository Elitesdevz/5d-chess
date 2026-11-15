import {PUZZLES,PUZZLE_CHAPTERS,puzzleById,testPuzzle,type PuzzleAttempt} from './puzzle-model.ts'
import {type Candidate,type Coord,type Order,type Resolution,boardKey,coordKey,coordName,frontier,pieceAt} from './model.ts'
import {legalMoves,routeKey} from './moves.ts'
import {sourceBudget} from './resolve.ts'
import {requiredBoards} from './rules.ts'
import {Scene} from './scene.ts'
import {NAMES,pieceIcon} from './art.ts'
import {api,getSession,initShell} from './shell.ts'
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
let puzzle=puzzleById(Number(new URLSearchParams(location.search).get('lesson')))||PUZZLES[0],state=puzzle.setup()
let selected:Coord|undefined,choices:Candidate[]=[],hover:Candidate|undefined,routeChoices:Candidate[]=[],draft:Candidate[]=[],attempt:PuzzleAttempt|undefined,hintCount=0
let animation:{outcomes:Resolution['outcomes'];started:number;duration:number;result:typeof state;travel?:NonNullable<PuzzleAttempt['result']>['travel'];ticks?:number}|undefined
let animationTimer:ReturnType<typeof setTimeout>|undefined,version=0
const earlySolves=new Map<number,Order[]>()
let user:string|null=null,sessionReady=false,accountLoaded=false,saving=false,completed=new Set<number>(),pending=new Map<number,Order[]>(),storageAvailable=true
const scene=new Scene(el<HTMLCanvasElement>('scene'),state,{
 pick,
 hover(c){hover=c?choices.find(m=>coordKey(m.to)===coordKey(c)):undefined;sync()},
 scale(n){el('scale').textContent=Math.round(n*100)+'%'},
 describe(c){const piece=pieceAt(attempt?.result?.state??state,c);el('map-caption').textContent=coordName(c,state)+(piece?' · '+piece.player+' '+NAMES[piece.kind]:'')},
 rift(a,b,from){el('map-caption').textContent=`Rift U${a} ↔ U${b} · usable from round ${from}`}
})
const locked=()=>!!attempt?.result
const key=()=>`5d-tutorial/v1/${user??'guest'}`
function restore(){
 completed=new Set();pending=new Map()
 try{const raw=JSON.parse(localStorage.getItem(key())??'{}');completed=new Set((Array.isArray(raw.completed)?raw.completed:[]).filter((id:unknown)=>typeof id==='number'&&!!puzzleById(id)));pending=new Map(Object.entries(raw.pending??{}).filter(([id])=>!!puzzleById(Number(id))).map(([id,moves])=>[Number(id),moves as Order[]]))}catch{storageAvailable=false}
}
function persist(){try{localStorage.setItem(key(),JSON.stringify({completed:[...completed],pending:Object.fromEntries(pending)}))}catch{storageAvailable=false}}
function saveMessage(text:string){el('puzzle-save').textContent=text}
async function syncPending(){
 if(!sessionReady)return
 if(!user){persist();saveMessage(storageAvailable?'Guest progress stays on this browser. Sign in for account progress.':'Browser storage is unavailable; progress lasts for this tab.');return}
 if(saving)return
 saving=true
 try{
  if(!accountLoaded){const remote=await api<{completed:number[]}>('/puzzles');completed=new Set([...remote.completed,...pending.keys()]);accountLoaded=true}
  for(const [id,orders]of pending){
   const saved=await api<{completed:number[]}>(`/puzzles/${id}/solve`,{orders})
   saved.completed.forEach(n=>completed.add(n));pending.delete(id);persist()
  }
  saveMessage('Progress saved to your account.');renderProgress()
 }catch{persist();saveMessage(storageAvailable?'Saved on this browser. Account sync will retry when you reconnect.':'Account sync unavailable. Keep this tab open to retry.')}finally{saving=false}
}
function sync(){scene.update({state:attempt?.result?.state??state,moves:locked()?[]:choices,queued:locked()?[]:[...draft,...enemyCandidates()],selected:locked()?undefined:selected,preview:locked()?undefined:hover,objectives:locked()?[]:puzzle.targets,playable:locked()?[]:requiredBoards(state,puzzle.player,draft),animation})}
function enemyCandidates(){return puzzle.enemy(state).flatMap(o=>legalMoves(state,o.from,o.to).filter(m=>routeKey(m.route)===routeKey(o.route)))}
function pick(c?:Coord){
 if(locked())return
 if(c&&selected){const matches=choices.filter(m=>coordKey(m.to)===coordKey(c));if(matches.length===1){queue(matches[0]);return}if(matches.length>1){routeChoices=matches;render();return}}
 if(c&&pieceAt(state,c)?.player===puzzle.player){
  const u=state.universes.find(u=>u.id===c.u)!
  if(frontier(u).t!==c.t){feedback('Only the latest board in a universe can supply an order. Select its frontier piece.');return}
  if(!sourceBudget(state,c,draft.filter(o=>boardKey(o.from)!==boardKey(c)))){feedback('You already used your optional source. Remove that order before choosing another optional board.');return}
  selected=c;choices=legalMoves(state,c);hover=undefined;routeChoices=[];render();return
 }
 selected=undefined;choices=[];hover=undefined;routeChoices=[];render()
}
function queue(move:Candidate){
 draft=draft.filter(o=>boardKey(o.from)!==boardKey(move.from));draft.push(move);selected=undefined;choices=[];hover=undefined;routeChoices=[];attempt=undefined;feedback('');render()
}
function feedback(text:string,ok=false){const box=el('puzzle-feedback');box.textContent=text;box.hidden=!text;box.className='puzzle-feedback '+(ok?'success':'retry')}
function renderProgress(){
 el('course-count').textContent=`${completed.size} / 30`;el('course-meter').style.width=(completed.size/30*100)+'%'
 const chapters=el('course-chapters');chapters.replaceChildren()
 for(const [chapter,title]of PUZZLE_CHAPTERS.entries()){
  const section=document.createElement('section'),heading=document.createElement('h3');heading.textContent=String(chapter+1).padStart(2,'0')+' · '+title;section.append(heading)
  for(const p of PUZZLES.filter(p=>p.chapter===chapter)){
   const button=document.createElement('button');button.type='button';button.className='course-lesson'+(completed.has(p.id)?' completed':'')+(p.id===puzzle.id?' current':'');button.innerHTML=`<span>${completed.has(p.id)?'✓':String(p.id).padStart(2,'0')}</span><b>${esc(p.title)}</b>`;if(p.id===puzzle.id)button.setAttribute('aria-current','step');button.onclick=()=>{el<HTMLDialogElement>('course-map').close();loadLesson(p.id)};section.append(button)
  }chapters.append(section)
 }
 el('course-summary').textContent=completed.size===30?'All 30 completed. The multiverse is yours to explore.':`${completed.size} completed · Every lesson is open. Hints and retries never reduce your progress.`
}
function render(){
 document.title=`${puzzle.id}. ${puzzle.title} · Learn 5D Chess`
 el('puzzle-kicker').textContent=`LESSON ${String(puzzle.id).padStart(2,'0')} / 30 · ${PUZZLE_CHAPTERS[puzzle.chapter].toUpperCase()}`
 el('puzzle-title').textContent=puzzle.title;el('puzzle-concept').textContent=puzzle.concept
 el('puzzle-lesson').innerHTML=puzzle.lesson.map(s=>'<p>'+esc(s)+'</p>').join('');el('puzzle-objective').textContent=puzzle.objective
 el('puzzle-mode').textContent=`${state.movement==='live'?'LIVE · SIMULTANEOUS':'CLASSIC · TAKE TURNS'} · YOU ARE ${puzzle.player.toUpperCase()}`
 const enemy=enemyCandidates();el('enemy-orders').hidden=!enemy.length;el('enemy-orders').innerHTML=enemy.length?'<b>FIXED ENEMY ORDERS</b>'+enemy.map(m=>`<p>${pieceIcon(m.piece.kind,m.player,19)} ${esc(m.player+' '+NAMES[m.piece.kind])}: ${esc(coordName(m.from,state))} → ${esc(coordName(m.to,state))}</p>`).join(''):''
 const remaining=requiredBoards(state,puzzle.player,draft).length;el('order-budget').textContent=locked()?'Plan resolved':remaining?`${remaining} required ${remaining===1?'board':'boards'} left`:'Required boards ready'
 el('queued-orders').innerHTML=draft.length?draft.map((m,i)=>`<div class="queued-puzzle-order">${pieceIcon(m.piece.kind,m.player,22)}<span>${esc(coordName(m.from,state))}<small>→ ${esc(coordName(m.to,state))}${m.rift?' · Rift':m.branch?' · Branch':m.castle?' · Castle':m.enPassant?' · En passant':''}</small></span><button type="button" data-remove="${i}" aria-label="Remove order ${i+1}" ${locked()?'disabled':''}>×</button></div>`).join(''):'<p class="empty-plan">Select a red piece and a destination. Then test your plan.</p>'
 el('queued-orders').querySelectorAll<HTMLButtonElement>('[data-remove]').forEach(b=>b.onclick=()=>{draft.splice(Number(b.dataset.remove),1);render()})
 el('route-choices').replaceChildren(...routeChoices.map((move,i)=>{const b=document.createElement('button');b.type='button';b.className='button';b.textContent=`Route ${i+1}: ${move.route.map(u=>'U'+u).join(' → ')}${move.rift?' · Rift':''}`;b.onclick=()=>queue(move);return b}))
 const sources=el<HTMLSelectElement>('source-select');sources.replaceChildren(new Option('Choose a red frontier piece',''))
 for(const u of state.universes)for(const [i,p]of frontier(u).cells.entries())if(p?.player===puzzle.player){const c={x:i%14,y:Math.floor(i/14),t:frontier(u).t,u:u.id};sources.add(new Option(NAMES[p.kind]+' · '+coordName(c,state),coordKey(c)))}
 sources.value=selected?coordKey(selected):'';sources.disabled=locked()
 const destinations=el<HTMLSelectElement>('destination-select');destinations.replaceChildren(new Option('Choose a destination',''))
 choices.forEach((m,i)=>destinations.add(new Option(coordName(m.to,state)+(m.rift?' · Rift':m.branch?' · Branch':m.capture?' · Capture':m.castle?' · Castle':''),String(i))));destinations.disabled=locked()||!selected
 el<HTMLButtonElement>('queue-coordinate').disabled=locked()||!selected
 el<HTMLButtonElement>('test-plan').disabled=locked()||!draft.length;el<HTMLButtonElement>('undo-order').disabled=locked()||!draft.length
 el<HTMLButtonElement>('get-hint').disabled=hintCount>=2;el('worked-plan').hidden=hintCount<2;el<HTMLButtonElement>('worked-plan').disabled=locked()
 el('next-puzzle').hidden=!attempt?.ok;el('next-puzzle').textContent=puzzle.id===30?'Try an AI opponent →':'Next lesson →'
 el('restart-puzzle').textContent=locked()?'Try again':'Reset position'
 const tabs=el('board-tabs');tabs.replaceChildren();const seen=new Set<string>()
 for(const c of [...state.universes.map(u=>({x:0,y:0,u:u.id,t:frontier(u).t})),...puzzle.targets]){const key=boardKey(c);if(seen.has(key))continue;seen.add(key);const b=document.createElement('button');b.type='button';b.textContent=`U${c.u} · T${c.t}${puzzle.targets.some(t=>boardKey(t)===key)?' ◉':''}`;b.onclick=()=>scene.focusBoard(c.u,c.t);tabs.append(b)}
 renderProgress();sync()
}
function reset(){
 clearTimeout(animationTimer);version++;state=puzzle.setup();selected=undefined;choices=[];hover=undefined;routeChoices=[];draft=[];attempt=undefined;animation=undefined;feedback('');el('map-caption').textContent='';render();scene.fit()
}
function loadLesson(id:number,push=true){puzzle=puzzleById(id)??PUZZLES[0];hintCount=0;el('puzzle-hint').hidden=true;if(push){const url=new URL(location.href);url.searchParams.set('lesson',String(puzzle.id));history.pushState(null,'',url)}reset();window.scrollTo({top:0,behavior:'instant'})}
el('test-plan').onclick=()=>{
 if(locked())return
 const result=testPuzzle(puzzle,draft);attempt=result;feedback(result.message,result.ok)
 if(result.result){
  const r=result.result,duration=matchMedia('(prefers-reduced-motion: reduce)').matches?220:Math.max(900,Math.min(2600,(r.ticks??4)*180)),current=++version
  animation={outcomes:r.outcomes,started:performance.now(),duration,result:r.state,travel:r.travel,ticks:r.ticks}
  animationTimer=setTimeout(()=>{if(version===current){animation=undefined;render()}},duration+30)
 }
 if(result.ok){completed.add(puzzle.id);pending.set(puzzle.id,draft.map(({player,from,to,route})=>({player,from,to,route})));if(!sessionReady)earlySolves.set(puzzle.id,pending.get(puzzle.id)!);persist();void syncPending()}
 render()
}
el('restart-puzzle').onclick=reset
el('undo-order').onclick=()=>{draft.pop();render()}
el('get-hint').onclick=()=>{el('puzzle-hint').hidden=false;el('puzzle-hint').textContent=puzzle.hints[Math.min(hintCount++,1)];render()}
el('worked-plan').onclick=()=>{if(locked())return;draft=puzzle.solution(state).map(o=>legalMoves(state,o.from,o.to).find(m=>routeKey(m.route)===routeKey(o.route))!);selected=undefined;choices=[];render();el('puzzle-hint').textContent='Worked plan queued. Inspect the orders, then test it to see why it works.'}
el('next-puzzle').onclick=()=>puzzle.id===30?location.assign('/chess/lobby.html#ai'):loadLesson(puzzle.id+1)
el('open-course').onclick=()=>el<HTMLDialogElement>('course-map').showModal()
el('close-course').onclick=()=>el<HTMLDialogElement>('course-map').close()
el<HTMLSelectElement>('source-select').onchange=e=>{const value=(e.target as HTMLSelectElement).value;const c=state.universes.flatMap(u=>frontier(u).cells.flatMap((p,i)=>p?.player===puzzle.player?[{x:i%14,y:Math.floor(i/14),u:u.id,t:frontier(u).t}]:[])).find(c=>coordKey(c)===value);pick(c);if(c)scene.focusBoard(c.u,c.t)}
el('queue-coordinate').onclick=()=>{const value=el<HTMLSelectElement>('destination-select').value;if(value!==''&&choices[Number(value)])queue(choices[Number(value)])}
el('fit-all').onclick=()=>scene.fit();el('focus-source').onclick=()=>scene.focusBoard(selected?.u??state.universes[0].id,selected?.t??frontier(state.universes[0]).t)
el('zoom-in').onclick=()=>scene.zoom(1.3,undefined,true);el('zoom-out').onclick=()=>scene.zoom(1/1.3,undefined,true)
new ResizeObserver(()=>requestAnimationFrame(()=>{if(selected)scene.focusBoard(selected.u,selected.t);else scene.fit()})).observe(el('scene'))
window.addEventListener('popstate',()=>loadLesson(Number(new URLSearchParams(location.search).get('lesson')),false))
window.addEventListener('online',()=>void syncPending())
restore();render();void initShell()
void (async()=>{
 try{
  const session=await getSession();user=session.user;restore();for(const [id,moves]of earlySolves){completed.add(id);pending.set(id,moves)}
  if(user){try{const remote=await api<{completed:number[]}>('/puzzles');completed=new Set([...remote.completed,...pending.keys()]);accountLoaded=true}catch{saveMessage('Account progress is unavailable. Browser progress is still usable.')}}
 }catch{saveMessage('Offline training. Progress is stored on this browser.')}
 finally{sessionReady=true;persist();renderProgress();void syncPending()}
})()
