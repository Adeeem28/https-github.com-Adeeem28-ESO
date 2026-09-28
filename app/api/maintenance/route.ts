import { mutateReport } from '@/lib/eso-mutations';
export async function POST(req:Request){return mutateReport(req,'take');}
