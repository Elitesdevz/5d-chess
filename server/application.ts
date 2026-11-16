import {UsageStore,usagePath,usageApi,serverUsage} from './telemetry.ts'
import {puzzleApi} from './puzzles.ts'
import {AiScheduler} from './ai-scheduler.ts'
import type {IncomingMessage, ServerResponse} from 'node:http'
import type {ChessStore} from './storage.ts'
import {body, checkOrigin, fail, json} from './http.ts'
import {LoginLimiter, user} from './security.ts'
import {authApi} from './auth-api.ts'
import {playerProfileApi} from './player-profile.ts'
import {accountApi} from './account-api.ts'
import {economyApi} from './economy-api.ts'
import {gameApi} from './game-api.ts'
import {eloApi} from './elo-gambling.ts'
import {casinoApi} from './casino-api.ts'
import {ensureAccount,pruneNotices} from './accounts.ts'
import {staticFile} from './static.ts'
import {STORAGE_SCHEMA} from './storage.ts'

export function createApplication(store: ChessStore) {
  const usage=new UsageStore(usagePath(store))
  const ai=new AiScheduler(store)
  ai.kick()
  const limiter = new LoginLimiter()
  const cleanNotices=()=>{for(const row of store.leaderboard())store.transaction(unit=>{const account=unit.users.get(row.name);if(account)pruneNotices(account)})}
  cleanNotices()
  const noticeTimer=setInterval(cleanNotices,60*1000);noticeTimer.unref()
  let draining = false
  return {
    drain: () => {draining = true;ai.stop();clearInterval(noticeTimer);usage.close()},
    handle: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      const started=Date.now();let actor:string|undefined,pathForUsage='',methodForUsage=req.method??'GET',beforeUsage:{coins?:number;elo?:number}|undefined
      const logUsage=(status:number)=>{try{serverUsage(usage,store,actor,pathForUsage,methodForUsage,status,started,typeof req.headers['x-client-trace']==='string'?req.headers['x-client-trace']:undefined,typeof req.headers['x-ui-action']==='string'?req.headers['x-ui-action']:undefined,beforeUsage)}catch{/* Diagnostics must not change an API response. */}}
      try {
        if (draining) {json(res, 503, {error: 'Server restarting. Please try again.'}, {'retry-after': '1'}); return}
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`), path = url.pathname
        if (!path.startsWith('/api/')) {await staticFile(req,res,path); return}
        pathForUsage=path
        checkOrigin(req)
        const method = req.method || 'GET'
        if (path === '/api/health' && method === 'GET') {store.ready(); json(res,200,{ok: true, storageSchema: STORAGE_SCHEMA}); return}
        // Never hold the writer lock while awaiting a network request body.
        const data = method === 'POST' && path !== '/api/logout' ? await body(req) : {}
        const reply = store.transaction(unit => {
          actor=user(unit,req)
          const auth = authApi(unit,req,path,data,limiter)
          if (auth){const named=(auth.value as {user?:unknown}).user;if(typeof named==='string')actor=named;return auth}
          const me = user(unit,req) ?? fail(401,'Log in first')
          const account = ensureAccount(unit.users.get(me) ?? fail(401,'Log in first'));actor=me;beforeUsage={coins:account.wallet?.coins,elo:account.rating?.value}
          return usageApi(usage,store,me,path,method,data)
            ?? puzzleApi(account,path,method,data)
            ?? playerProfileApi(store,unit,account,url,method,data)
            ?? accountApi(store,account,path,method,data)
            ?? economyApi(unit,account,path,method,data)
            ?? eloApi(unit,store,account,path,method,data)
            ?? casinoApi(unit,account,path,method,data)
            ?? gameApi(store,unit,me,path,method,data)
            ?? fail(404,'Not found')
        })
        // Send success only after the SQL commit succeeds.
        json(res,reply.status,reply.value,reply.headers);logUsage(reply.status)
        ai.kick()
      } catch (error) {
        const code = (error as {code?: string}).code
        const busy = code === 'ERR_SQLITE_ERROR' && /locked|busy/i.test((error as Error).message)
        const status = busy ? 503 : (error as {status?: number}).status || 500
        logUsage(status)
        json(res,status,{error: status === 500 ? 'Internal server error' : busy ? 'Storage busy. Please try again.' : (error as Error).message})
        if (status === 500) console.error(error)
      }
    },
  }
}
