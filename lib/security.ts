import crypto from 'node:crypto';
export const SESSION_SECONDS = 12 * 60 * 60;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validSessionToken = (value: string) => /^[0-9a-f]{64}$/.test(value);
export function safeEqual(a:string,b:string) { const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb); }
export function digest(value:string,secret:string) { return crypto.createHmac('sha256',secret).update(value).digest('hex'); }
export function validPushEndpoint(value:unknown) {
 if(typeof value!=='string'||value.length>2048)return false;
 try {const u=new URL(value),host=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host==='push.services.mozilla.com'||host==='web.push.apple.com'||host.endsWith('.push.apple.com')||host.endsWith('.notify.windows.com'));}catch{return false;}
}
export function photoMatchesMime(bytes:Buffer,mime:string) {
 if(mime==='image/jpeg')return bytes.length>3&&bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
 if(mime==='image/png')return bytes.length>8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
 if(mime==='image/webp')return bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 return false;
}
