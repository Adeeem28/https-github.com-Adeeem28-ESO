// Run against a local preview; every API call is mocked. No live data is read/written.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
async function main(){
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const user={id:'u1',name:'Test Manager',employeeId:'100',department:'Operations',role:'Management',annualTarget:12,active:true,plantId:'p1',plantName:'Plant A',companyId:'c1'};
 const locations=[{id:'l1',name:'Warehouse',plantId:'p1',plantName:'Plant A',active:true},{id:'l2',name:'Loading bay',plantId:'p1',plantName:'Plant A',active:true},{id:'l3',name:'Other plant',plantId:'p2',active:true}];
 let report={id:'r1',revision:1,esoNo:'ESO-TEST-001',reporterId:'u1',createdAt:new Date().toISOString(),locationId:'l1',location:'Warehouse',plantId:'p1',plantName:'Plant A',category:'Environmental',urgency:'High',description:'Repair the extinguisher in warehouse',status:'Open'};
 let detail={report:{id:'r1',revision:1,plant_id:'p1',location_id:'l1',category:'environmental',urgency:'high',description:report.description,status:'open'},task:null,additionalLocations:[],photos:[],audit:[],legacyHistory:[],nextBefore:null,permissions:{edit:true,take:true,complete:true,editCompletion:false}};
 const mutations=[];
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url());let data={};
  if(req.method()!=='GET'){
   const body=req.postData()||'';mutations.push({url:url.pathname,body});
   if(url.pathname==='/api/reports'){
    report={...report,revision:2,description:'Updated warehouse extinguisher'};
    detail={...detail,report:{...detail.report,revision:2,description:report.description},additionalLocations:[{location_id:'l2',locations:{name:'Loading bay'}}],audit:[{id:1,actor_id:'u1',employees:{first_name:'Test',last_name:'Manager'},action:'edit',created_at:new Date().toISOString(),old_values:{report:{description:'Repair the extinguisher in warehouse'}},new_values:{report:{description:report.description}}}]};
   }else if(url.pathname==='/api/maintenance'){
    report={...report,revision:3,status:'Completed',correctiveAction:'Replaced and verified',resolvedBy:'u1',resolvedByName:user.name};
    detail={...detail,report:{...detail.report,revision:3,status:'completed'},task:{assigned_to:'u1',completed_by:'u1',completion_note:'Replaced and verified'},permissions:{edit:true,take:false,complete:false,editCompletion:true}};
   }data={ok:true};
  }else if(url.pathname==='/api/data')data={currentUser:user,users:[user],reports:[report],locations,departments:[],plants:[],corporatePlants:[]};
  else if(url.pathname==='/api/reports/detail')data=detail;
  else if(url.pathname==='/api/notifications')data={notifications:[]};
  else if(url.pathname==='/api/voe')data={reports:[]};
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(process.env.TEST_URL||'http://localhost:3210');
 await page.locator('.stat-card.orange').click();
 await page.locator('.kpi-modal').getByRole('button',{name:'OPEN',exact:true}).click();
 await page.getByRole('button',{name:'EDIT ESO',exact:true}).click();
 await page.getByLabel('Description',{exact:true}).fill('Updated warehouse extinguisher');
 await page.getByLabel('Loading bay',{exact:true}).check();
 assert.equal(await page.getByLabel('Other plant',{exact:true}).count(),0);
 assert.equal(await page.getByLabel('Category',{exact:true}).inputValue(),'environmental');
 await page.getByRole('button',{name:'SAVE CHANGES',exact:true}).click();
 await page.getByRole('button',{name:'TAKE & RESOLVE',exact:true}).waitFor();
 assert.equal(await page.locator('.kpi-modal').count(),1,'parent KPI stays mounted after save');
 assert.ok(mutations[0].body.includes('environmental'),'canonical category sent');
 assert.ok(mutations[0].body.includes('l2'),'additional location sent');
 await page.getByRole('button',{name:'TAKE & RESOLVE',exact:true}).click();
 await page.getByLabel('Corrective action',{exact:true}).fill('Replaced and verified');
 const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN9sAAAAASUVORK5CYII=','base64');
 await page.locator('input[type=file][multiple]').setInputFiles([{name:'after-1.png',mimeType:'image/png',buffer:pixel},{name:'after-2.png',mimeType:'image/png',buffer:pixel}]);
 await page.getByRole('button',{name:'COMPLETE ESO',exact:true}).click();
 await page.getByRole('button',{name:'EDIT COMPLETION',exact:true}).waitFor();
 assert.ok(mutations[1].body.includes('after-1.png')&&mutations[1].body.includes('after-2.png'),'multiple after photos sent');
 await page.locator('.modal-backdrop').filter({has:page.locator('.eso-workspace')}).locator('.modal-head > button').first().click();
 assert.equal(await page.locator('.kpi-modal').count(),1,'closing detail returns to KPI');
 await page.locator('.kpi-modal .modal-head > button').click();
 await page.locator('.nav-btn').filter({hasText:'Report ESO'}).click();
 await page.getByLabel('Description',{exact:true}).fill('New issue with several photos');
 await page.locator('input[type=file][multiple]').setInputFiles([{name:'before-1.png',mimeType:'image/png',buffer:pixel},{name:'before-2.png',mimeType:'image/png',buffer:pixel}]);
 assert.equal(await page.locator('.eso-photo-grid img').count(),2);
 fs.mkdirSync('test-results',{recursive:true});
 await page.screenshot({path:'test-results/desktop-report.png',fullPage:true});
 await page.setViewportSize({width:390,height:844}); await page.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=0);
 await page.screenshot({path:'test-results/mobile-report.png',fullPage:true});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'mobile has no horizontal overflow');
 assert.deepEqual(errors,[],'no browser runtime errors');
 console.log('PASS: nested KPI navigation, edit canonical values, additional locations, self-resolve, multi-photo payload, desktop/mobile layout, no browser errors.');
 await browser.close();
}
main().catch(e=>{console.error(e);process.exit(1);});




