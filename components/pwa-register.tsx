"use client";
import {useEffect,useState} from 'react';
import {Download, X, Smartphone} from 'lucide-react';
type InstallEvent=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:string}>};
export default function PWARegister(){
 const [phase,setPhase]=useState<'login'|'app'|null>(null);
 const [offer,setOffer]=useState(false);
 const [installed,setInstalled]=useState(false);
 const [prompt,setPrompt]=useState<InstallEvent|null>(null);
 const [instructions,setInstructions]=useState(false);
 const [busy,setBusy]=useState(false);
 useEffect(()=>{
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  const standalone=window.matchMedia('(display-mode: standalone)');
  const sync=()=>setInstalled(standalone.matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone));
  sync();standalone.addEventListener('change',sync);
  const ready=(event:Event)=>{event.preventDefault();setPrompt(event as InstallEvent);};
  const done=()=>{setInstalled(true);setOffer(false);setPrompt(null);};
  const auth=(event:Event)=>setPhase((event as CustomEvent).detail.authenticated?'app':'login');
  window.addEventListener('beforeinstallprompt',ready);window.addEventListener('appinstalled',done);window.addEventListener('eso-auth-ready',auth);
  return()=>{standalone.removeEventListener('change',sync);window.removeEventListener('beforeinstallprompt',ready);window.removeEventListener('appinstalled',done);window.removeEventListener('eso-auth-ready',auth);};
 },[]);
 useEffect(()=>{
  if(!phase||installed)return;
  let seen=false;try{seen=sessionStorage.getItem('eso-install-offer-'+phase)==='seen';}catch{}
  setInstructions(false);setOffer(!seen);
 },[phase,installed]);
 const dismiss=()=>{if(phase)try{sessionStorage.setItem('eso-install-offer-'+phase,'seen');}catch{}setOffer(false);};
 const install=async()=>{
  if(!prompt){setInstructions(true);return;}
  setBusy(true);
  try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==="accepted")setInstalled(true);setPrompt(null);dismiss();}catch{setInstructions(true);}finally{setBusy(false);}
 };
 if(!offer||installed||!phase)return null;
 return <aside className={`pwa-install-offer pwa-install-${phase}`} role="region" aria-label="Install ESO">
  <button className="pwa-install-close" aria-label="Not now" onClick={dismiss}><X size={18}/></button>
  <Smartphone size={24} aria-hidden="true"/>
  <div><strong>Install ESO</strong><p>Add ESO to your home screen for quick access.</p>
  {instructions&&<p role="status">Open your browser menu and choose Install app or Add to Home Screen. On iPhone, use Safari → Share → Add to Home Screen.</p>}
  <div className="pwa-install-actions"><button className="outline-btn" onClick={dismiss}>Not now</button><button className="primary-btn" disabled={busy} onClick={install}><Download size={17}/>Install app</button></div></div>
 </aside>;
}

