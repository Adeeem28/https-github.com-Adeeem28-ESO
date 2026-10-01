import type {NextConfig} from 'next';
const nextConfig:NextConfig={
 reactStrictMode:true,poweredByHeader:false,
 async headers(){return [{source:'/:path*',headers:[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'no-referrer'},
  {key:'Permissions-Policy',value:'camera=(self), microphone=(), geolocation=()'},
  ...(process.env.NODE_ENV==='production'?[{key:'Strict-Transport-Security',value:'max-age=31536000'}]:[])
 ]},{source:'/sw.js',headers:[{key:'Cache-Control',value:'no-cache'}]}];}
};
export default nextConfig;
