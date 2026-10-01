import {NextRequest,NextResponse} from 'next/server';
import {unsafeOrigin} from './lib/request-policy';
export function middleware(req:NextRequest){
 const api=req.nextUrl.pathname.startsWith('/api/');
 if(api){
  if(unsafeOrigin(req))return NextResponse.json({error:'Cross-origin request rejected.'},{status:403});
  if(Number(req.headers.get('content-length')||0)>4_200_000)return NextResponse.json({error:'Request too large.'},{status:413});
  const res=NextResponse.next();res.headers.set('Cache-Control','private, no-store');return res;
 }
 const nonce=btoa(crypto.randomUUID()),dev=process.env.NODE_ENV!=='production';
 const storage=(()=>{try{return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL||'').origin;}catch{return '';}})();
 const csp=["default-src 'self'",`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev?" 'unsafe-eval'":''}`,"style-src 'self' 'unsafe-inline'",`img-src 'self' blob: data: ${storage}`,"font-src 'self'",`connect-src 'self' ${dev?'ws:':''}`,"worker-src 'self'","object-src 'none'","base-uri 'self'","form-action 'self'","frame-ancestors 'none'"].join('; ');
 const headers=new Headers(req.headers);headers.set('x-nonce',nonce);headers.set('Content-Security-Policy',csp);
 const res=NextResponse.next({request:{headers}});res.headers.set('Content-Security-Policy',csp);res.headers.set('Cache-Control','private, no-store');return res;
}
export const config={matcher:['/api/:path*','/','/owner','/c/:path*']};
