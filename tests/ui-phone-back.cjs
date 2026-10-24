const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
const {dictionaries,translateMessage}=require('../lib/ui-language.ts');
(async()=>{const b=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH});try{const p=await b.newPage({viewport:{width:390,height:900},serviceWorkers:'block'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
const u={id:'u1',name:'Test Admin',employeeId:'100',department:'Operations',role:'Super Admin',active:true,annualTarget:12,plantId:'p1',plantName:'Test Plant',companyId:'c1'};
const report={id:'r1',revision:1,esoNo:'ESO-TEST-001',reporterId:'u1',reporterName:'Test Admin',createdAt:'2026-10-23T12:00:00Z',locationId:'l1',location:'Test Location',plantId:'p1',plantName:'Test Plant',category:'Environmental',urgency:'High',description:'Open',status:'Open'};
await p.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;let data={};if(path==='/api/data')data={currentUser:u,users:[u],reports:[report],locations:[{id:'l1',name:'Test Location',plantId:'p1',active:true}],departments:[{id:'d1',name:'Operations',plantId:'p1',active:true}],plants:[{id:'p1',name:'Test Plant',code:'TEST',active:true}],corporatePlants:[]};else if(path==='/api/reports/page')data={reports:[report],total:1,page:1,pageSize:50};else if(path==='/api/reports/detail')data={report:{id:'r1',revision:1,plant_id:'p1',location_id:'l1',category:'environmental',urgency:'high',description:'Open',status:'open'},task:null,additionalLocations:[],photos:[],audit:[],legacyHistory:[],permissions:{edit:true,take:true,complete:true}};else if(path==='/api/reports/history')data={reports:[report]};else if(path==='/api/voe')data={reports:[{id:'v1',reporterId:'u1',reporterName:'Test Admin',category:'other',description:'Open',status:'New',createdAt:'2026-10-23T12:00:00Z'}]};else if(path==='/api/notifications')data={notifications:[]};return r.fulfill({contentType:'application/json',body:JSON.stringify(data)})});
await p.goto(process.env.TEST_URL||'http://localhost:3250');await p.locator('.app-shell').waitFor();
await p.locator('.pwa-install-close').click();
const back=async()=>{await p.evaluate(()=>history.back());await p.waitForTimeout(200)};
await p.locator('.quick-report').click();assert.equal(await p.locator('.eso-report-form').count(),1);await back();assert.equal(await p.locator('.dashboard-summary-grid').count(),1);
await p.locator('.quick-tabs button').nth(1).click();await back();assert.equal(await p.locator('.quick-panel').count(),0);
await p.locator('.mobile-menu').click();await back();assert.equal(await p.locator('.sidebar.open').count(),0);
await p.locator('.reports-table tbody .outline-small').first().click();await p.locator('.modal-backdrop').waitFor();await back();assert.equal(await p.locator('.modal-backdrop').count(),0);
for(let i=0;i<3;i++)await back();assert.equal(await p.locator('.dashboard-summary-grid').count(),1);assert.ok(p.url().startsWith(process.env.TEST_URL||'http://localhost:3250'));assert.deepEqual(errors,[]);
console.log('PASS phone Back: previous page, dropdown, sidebar, report dialog, repeated home Back stays in app');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});

