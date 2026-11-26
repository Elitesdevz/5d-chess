import type {IncomingMessage,Server} from 'node:http'
import {randomUUID} from 'node:crypto'
import {WebSocketServer,WebSocket} from 'ws'
import {CITY_PROTOCOL,SnapshotWriter,type ClientMessage,type Input,type Message} from '../../shared/world/protocol.ts'
import type {WorldView} from '../../src/world/model.ts'

type Receipt={id:number;status:number;message?:string}
type Peer={ws:WebSocket;request:IncomingMessage;name:string;stream:Stream;writer:SnapshotWriter;seq:number;pending?:Input;next:number;hidden:boolean}
type Stream={epoch:string;receipt?:Receipt;expires:number;peer?:Peer}
type Run=(name:string,action:string,data:Input)=>WorldView
const send=(ws:WebSocket,message:Message)=>ws.send(JSON.stringify(message))

export class CityLive {
  private wss=new WebSocketServer({noServer:true,maxPayload:32768,perMessageDeflate:false})
  private peers=new Set<Peer>()
  private streams=new Map<string,Stream>()
  constructor(privateRun:Run,authenticate:(req:IncomingMessage)=>string|undefined,version:string){
    this.run=privateRun;this.authenticate=authenticate;this.version=version
  }
  private readonly run:Run
  private readonly authenticate:(req:IncomingMessage)=>string|undefined
  private readonly version:string
  attach(server:Server){
    server.on('upgrade',(req,socket,head)=>{
      const url=new URL(req.url??'/','http://localhost')
      const origin=req.headers.origin,client=url.searchParams.get('client')??''
      let same=true
      try{if(origin)same=new URL(origin).host===(req.headers['x-forwarded-host']??req.headers.host)}catch{same=false}
      const name=this.authenticate(req)
      if(url.pathname!=='/api/world/live'||!same||!name||!/^[-\w]{12,80}$/.test(client)){socket.destroy();return}
      this.wss.handleUpgrade(req,socket,head,ws=>{
        if(url.searchParams.get('map')!==this.version||url.searchParams.get('v')!==String(CITY_PROTOCOL)){ws.close(4412,'City release changed');return}
        const key=JSON.stringify([name,client]),stream=this.streams.get(key)??{epoch:randomUUID(),expires:0}
        stream.peer?.ws.close(4001,'Connection replaced')
        const p:Peer={ws,request:req,name,stream,writer:new SnapshotWriter(),seq:0,next:0,hidden:false}
        this.streams.set(key,stream);stream.peer=p;this.peers.add(p)
        ws.on('error',()=>ws.terminate())
        ws.on('close',()=>{this.peers.delete(p);if(stream.peer===p){delete stream.peer;stream.expires=Date.now()+120000}})
        ws.on('message',(raw,binary)=>{
          if(binary||stream.peer!==p||ws.readyState!==WebSocket.OPEN)return
          if(this.authenticate(req)!==name){ws.close(4401,'Session ended');return}
          try{this.receive(p,JSON.parse(raw.toString()))}catch{ws.close(4400,'Invalid city message')}
        })
        send(ws,{type:'hello',epoch:stream.epoch,protocol:CITY_PROTOCOL})
        try{this.publish(p)}catch{ws.close(1011,'City snapshot unavailable')}
      })
    })
  }
  private publish(p:Peer,view?:WorldView){
    const start=performance.now()
    view??=this.run(p.name,p.pending?'presence':'observe',{...p.pending,scene:true})
    p.pending=undefined
    const frame=p.writer.frame(view,p.seq)
    frame.tickMs=+(performance.now()-start).toFixed(2)
    send(p.ws,{type:'frame',frame})
    p.next=performance.now()+(p.hidden?2500:160)
  }
  private receive(p:Peer,m:ClientMessage){
    if(m.type==='sleep'){p.hidden=!!m.hidden;p.next=0;return}
    if(m.type!=='move'&&m.type!=='command'||!Number.isSafeInteger(m.seq)||!m.input||typeof m.input!=='object')throw Error()
    if(m.seq>p.seq){p.seq=m.seq;p.pending=m.input}
    if(m.type==='move')return
    if(!Number.isSafeInteger(m.id)||m.id<1||typeof m.action!=='string'||!m.data||typeof m.data!=='object')throw Error()
    const previous=p.stream.receipt
    if(m.epoch!==p.stream.epoch||m.id!==(previous?.id??0)+1){
      const ack=m.epoch===p.stream.epoch&&previous?.id===m.id?previous:{id:m.id,status:409,message:'Session changed. Review your action.'}
      send(p.ws,{type:'ack',...ack});return
    }
    let receipt:Receipt={id:m.id,status:200}
    try{
      const view=this.run(p.name,m.action,{...m.data,scene:true,movement:p.pending})
      this.publish(p,view)
    }catch(error){
      receipt={id:m.id,status:(error as {status?:number}).status??500,message:error instanceof Error?error.message:'City action failed'}
    }
    p.stream.receipt=receipt
    send(p.ws,{type:'ack',...receipt})
  }
  tick(now:number){
    for(const [key,s] of this.streams)if(!s.peer&&s.expires<=now)this.streams.delete(key)
    for(const p of this.peers){
      if(p.stream.peer!==p||p.ws.readyState!==WebSocket.OPEN||p.next>performance.now())continue
      if(this.authenticate(p.request)!==p.name){p.ws.close(4401,'Session ended');continue}
      if(p.ws.bufferedAmount>65536){
        if(p.ws.bufferedAmount>1048576)p.ws.terminate()
        continue
      }
      try{this.publish(p)}catch{p.ws.close(1011,'City update failed')}
    }
  }
  close(){for(const p of this.peers)p.ws.terminate();this.wss.close();this.streams.clear()}
}
