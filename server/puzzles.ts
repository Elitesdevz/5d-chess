import {income} from './credit.ts'
import {toStockUnits} from '../src/stock-model.ts'
import {PUZZLES,puzzleById,testPuzzle} from '../src/puzzle-model.ts'
import type {Account} from './accounts.ts'
import type {Reply} from './model.ts'
import {fail} from './http.ts'
import {wallet} from './economy.ts'
export const PUZZLE_REWARD=25
export const puzzleProgress=(account:Account)=>{
 const completed=[...new Set((account.puzzleCompleted??[]).filter(id=>!!puzzleById(id)))].sort((a,b)=>a-b)
 return {completed,total:PUZZLES.length,next:PUZZLES.find(p=>!completed.includes(p.id))?.id??PUZZLES.length}
}
export function puzzleApi(account:Account,path:string,method:string,data:Record<string,unknown>):Reply|undefined{
 if(path==='/api/puzzles'&&method==='GET')return {status:200,value:puzzleProgress(account)}
 const match=/^\/api\/puzzles\/(\d+)\/solve$/.exec(path)
 if(!match)return
 if(method!=='POST')fail(405,'Submit a puzzle plan with POST')
 const puzzle=puzzleById(Number(match[1]));if(!puzzle)fail(404,'Puzzle not found')
 const attempt=testPuzzle(puzzle,data.orders)
 if(!attempt.ok)fail(400,attempt.message)
 const previous=puzzleProgress(account).completed, reward=previous.includes(puzzle.id)?0:PUZZLE_REWARD
 if(reward){wallet(account);income(account,toStockUnits(reward))}
 account.puzzleCompleted=[...new Set([...previous,puzzle.id])].sort((a,b)=>a-b)
 return {status:200,value:{...puzzleProgress(account),reward}}
}
