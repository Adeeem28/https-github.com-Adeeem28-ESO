import {classify} from '@/lib/eso-classification';
export async function POST(req:Request){return classify(req,'reclassify');}
