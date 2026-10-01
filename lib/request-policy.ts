export function unsafeOrigin(request:Request){
 if(['GET','HEAD','OPTIONS'].includes(request.method))return false;
 if(request.headers.get('sec-fetch-site')==='cross-site')return true;
 const origin=request.headers.get('origin');if(!origin)return false;
 try{return new URL(origin).origin!==new URL(request.url).origin;}catch{return true;}
}
