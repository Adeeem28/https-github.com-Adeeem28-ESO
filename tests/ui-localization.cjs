const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
const {dictionaries,translateMessage}=require('../lib/ui-language.ts');
(async()=>{const b=await chromium.launch({executablePath:process.env.BROWSER_EXECUTABLE_PATH});try{const p=await b.newPage({viewport:{width:1440,height:1000},serviceWorkers:'block'});const errors=[];p.on('pageerror',e=>errors.push(e.message));
const u={id:'u1',name:'Test Admin',employeeId:'100',department:'Operations',role:'Super Admin',active:true,annualTarget:12,plantId:'p1',plantName:'Test Plant',companyId:'c1'};
const report={id:'r1',revision:1,esoNo:'ESO-TEST-001',reporterId:'u1',reporterName:'Test Admin',createdAt:'2026-10-23T12:00:00Z',locationId:'l1',location:'Test Location',plantId:'p1',plantName:'Test Plant',category:'Environmental',urgency:'High',description:'Open',status:'Open'};
await p.route('**/api/**',r=>{const path=new URL(r.request().url()).pathname;let data={};if(path==='/api/data')data={currentUser:u,users:[u],reports:[report],locations:[{id:'l1',name:'Test Location',plantId:'p1',active:true}],departments:[{id:'d1',name:'Operations',plantId:'p1',active:true}],plants:[{id:'p1',name:'Test Plant',code:'TEST',active:true}],corporatePlants:[]};else if(path==='/api/reports/page')data={reports:[report],total:1,page:1,pageSize:50};else if(path==='/api/reports/detail')data={report:{id:'r1',revision:1,plant_id:'p1',location_id:'l1',category:'environmental',urgency:'high',description:'Open',status:'open'},task:null,additionalLocations:[],photos:[],audit:[],legacyHistory:[],permissions:{edit:true,take:true,complete:true}};else if(path==='/api/reports/history')data={reports:[report]};else if(path==='/api/voe')data={reports:[{id:'v1',reporterId:'u1',reporterName:'Test Admin',category:'other',description:'Open',status:'New',createdAt:'2026-10-23T12:00:00Z'}]};else if(path==='/api/notifications')data={notifications:[]};return r.fulfill({contentType:'application/json',body:JSON.stringify(data)})});
await p.goto('http://localhost:3250');await p.locator('.app-shell').waitFor();
// Dismiss the install offer through its UI before testing underlying pages.
// Its login/post-login lifecycle is covered by ui-pwa-install.cjs.
await p.locator('.pwa-install-close').click();
await p.locator('.pwa-install-offer').waitFor({state:'hidden'});
const pages=['dashboard','report','my-history','maintenance','all-reports','exports','hunt','voe-submit','voe-history','voe-all','plants','employees','departments','locations'];
for(const lang of ['bs','de','es','en']){
 await p.evaluate(lang=>{localStorage.setItem('eso-language',lang);window.dispatchEvent(new CustomEvent('eso-language-change',{detail:{choice:lang,resolved:lang}}))},lang);
 for(let i=0;i<pages.length;i++){
  await p.locator('.sidebar .nav-btn').nth(i).click();await p.waitForTimeout(70);
  const text=await p.locator('.content').innerText();const leaked=Object.entries(dictionaries[lang]).filter(([key,value])=>key!==value&&key.length>8&&text.split('\n').map(t=>t.trim()).includes(key));assert.deepEqual(leaked,[],lang+' '+pages[i]+' untranslated UI');
  if(pages[i]==='voe-all')assert.equal(await p.locator('.voe-description').innerText(),'Open','user content preserved');
  if(pages[i]==='report'){assert.equal(await p.locator('select').filter({has:p.locator('option[value="environmental"]')}).count(),1);}
 }
 await p.locator('.sidebar .nav-btn').nth(0).click();await p.locator('.reports-table tbody button').first().click();await p.locator('.eso-workspace').waitFor();
await p.getByRole('button',{name:translateMessage('EDIT ESO',lang),exact:true}).click();await p.locator('.eso-edit-form').waitFor();
assert.equal(await p.locator('.eso-edit-form textarea').first().inputValue(),'Open');
assert.equal(await p.locator('.eso-edit-form select').filter({has:p.locator('option[value="environmental"]')}).inputValue(),'environmental','translated category keeps canonical value');
const dialogText=await p.locator('.modal').last().innerText();assert.ok(dialogText.includes(translateMessage('Changes are recorded in the audit history.',lang)));
await p.locator('.modal-head>button').last().click();
for(const index of [1,7,11]){
 await p.setViewportSize({width:1440,height:1000});await p.locator('.sidebar .nav-btn').nth(index).click();await p.waitForTimeout(70);
 await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>document.querySelector('.sidebar').getBoundingClientRect().right<=0);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile overflow '+lang+' '+pages[index]);
 if(index===7&&lang!=='en')await p.screenshot({path:'test-results/localization-'+lang+'-mobile.png',fullPage:true});
}
await p.setViewportSize({width:1440,height:1000});
console.log('PASS 14 application pages and mobile layouts: '+lang);
}
// React-like updates to existing nodes and attributes must refresh their source.
await p.evaluate(()=>{const e=document.createElement('div');e.id='translation-probe';e.innerHTML='<span>Loading…</span><input placeholder="Search ESO…"><p data-no-translate>Open</p><div data-no-translate data-label="Location">Open</div>';document.body.append(e)});
for(const lang of ['bs','de','es','en']){
 await p.evaluate(lang=>window.dispatchEvent(new CustomEvent('eso-language-change',{detail:{choice:lang,resolved:lang}})),lang);
 assert.equal(await p.locator('#translation-probe>span').innerText(),translateMessage('Loading…',lang));
 assert.equal(await p.locator('#translation-probe input').getAttribute('placeholder'),translateMessage('Search ESO…',lang));assert.equal(await p.locator('#translation-probe div').getAttribute('data-label'),translateMessage('Location',lang));
}
await p.evaluate(()=>{window.dispatchEvent(new CustomEvent('eso-language-change',{detail:{choice:'de',resolved:'de'}}));document.querySelector('#translation-probe>span').firstChild.data='Saving…';document.querySelector('#translation-probe input').setAttribute('placeholder','Search Voice of Employee…')});
await p.waitForFunction(()=>document.querySelector('#translation-probe>span').textContent==='Wird gespeichert…');
assert.equal(await p.locator('#translation-probe input').getAttribute('placeholder'),translateMessage('Search Voice of Employee…','de'));
await p.evaluate(()=>window.dispatchEvent(new CustomEvent('eso-language-change',{detail:{choice:'en',resolved:'en'}})));
assert.equal(await p.locator('#translation-probe>span').innerText(),'Saving…');assert.equal(await p.locator('#translation-probe p').innerText(),'Open');
for(const route of ['/register','/owner'])for(const lang of ['bs','de','es','en']){
 await p.evaluate(lang=>localStorage.setItem('eso-language',lang),lang);await p.goto('http://localhost:3250'+route);await p.waitForFunction(lang=>document.documentElement.lang===lang,lang);
 await p.locator('h1').waitFor();const text=await p.locator('body').innerText();const leaked=Object.entries(dictionaries[lang]).filter(([key,value])=>key!==value&&key.length>8&&text.split('\n').map(t=>t.trim()).includes(key));assert.deepEqual(leaked,[],route+' '+lang);
 await p.setViewportSize({width:390,height:844});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' overflow '+lang);await p.setViewportSize({width:1440,height:1000});
}
assert.deepEqual(errors,[]);console.log('PASS live text/attribute updates, language round trip and user content protection');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});

