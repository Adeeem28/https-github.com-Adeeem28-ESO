const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH});try{
for(const role of ['Employee','Maintenance','Supervisor','Management','Admin','Super Admin']){
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});const user={id:'u1',name:'Test User',employeeId:'100',department:'Operations',role,active:true,annualTarget:12,plantId:'p1',companyId:'c1'};
 await page.route('**/api/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(new URL(route.request().url()).pathname==='/api/data'?{currentUser:user,users:[user],reports:[],locations:[],departments:[],plants:[],corporatePlants:[]}:{reports:[],notifications:[],events:[]})}));
 await page.goto('http://localhost:3250');const nav=page.locator('.mobile-quick-nav');await nav.waitFor();
 assert.equal(await nav.locator('.quick-tab-chevron').count(),0);
 assert.deepEqual(await nav.locator('.quick-tab>span').allTextContents(),['Home','My ESO','Report','Voice of Employee','Administration']);
 const viewAll=['Management','Admin','Super Admin'].includes(role),admin=['Admin','Super Admin'].includes(role),maintain=role!=='Employee';
 for(const [index,expected]of [[1,[true,true,viewAll,viewAll,true]],[3,[true,true,viewAll]],[4,[role==='Super Admin',admin,admin,admin,maintain]]]){
  await nav.locator('.quick-tab').nth(index).click();
  assert.deepEqual(await nav.locator('.quick-panel-items button').evaluateAll(bs=>bs.map(b=>!b.disabled)),expected);
  const geometry=await nav.evaluate(n=>({panel:n.querySelector('.quick-panel').getBoundingClientRect().bottom,tabs:n.getBoundingClientRect().top}));assert.ok(geometry.panel<geometry.tabs);
  await page.keyboard.press('Escape');assert.equal(await nav.locator('.quick-panel').count(),0);
 }
 await nav.locator('.quick-tab').nth(1).click();await nav.getByRole('button',{name:'Report ESO',exact:true}).click();await page.locator('.eso-report-form').waitFor();assert.equal(await nav.locator('.quick-panel').count(),0);
 await nav.locator('.quick-tab').nth(3).click();await nav.getByRole('button',{name:'Submit Voice',exact:true}).click();await page.locator('.voe-form').waitFor();
 await nav.locator('.quick-tab').nth(4).click();await page.locator('.voe-compose-heading h2').click();assert.equal(await nav.locator('.quick-panel').count(),0);
 if(role==='Super Admin'){
  await page.evaluate(()=>localStorage.setItem('eso-language','bs'));await page.reload();await nav.waitFor();
  for(const width of [320,390,799,800,801,802,1024,1300]){await page.setViewportSize({width,height:844});await nav.locator('.quick-tab').nth(4).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.waitForFunction(()=>{const el=document.querySelector('.quick-panel');return el&&getComputedStyle(el).opacity==='1'});const sizes=await nav.locator('.quick-tab').evaluateAll(tabs=>tabs.map(t=>({w:t.getBoundingClientRect().width,h:t.getBoundingClientRect().height})));assert.ok(sizes.every(s=>Math.abs(s.w-sizes[0].w)<1&&s.h===sizes[0].h));
if(width===390){for(const theme of ['light','dark']){await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);await page.screenshot({path:'work/quick-nav-'+theme+'.png'});const bg=await nav.evaluate(n=>getComputedStyle(n).backgroundColor);assert.equal(bg,theme==='light'?'rgb(255, 255, 255)':'rgb(7, 20, 38)');}}await page.keyboard.press('Escape');}
  await nav.locator('.quick-tab').nth(1).click();await page.setViewportSize({width:1301,height:950});await page.waitForFunction(()=>!document.querySelector('.quick-panel'));assert.equal(await nav.isVisible(),false);
 }
 console.log('PASS bottom navigation: '+role);await page.close();
}
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});




