// Run inside the bounded, network-none browser sandbox. Synthetic announcements only.
import { build } from 'esbuild';
import fs from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/pwdeps/node_modules/playwright');
await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{AnnList}from'../src/screens/Announcements.jsx';
const rows=[1,2,3,4].map(id=>({id,title:'Synthetic '+id,body:'Test',kind:'general',date:'2026-11-16',by:'Dummy'}));
function App(){const[ann,setAnn]=React.useState(rows);window.reduce=()=>setAnn(rows.slice(0,3));return React.createElement(AnnList,{ann,setAnn,filters:true,canPost:false})}createRoot(document.getElementById('root')).render(React.createElement(App));`,resolveDir:process.cwd()+'/tests',loader:'jsx'},bundle:true,format:'iife',outfile:'/scratch/announcement-filter.js',define:{'import.meta.env':'{}'},plugins:[{name:'synthetic-alerts',setup(b){b.onResolve({filter:/alerts\.js$/},()=>({path:'alerts',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const useAcks=()=>({});',loader:'js'}));}}],logLevel:'error'});
const server=http.createServer((req,res)=>{if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');res.end(fs.readFileSync('/scratch/announcement-filter.js'));}else res.end('<div id="root"></div><script src="/bundle.js"></script>');});
await new Promise(r=>server.listen(8080,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
try {
  const page=await browser.newPage();page.setDefaultTimeout(10000);
  await page.goto('http://127.0.0.1:8080');
  await page.getByRole('searchbox').fill('Synthetic 4');
  await page.evaluate(()=>window.reduce());
  await page.getByText('No announcements match',{exact:true}).waitFor();
  assert.equal(await page.getByRole('searchbox').count(),1);
  await page.getByRole('button',{name:'Clear',exact:true}).click();
  assert.equal(await page.locator('article').count(),3);
  console.log('PASS active announcement filter remains clearable after list shrinks below threshold');
} finally {await browser.close();await new Promise(r=>server.close(r));}
