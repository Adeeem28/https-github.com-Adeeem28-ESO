import {NextResponse} from 'next/server';import {clearPlatformSession} from '@/lib/server';
export async function POST(){await clearPlatformSession();return NextResponse.json({ok:true})}
