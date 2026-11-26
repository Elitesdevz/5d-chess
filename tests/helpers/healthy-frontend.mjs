import worker from '../../.cloudflare/worker.mjs'

// These frontend-only fixtures model a healthy Pi alongside the static Worker.
export default {
  fetch(request){
    if(new URL(request.url).pathname==='/api/health')return Response.json({ok:true})
    return worker.fetch(request)
  }
}
