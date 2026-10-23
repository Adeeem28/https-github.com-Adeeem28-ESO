export default function LoadingStatus({label="Loading ESO Management System…",fullScreen=false}:{label?:string;fullScreen?:boolean}){
 return <div className={fullScreen?'eso-loading-screen':'eso-loading-inline'} role="status" aria-live="polite" aria-busy="true">
  <span className="eso-loading-ring" aria-hidden="true"/>
  <span className="eso-loading-label">{label}</span>
 </div>;
}
