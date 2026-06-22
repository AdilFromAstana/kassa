const { chromium } = require('playwright');
const fs = require('fs');
const PORT = fs.readFileSync('/tmp/viteport','utf8').trim();
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const calls = [];
  page.on('response', r => { const u=r.url(); if(u.includes(':5080/api')) calls.push(r.request().method()+' '+u.split('/api')[1]+' → '+r.status()); });
  await page.goto('http://localhost:'+PORT, { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/tmp/shot-1-login.png' });
  // ввод PIN 1 1 1 1 по numpad
  for (let i=0;i<4;i++){ await page.locator('button').filter({ hasText: /^1$/ }).first().click(); await page.waitForTimeout(100); }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/shot-2-after-login.png' });
  const petrov = await page.getByText('Петров', { exact:false }).count();
  console.log('=== Петров виден после входа:', petrov>0);
  console.log('=== вызовы к бэку:'); console.log(calls.join('\n') || '(нет)');
  await browser.close();
})().catch(e=>{ console.error('ERR', e.message); process.exit(1); });
