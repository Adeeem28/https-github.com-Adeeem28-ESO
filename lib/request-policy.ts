export function unsafeOrigin(request:Request){
 if(['GET','HEAD','OPTIONS'].includes(request.method))return false;
 if(request.headers.get('sec-fetch-site')==='cross-site')return true;
 const origin=request.headers.get('origin');if(!origin)return false;
 try{
  const url=new URL(request.url);
  const forwardedHost=request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host=forwardedHost||request.headers.get('host')?.trim()||url.host;
  const forwardedProto=request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol=forwardedProto||url.protocol.slice(0,-1);
  return new URL(origin).origin!==`${protocol}://${host}`;
 }catch{return true;}
}
