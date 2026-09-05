import ESOApp from '@/components/eso-app';
export default async function CompanyLoginPage({params}:{params:Promise<{code:string}>}){const{code}=await params;return <ESOApp companyCode={decodeURIComponent(code).toUpperCase()}/>}
