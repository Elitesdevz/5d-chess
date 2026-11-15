import {parentPort,workerData} from 'node:worker_threads'
import {chooseAiPlan} from '../src/ai.ts'
try{parentPort!.postMessage({orders:chooseAiPlan(workerData.state,workerData.player,workerData.id,workerData.seed,{fast:workerData.fast,budgetMs:300})})}
catch{parentPort!.postMessage({error:'AI planning failed'})}
