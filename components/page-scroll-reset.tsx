"use client";
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
export function resetPageScroll(){
 if(window.location.hash)return;
 window.scrollTo({top:0,left:0,behavior:'instant'});
 document.querySelector<HTMLElement>('.content')?.scrollTo({top:0,left:0,behavior:'instant'});
}
export default function PageScrollReset(){
 const path=usePathname();
 useEffect(()=>{
  const previous=history.scrollRestoration;
  history.scrollRestoration='manual';
  const reset=()=>resetPageScroll();
  window.addEventListener('pageshow',reset);
  return()=>{history.scrollRestoration=previous;window.removeEventListener('pageshow',reset);};
 },[]);
 useEffect(()=>{const frame=requestAnimationFrame(resetPageScroll);return()=>cancelAnimationFrame(frame);},[path]);
 return null;
}
