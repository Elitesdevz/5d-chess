import test from 'node:test'
import assert from 'node:assert/strict'
import {dayKey,nextReset} from '../src/collection.ts'
import {ensureAccount} from '../server/accounts.ts'
import {rewardCaptures,settleGameCoinNotices,DAILY_GAME_REWARD_POOL} from '../server/game-rewards.ts'
import {initialState} from '../src/model.ts'

const at={x:5,y:5,u:0,t:0}
function account(name='Alice'){return ensureAccount({name,salt:'salt',hash:'hash'})}
function result(actor='red',captures=1){return {state:initialState(2,'live'),rejected:[],eliminated:[],outcomes:[{move:{player:actor},status:'applied',captures:Array.from({length:captures},()=>({at,piece:{kind:'P',player:'yellow'}}))}]}}
function room(overrides={}){return {code:'TEST',title:'Test game',owner:'Alice',seats:{red:'Alice',yellow:'Bob'},state:initialState(2,'live'),journal:[],results:[],locked:{},created:0,...overrides}}

test('captures reward human players only, with diminishing minimum and a Dutch-midnight reset',()=>{
 const alice=account(),coins=alice.wallet.coins,live=room()
 const first=result(),second=result();rewardCaptures(live,first,n=>n==='Alice'?alice:undefined,Date.parse('2026-11-17T12:00:00Z'));rewardCaptures(live,second,n=>n==='Alice'?alice:undefined,Date.parse('2026-11-17T12:00:00Z'))
 assert.equal(first.outcomes[0].captures[0].rewardCoins,4);assert.equal(alice.gameRewardDaily.events,2);assert.equal(alice.wallet.coins-coins,8)
 alice.gameRewardDaily.events=1000
 const late=result();rewardCaptures(live,late,n=>n==='Alice'?alice:undefined,Date.parse('2026-11-17T12:00:00Z'));assert.equal(late.outcomes[0].captures[0].rewardCoins,1)
 const fresh=result(),reset=nextReset(Date.parse('2026-11-17T12:00:00Z'));rewardCaptures(live,fresh,n=>n==='Alice'?alice:undefined,reset);assert.equal(alice.gameRewardDaily.day,dayKey(reset));assert.equal(fresh.outcomes[0].captures[0].rewardCoins,4)
 const before=alice.wallet.coins;rewardCaptures(room({seats:{red:'Alice'}}),result(),n=>n==='Alice'?alice:undefined,reset);assert.equal(alice.wallet.coins,before)
 const aiRoom=room({ai:{id:'orion',player:'yellow'}}),beforeDaily=alice.gameRewardDaily.events
 rewardCaptures(aiRoom,result('yellow'),n=>n==='Alice'?alice:undefined,reset);assert.equal(alice.gameRewardDaily.events,beforeDaily)
})

test('capture rewards share the 2000-coin per-player daily pool',()=>{
 const alice=account(),now=Date.parse('2026-11-17T12:00:00Z'),live=room();alice.gameRewardDaily={day:dayKey(now),coins:DAILY_GAME_REWARD_POOL-1,events:500}
 const once=result(),twice=result();rewardCaptures(live,once,n=>n==='Alice'?alice:undefined,now);rewardCaptures(live,twice,n=>n==='Alice'?alice:undefined,now)
 assert.equal(once.outcomes[0].captures[0].rewardCoins,1);assert.equal(twice.outcomes[0].captures[0].rewardCoins,undefined);assert.equal(alice.gameRewardDaily.coins,DAILY_GAME_REWARD_POOL)
})

test('AI losses receive coins and every finished human gets one accurate game receipt',()=>{
 const alice=account(),before=alice.wallet.coins,now=Date.parse('2026-11-17T12:00:00Z'),lost=room({ai:{id:'orion',player:'yellow'},state:{...initialState(2,'live'),eliminated:['red']}}),lookup=n=>n==='Alice'?alice:undefined
 settleGameCoinNotices(lost,lookup,now);settleGameCoinNotices(lost,lookup,now)
 assert.equal(alice.wallet.coins-before,4);assert.equal(lost.ai.lossReward,4);assert.equal(alice.notifications.filter(n=>n.title==='You won 4 coins from game').length,1)
 const won=room({ai:{id:'orion',player:'yellow',reward:{coins:360,day:dayKey(now),win:1}},state:{...initialState(2,'live'),eliminated:['yellow']},gameRewardTotals:{red:4}})
 settleGameCoinNotices(won,lookup,now);assert.ok(alice.notifications.some(n=>n.title==='You won 364 coins from game'))
})
