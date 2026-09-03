import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWARegister from "@/components/pwa-register";
export const metadata:Metadata={title:"ESO Management System",description:"Environment & Safety Opportunity",manifest:"/manifest.webmanifest",icons:{icon:[{url:"/icon-192.png",sizes:"192x192",type:"image/png"},{url:"/icon-512.png",sizes:"512x512",type:"image/png"}],apple:"/icon-512.png"}};
export const viewport:Viewport={themeColor:"#071426",width:"device-width",initialScale:1,viewportFit:"cover"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><PWARegister/>{children}</body></html>}
