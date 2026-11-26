import {watch} from './availability.js'

const get=id=>document.getElementById(id)
function returnPath(){
  if(location.pathname!=='/chess/update.html')return location.pathname+location.search+location.hash
  try {
    const target=new URL(decodeURIComponent(location.hash.slice(1)),location.origin)
    if(target.origin===location.origin&&target.pathname.startsWith('/chess/')&&!['/chess/update.html','/chess/practice.html'].includes(target.pathname))
      return target.pathname+target.search+target.hash
  } catch {}
  return '/chess/lobby.html'
}
const destination=returnPath()
get('back').href=destination
get('back').onclick=event=>{
  // An offline navigation can display this screen at the original URL.
  if(get('back').href===location.href){event.preventDefault();location.reload()}
}
get('practice').href='/chess/practice.html#'+encodeURIComponent(destination)
const retry=watch(state=>{
  get('headline').textContent={ready:'BACK ONLINE',updating:'UPDATE IN PROGRESS',offline:'SERVER UNREACHABLE'}[state]
  get('message').textContent={ready:'The game server is ready. You can finish your round or return to the game.',updating:'The game is being updated. Play a round here while you wait.',offline:'We can’t reach the game server. You can still play here while we reconnect.'}[state]
  get('practice').hidden=state==='ready'
  get('back').hidden=state!=='ready'
})
get('retry').onclick=async()=>{
  get('retry').disabled=true
  try {await retry()} finally {get('retry').disabled=false}
}

const board=get('snake'),ctx=board.getContext('2d'),size=18,cell=board.width/size
const directions={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]}
let snake,direction,queued,food,points,timer
function placeFood(){
  const empty=[]
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!snake.some(p=>p.x===x&&p.y===y))empty.push({x,y})
  return empty[Math.floor(Math.random()*empty.length)]
}
function draw(){
  ctx.fillStyle='#11271f';ctx.fillRect(0,0,board.width,board.height)
  ctx.fillStyle='#33493b'
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)ctx.fillRect(x*cell+cell/2,y*cell+cell/2,2,2)
  if(food){
    ctx.fillStyle='#ffc27b';ctx.beginPath()
    ctx.arc((food.x+.5)*cell,(food.y+.5)*cell,cell*.32,0,Math.PI*2);ctx.fill()
  }
  snake.forEach(({x,y},i)=>{
    ctx.fillStyle=i?'#8dbb83':'#d8edab';ctx.fillRect(x*cell+1,y*cell+1,cell-2,cell-2)
    if(i===0){
      const [dx,dy]=directions[direction]
      ctx.fillStyle='#20392d'
      for(const side of [-1,1])ctx.fillRect((x+.44+dx*.22+dy*side*.19)*cell,(y+.44+dy*.22+dx*side*.19)*cell,3,3)
    }
  })
  get('score').textContent=String(points)
}
function reset(){
  snake=[{x:8,y:9},{x:7,y:9},{x:6,y:9},{x:5,y:9}]
  direction='right';queued=direction;food={x:12,y:9};points=0;draw()
}
function stop(label,message){
  clearInterval(timer);timer=undefined
  get('cover').hidden=false;get('start').textContent=label;get('pause').hidden=true
  get('snake-status').textContent=message
}
function advance(){
  direction=queued
  const [dx,dy]=directions[direction],head={x:snake[0].x+dx,y:snake[0].y+dy}
  const eating=head.x===food.x&&head.y===food.y
  const body=eating?snake:snake.slice(0,-1)
  if(head.x<0||head.x>=size||head.y<0||head.y>=size||body.some(p=>p.x===head.x&&p.y===head.y)){
    stop('Play again','Game over · '+points+' points');return
  }
  snake=[head,...body]
  if(eating){points++;food=placeFood()}
  draw()
  if(!food)stop('Play again','Board cleared!')
}
function play(){
  if(timer)return
  if(get('start').textContent!=='Resume')reset()
  get('cover').hidden=true;get('pause').hidden=false;get('snake-status').textContent='Arrow keys or WASD'
  board.focus({preventScroll:true})
  timer=setInterval(advance,170)
}
const pause=()=>{if(timer)stop('Resume','Paused')}
function turn(next){
  if(!timer)return
  const [x,y]=directions[direction],[dx,dy]=directions[next]
  if(x+dx!==0||y+dy!==0)queued=next
}
get('start').onclick=play;get('pause').onclick=pause
for(const b of document.querySelectorAll('[data-dir]'))b.onclick=()=>turn(b.dataset.dir)
board.onkeydown=event=>{
  const key=event.key.toLowerCase(),next={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'}[key]
  if(next){event.preventDefault();turn(next)}
  if(key===' '){event.preventDefault();if(timer)pause();else play()}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()})
reset()
