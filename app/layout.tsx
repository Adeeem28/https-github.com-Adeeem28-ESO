import PageScrollReset from "@/components/page-scroll-reset";
export const dynamic='force-dynamic';
import type { Metadata, Viewport } from "next";
import "./globals.css";
import {AutoTranslator} from "@/components/i18n";
import SiteFooter from '@/components/site-footer';
import PWARegister from "@/components/pwa-register";
export const metadata:Metadata={title:"ESO Enviroment & Safety",description:"Environment & Safety Opportunity",manifest:"/manifest.webmanifest",icons:{icon:[{url:"/eso-app-v3-192.png",sizes:"192x192",type:"image/png"},{url:"/eso-app-v3-512.png",sizes:"512x512",type:"image/png"}],apple:"/eso-app-v3-512.png"}};
export const viewport:Viewport={themeColor:"#071426",colorScheme:"dark",width:"device-width",initialScale:1,viewportFit:"cover"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><PageScrollReset/><AutoTranslator/><PWARegister/>{children}<SiteFooter/></body></html>}


