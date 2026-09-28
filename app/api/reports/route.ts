import { mutateReport } from '@/lib/eso-mutations';
export async function POST(req:Request){return mutateReport(req,'create');}
export async function PATCH(req:Request){return mutateReport(req,'edit');}
