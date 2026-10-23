// Isolated browser test: every API request is mocked; no real credentials/data.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_EXECUTABLE_PATH?{executablePath:process.env.BROWSER_EXECUTABLE_PATH}:{})});
 try{
  for(const [width,height] of [[1440,900],[768,900],[390,900],[320,568],[844,390]]){
   const page=await browser.newPage({viewport:{width,height},serviceWorkers:'block'});
   let pending=false,completed=false,saved=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;let data={},status=200;
    if(path==='/api/data'){
     if(!completed){status=401;data={error:'Unauthorized'}}else data={currentUser:{id:'u1',name:'Synthetic User',employeeId:'TEST',role:'Employee',department:'Test',active:true},users:[],reports:[],departments:[],locations:[],plants:[]};
    }else if(path==='/api/profile/password/setup'){
     if(route.request().method()==='GET')data={required:pending};
     else{const b=route.request().postDataJSON();assert.equal(b.newPassword,b.confirmPassword);saved++;pending=false;completed=true;data={ok:true}}
    }else if(path==='/api/login'){pending=true;data={passwordSetupRequired:true}}
    else if(path==='/api/notifications')data={notifications:[]};else if(path==='/api/voe')data={reports:[]};
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   });
   await page.goto(process.env.TEST_URL||'http://localhost:3250');
   await page.getByLabel('Employee ID',{exact:true}).fill('TEST');
   await page.getByLabel('Password',{exact:true}).fill('TEST');
   await page.getByRole('button',{name:'LOG IN',exact:true}).click();
   const dialog=page.getByRole('dialog');await dialog.waitFor();
   await page.keyboard.press('Escape');assert.ok(await dialog.isVisible());
   await page.reload();await page.getByRole('dialog').waitFor();
   await page.getByLabel('New Password',{exact:true}).fill('SyntheticNewPassword123');
   await page.getByLabel('Confirm New Password',{exact:true}).fill('DifferentPassword123');
   await page.getByRole('button',{name:'SAVE PASSWORD & CONTINUE'}).click();
   assert.equal(saved,0);await dialog.getByRole('alert').waitFor();
   await page.getByLabel('Confirm New Password',{exact:true}).fill('SyntheticNewPassword123');
   await dialog.getByRole('button',{name:'Show password',exact:true}).first().click();
   assert.equal(await page.getByLabel('New Password',{exact:true}).getAttribute('type'),'text');
   await dialog.getByRole('button',{name:'Hide password',exact:true}).click();
   assert.equal(await dialog.getByRole('button',{name:/Cancel|Skip|Close/}).count(),0);
   const layout=await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return{center:r.x+r.width/2,width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth}});
   assert.ok(Math.abs(layout.center-layout.width/2)<2);assert.equal(layout.overflow,false);
   fs.mkdirSync('test-results',{recursive:true});await page.screenshot({path:`test-results/password-setup-${width}.png`,fullPage:true});
   await page.getByRole('button',{name:'SAVE PASSWORD & CONTINUE'}).click();await page.locator('.app-shell').waitFor();assert.equal(saved,1);assert.deepEqual(errors,[]);
   console.log(`PASS password setup at ${width}px: mandatory, reload-safe, centered, matching passwords, visibility toggle, successful submit`);await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});


