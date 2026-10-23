const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});try{
const page=await browser.newPage({viewport:{width:1440,height:950},serviceWorkers:'block'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const user={id:'u1',name:'Test Admin',employeeId:'100',department:'Operations',role:'Super Admin',active:true,annualTarget:12,plantId:'p1',companyId:'c1'};
await page.route('**/api/**',route=>{const path=new URL(route.request().url()).pathname;const data=path==='/api/data'?{currentUser:user,users:[user],reports:[],locations:[],departments:[],plants:[],corporatePlants:[]}:path==='/api/reports/list'?{reports:[],total:0,page:1,pageSize:50}:{reports:[],notifications:[],events:[]};return route.fulfill({contentType:'application/json',body:JSON.stringify(data)})});
await page.goto(process.env.TEST_URL||'http://localhost:3250');await page.locator('.app-shell').waitFor();
for(const name of ['Dashboard','Report ESO','All ESO Reports','Data & Reports','Submit Voice','Voice of Employee','Departments','Locations']){
 await page.setViewportSize({width:1440,height:950});await page.locator('.sidebar .nav-btn').filter({hasText:new RegExp('^'+name.replace('&','&')+'$')}).click();
 const baseline={};
 for(const width of [320,390,650,799,800,801,802,1024,1300,1301,1440,1650,1651,1920,2560]){
  await page.setViewportSize({width,height:950});await page.waitForFunction(()=>innerWidth>1300||document.querySelector('.sidebar').getBoundingClientRect().right<=0);
  const actual=await page.evaluate(()=>{
   const selectors=['.page-title h1','.content','.dashboard-summary-grid','.report-filters','.export-grid','.export-filters','.closure-rate-mini-grid','.voe-idea-stage','.form-grid','.voe-toolbar'];const result={};
   for(const selector of selectors){const el=document.querySelector(selector);if(!el)continue;const s=getComputedStyle(el);result[selector]={font:s.fontSize,padding:s.paddingTop,display:s.display,columns:s.display==='grid'?s.gridTemplateColumns.split(' ').length:0}}
   return{styles:result,overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert.equal(actual.overflow,false,name+' overflow at '+width);
  assert.equal(await page.locator('.mobile-quick-nav').isVisible(),width<=1300,'bottom tabs at '+width);
  assert.equal(await page.locator('.mobile-menu').isVisible(),width<=1300,'drawer toggle at '+width);
  const mode=width<=800?'mobile':width<=1300?'compact-desktop':'desktop';if(!baseline[mode])baseline[mode]=actual.styles;else assert.deepEqual(actual.styles,baseline[mode],name+' layout changed at '+width);
  if((name==='Submit Voice'||name==='Dashboard')&&[390,651,1300,1301,1920].includes(width))await page.screenshot({path:'work/responsive-'+name.replaceAll(' ','-')+'-'+width+'.png',fullPage:true});
 }
 console.log('PASS '+name+': consistent layouts at 13 widths, no horizontal overflow');
}
assert.deepEqual(errors,[]);
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});


