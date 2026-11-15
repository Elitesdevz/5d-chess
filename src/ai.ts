import {checks} from './awareness.ts'
import {aiOpponent,type AiId} from './ai-model.ts'
import {FORWARD,boardKey,boardTurn,frontier,index,isMain,pieceAt,present,survivors,type Candidate,type Kind,type Order,type Player,type State} from './model.ts'
import {legalMoves,orderKey} from './moves.ts'
import {requiredBoards} from './rules.ts'
import {resolveRound} from './resolve.ts'
const VALUE:Record<Kind,number>={P:100,N:340,B:290,R:500,Q:750,K:0}
const clean=(m:Order):Order=>({player:m.player,from:m.from,to:m.to,route:m.route})
const hash=(text:string)=>{let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0)/4294967296}
function material(s:State,player:Player){
 let score=0,weight=0
 for(const u of s.universes){const w=u.active?1:.35;weight+=w;for(const p of frontier(u).cells)if(p&&!s.eliminated.includes(p.player))score+=(p.player===player?1:-1)*VALUE[p.kind]*w}
 return score/Math.max(1,weight)
}
function evaluation(s:State,player:Player){
 const alive=survivors(s)
 if(!alive.length)return 0
 if(!alive.includes(player))return -1_000_000
 if(alive.length===1)return 1_000_000
 return material(s,player)
}
function heuristic(s:State,m:Candidate,id:AiId,seed:string){
 const rank=aiOpponent(id)!.rank,target=pieceAt(s,m.to),spatial=m.from.u===m.to.u&&m.from.t===m.to.t
 let score=0
 if(target&&target.player!==m.player){score+=target.kind==='K'?100_000:VALUE[target.kind]*(id==='brass'?1.3:1);if(s.movement==='live')score-=m.piece.kind==='K'?200_000:VALUE[m.piece.kind]*.85}
 if(m.piece.kind==='K')score-=18
 if(m.castle)score+=45
 const centre=(x:number,y:number)=>Math.abs(x-6.5)+Math.abs(y-6.5)
 score+=(centre(m.from.x,m.from.y)-centre(m.to.x,m.to.y))*(id==='brass'?3:6)
 if(!m.piece.moved&&m.piece.kind!=='K'&&m.piece.kind!=='R')score+=15
 if(m.piece.kind==='P'){const f=FORWARD[m.player];score+=((m.to.x-m.from.x)*f.x+(m.to.y-m.from.y)*f.y)*4}
 // Every additional historical king is another potential way to lose the faction.
 if(m.branch)score-=id==='vesper'?45:100
 if(!spatial&&id==='vesper')score+=16
 if(m.piece.kind==='N'&&id==='iris')score+=7
 if(m.piece.kind==='R'&&id==='brass')score+=9
 // Make progress toward an enemy king rather than shuffling in empty endgames.
 const kings=s.universes.flatMap(u=>frontier(u).cells.flatMap((p,i)=>p&&p.player!==m.player&&p.kind==='K'?[{x:i%14,y:Math.floor(i/14),u:u.id,t:frontier(u).t}]:[]))
 const nearest=(c:Order['from'])=>Math.min(30,...kings.map(k=>Math.abs(k.x-c.x)+Math.abs(k.y-c.y)+(k.u===c.u?0:4)))
 if(m.piece.kind!=='K')score+=(nearest(m.from)-nearest(m.to))*3
 const noise=[42,10,3,2,.5][rank-1]
 return score+(hash(seed+orderKey(m))-.5)*noise
}
/** Full legal plans: compulsory Present sources first, at most one optional source. */
function plans(s:State,player:Player,id:AiId,seed:string,limit:number){
 if(!survivors(s).includes(player)||(s.movement==='classic'&&s.turn!==player))return [[]] as Order[][]
 const threats=aiOpponent(id)!.rank>=3?checks(s,player):[]
 const required=requiredBoards(s,player),keys=new Set(required.map(boardKey)),boards:{key:string;main:boolean;moves:Candidate[]}[]=[]
 for(const u of s.universes){
  if(s.movement==='classic'&&boardTurn(s,u)!==player)continue
  const b=frontier(u),key=boardKey({u:u.id,t:b.t}),moves:Candidate[]=[]
  for(let i=0;i<b.cells.length;i++){
   const p=b.cells[i];if(!p||p.player!==player)continue
   moves.push(...legalMoves(s,{x:i%14,y:Math.floor(i/14),u:u.id,t:b.t}))
  }
  const defensive=(m:Candidate)=>threats.reduce((n,t)=>n+(m.piece.kind==='K'&&boardKey(m.from)===boardKey(t.king)&&index(m.from)===index(t.king)?100:0)+(boardKey(m.to)===boardKey(t.attacker)&&index(m.to)===index(t.attacker)?120:0)+(t.move.path.some(c=>boardKey(c)===boardKey(m.to)&&index(c)===index(m.to))?70:0),0)
  const ranked=moves.map(m=>({m,score:heuristic(s,m,id,seed)+defensive(m)})).sort((a,b)=>b.score-a.score||orderKey(a.m).localeCompare(orderKey(b.m)))
  moves.splice(0,moves.length,...ranked.map(r=>r.m))
  if(moves.length)boards.push({key,main:keys.has(key),moves:moves.slice(0,Math.max(limit,8))})
 }
 const main=boards.filter(b=>b.main),optional=boards.filter(b=>!b.main&&!isMain(s.universes.find(u=>u.id===b.moves[0].from.u)!,present(s))).flatMap(b=>b.moves)
 optional.sort((a,b)=>heuristic(s,b,id,seed)-heuristic(s,a,id,seed))
 const base=main.map(b=>b.moves[0]),extra=optional[0]
 if(extra&&heuristic(s,extra,id,seed)>20)base.push(extra)
 const variants:Order[][]=[base.map(clean)]
 for(const board of main)for(const alt of board.moves.slice(1,limit)){
  const variant=base.map(m=>boardKey(m.from)===board.key?alt:m)
  variants.push(variant.map(clean));if(variants.length>=limit)return variants
 }
 if(extra&&!base.includes(extra))variants.push([...base,extra].map(clean))
 if(base.includes(extra))variants.push(base.filter(m=>m!==extra).map(clean))
 return variants.slice(0,limit)
}
/** Bounded public-position search. Never receives an opponent's submitted orders. */
export function chooseAiPlan(s:State,player:Player,id:AiId,seed:string,options:{budgetMs?:number;fast?:boolean}={}):Order[]{
 const bot=aiOpponent(id);if(!bot)throw Error('Unknown AI opponent')
 const rank=options.fast?1:bot.rank,deadline=performance.now()+(options.budgetMs??220)
 const roots=plans(s,player,options.fast?'pip':id,seed,[1,3,5,8,12][rank-1])
 if(rank===1)return roots[0]
 const enemy=survivors(s).find(p=>p!==player)!
 const replies=s.movement==='live'?plans(s,enemy,'orion',seed+':reply',[1,1,3,4,6][rank-1]):[]
 let best=roots[0],bestScore=-Infinity
 for(const root of roots){
  let score=-Infinity
  if(s.movement==='classic'){
   const own=resolveRound(s,root,{partial:true});if(own.rejected.length)continue
   if(survivors(own.state).length<=1)score=evaluation(own.state,player)
   else if(rank<3)score=evaluation(own.state,player)
   else{
    const answers=plans(own.state,enemy,'orion',seed+':reply',rank===5?6:3)
    score=Math.min(...answers.map(answer=>evaluation(resolveRound(own.state,answer,{partial:true}).state,player)-(own.state.universes.length-s.universes.length)*20))
   }
  }else{
   const scores=replies.map(reply=>{const r=resolveRound(s,[...root,...reply],{partial:true});return r.rejected.length?-1_000_001:evaluation(r.state,player)-(r.state.universes.length-s.universes.length)*20})
   score=Math.min(...scores)*.85+scores.reduce((a,b)=>a+b,0)/Math.max(1,scores.length)*.15
  }
  // Positional development breaks equal material scores without overruling king survival.
  score+=root.reduce((n,o)=>{const piece=pieceAt(s,o.from)!;const match=legalMoves(s,o.from,o.to).find(m=>m.route.join('/')===o.route.join('/'));return n+(match?Math.max(-100,Math.min(100,heuristic(s,match,id,seed))):VALUE[piece.kind]*0)},0)*.08
  if(score>bestScore){bestScore=score;best=root}
  if(performance.now()>deadline)break
 }
 return best
}
export function aiAcceptsDraw(s:State){
 return s.universes.every(u=>frontier(u).cells.every(p=>!p||s.eliminated.includes(p.player)||p.kind==='K'))
}
