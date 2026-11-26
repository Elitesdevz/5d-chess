export default {
  fetch(request) {
    const url = new URL(request.url)
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {status: 405, headers: {Allow: 'GET, HEAD'}})
    }
    if (url.pathname === '/' || url.pathname === '/chess') return Response.redirect(new URL('/chess/' + url.search, url), 308)
    const destination=({'/chess/roulette.html':'casino','/chess/dice.html':'casino','/chess/bank.html':'bank','/chess/stocks.html':'stocks'})[url.pathname]
    if(destination&&!(url.pathname==='/chess/dice.html'&&url.searchParams.get('cave')==='1')){
      return new Response(null,{status:302,headers:{Location:'/chess/world.html?go='+destination,'Cache-Control':'no-store'}})
    }
    if (!url.pathname.startsWith('/chess/')) return new Response('Not found', {status: 404})
    const name = url.pathname.slice('/chess/'.length) || 'index.html'
    if (!Object.hasOwn(assets, name)) return new Response('Not found', {status: 404})
    const {body, type, binary} = assets[name]
    const content = request.method === 'HEAD' ? null : binary ? Uint8Array.from(atob(body), c => c.charCodeAt(0)) : body
    return new Response(content, {headers: {
      'Content-Type': type,
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com 'sha256-DoIpoHN9tlbJqR6F+WhcxIOzrf+vYjyvX6l/N5KzMTU='; img-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    }})
  }
}
