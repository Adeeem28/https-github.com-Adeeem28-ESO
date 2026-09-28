import { NextRequest, NextResponse } from 'next/server';
import { GET as detail } from '../detail/route';
export async function GET(req:NextRequest){
 const result=await detail(req);if(!result.ok)return result;
 const data=await result.json();
 const before=data.photos.find((p:any)=>p.type==='report'),after=[...data.photos].reverse().find((p:any)=>p.type==='completion');
 return NextResponse.json({...data,imageData:before?.url,imageName:before?.name,completionImageData:after?.url,completionImageName:after?.name},{headers:{'Cache-Control':'private, no-store'}});
}
