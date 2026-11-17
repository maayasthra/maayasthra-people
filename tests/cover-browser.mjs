// Run only in the bounded network-none browser container. Real Supabase JS client and
// auth.js sign-in/out, actual Cover/coverDb, but synthetic loopback Auth/PostgREST.
import { build } from 'esbuild';
import fs from 'node:fs';
import http from 'node:http';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url), { chromium } = require('/pwdeps/node_modules/playwright');
const baseline = process.argv.includes('--expect-vulnerable');
const ids = { a: '00000000-0000-4000-8000-000000000001', b: '00000000-0000-4000-8000-000000000002' };
const jwt = key => [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: ids[key], role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url'), 'dummy'].join('.');
const tokenByKey = { a: jwt('a'), b: jwt('b') };
const tokens = { [tokenByKey.a]: 1, [tokenByKey.b]: 2 }, records = {}, calls = [];
let heldRead, holdRead = false;
const entry = `import React from 'react';import{createRoot}from'react-dom/client';import{Cover}from'../src/Cover.jsx';import{signIn,signOutAuth,supabase}from'../src/auth.js';import{saveCover}from'../src/coverDb.js';
window.pending=[];const NativeImage=Image;window.Image=function(){const im=new NativeImage();Object.defineProperty(im,'src',{configurable:true,set(value){window.pending.push(()=>{delete im.src;im.src=value;})}});return im};window.release=()=>window.pending.splice(0).forEach(f=>f());window.saveCover=saveCover;window.client=supabase;
function App(){const[who,setWho]=React.useState(null);window.login=async n=>{await signIn((n===1?'a':'b')+'@example.test','dummy-password');setWho(n)};window.switchAccount=async n=>{await signOutAuth();setWho(null);await window.login(n)};window.remount=()=>{setWho(null);setTimeout(()=>setWho(1),0)};return who?React.createElement(Cover,{key:who,user:{n:who}},'Dummy '+who):React.createElement('p',null,'Signed out')};createRoot(document.getElementById('root')).render(React.createElement(App));`;
await build({stdin:{contents:entry,resolveDir:process.cwd()+'/tests',loader:'jsx'},bundle:true,format:'iife',outfile:'/scratch/cover-test.js',define:{'import.meta.env':JSON.stringify({VITE_SUPABASE_URL:'http://127.0.0.1:8080',VITE_SUPABASE_ANON_KEY:'dummy-anon'})},logLevel:'error'});
const server=http.createServer(async(req,res)=>{
 const send=(body,status=200)=>{res.statusCode=status;res.setHeader('content-type','application/json');res.end(JSON.stringify(body));};
 if(req.url==='/bundle.js'){res.setHeader('content-type','text/javascript');return res.end(fs.readFileSync('/scratch/cover-test.js'));}
 if(req.url.startsWith('/auth/v1/token')){let raw='';for await(const c of req)raw+=c;const key=JSON.parse(raw).email[0];return send({access_token:tokenByKey[key],token_type:'bearer',expires_in:3600,refresh_token:'dummy-'+key,user:{id:ids[key],email:key+'@example.test',aud:'authenticated',role:'authenticated'}});}
 if(req.url.startsWith('/auth/v1/logout'))return send({});
 const actor=tokens[req.headers.authorization?.replace(/^Bearer /,'')];
 if(req.url.startsWith('/rest/v1/employee_covers')){const snapshot={image:records[actor]||''};if(holdRead){holdRead=false;heldRead=()=>send(snapshot);return;}return send(snapshot);}
 if(req.url.startsWith('/rest/v1/rpc/set_my_cover')){let raw='';for await(const c of req)raw+=c;const args=JSON.parse(raw);calls.push({actor,args});if(!baseline&&args.p_employee!==actor)return send({message:'Your account changed. Choose the picture again.'},400);records[actor]=args.p_image;return send(null);}
 res.setHeader('content-type','text/html');res.end('<html><div id="root"></div><script src="/bundle.js"></script></html>');
});
await new Promise(r=>server.listen(8080,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
try{
 const page=await browser.newPage();page.setDefaultTimeout(10000);await page.goto('http://127.0.0.1:8080');await page.waitForFunction(()=>window.login);await page.evaluate(()=>window.login(1));await page.getByText('Dummy 1',{exact:true}).waitFor();
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=2;c.height=2;c.getContext('2d').fillRect(0,0,2,2);return c.toDataURL('image/png').split(',')[1]});
 await page.locator('input[type=file]').setInputFiles({name:'dummy.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('.cv[aria-busy="true"]').waitFor();
 await page.evaluate(()=>window.switchAccount(2));await page.getByText('Dummy 2',{exact:true}).waitFor();await page.evaluate(()=>window.release());
 // Let the actual image decode and promise continuation finish, with bounded polling.
 await page.waitForFunction(()=>window.pending.length===0);await page.waitForTimeout(300);
 if(baseline){assert.equal(calls.length,1);assert.equal(calls[0].actor,2);assert.ok(records[2]);console.log('REPRO baseline: real Supabase client sends delayed A cover with B Authorization after auth.js sign-out/sign-in. Loopback synthetic Auth service, not full GoTrue/app shell.');}
 else{
  assert.equal(calls.length,0);assert.equal(records[2],undefined);
  console.log('PASS delayed cover decoding cancelled after auth.js sign-out/sign-in and component unmount; no RPC to B');
  const denial=await page.evaluate(async()=>{try{await window.saveCover(1,'data:image/png;base64,dummy');return '';}catch(e){return e.message;}});assert.match(denial,/account changed/);assert.equal(records[2],undefined);
  await page.evaluate(()=>window.switchAccount(1));await page.getByText('Dummy 1',{exact:true}).waitFor();
  await page.locator('input[type=file]').setInputFiles({name:'dummy.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('.cv[aria-busy="true"]').waitFor();await page.evaluate(()=>window.release());await page.locator('.cv[aria-busy="false"]').waitFor();assert.ok(records[1]);
  console.log('PASS same-account upload succeeds; real Supabase client sends expected employee ID; cross-session stale caller is rejected by fixture RPC');
  // Hold an old load, save a new image, then release the old response.
  holdRead=true;await page.evaluate(()=>window.remount());await page.getByText('Dummy 1',{exact:true}).waitFor();
  for(let i=0;!heldRead&&i<100;i++)await new Promise(r=>setTimeout(r,10));assert.ok(heldRead);
  await page.evaluate(()=>window.saveCover(1,'data:image/png;base64,new'));heldRead();heldRead=null;
  await page.waitForTimeout(200);assert.match(await page.locator('.cv').getAttribute('style'),/base64,new/);
  console.log('PASS late initial cover load cannot overwrite newly saved cover');
 }
}finally{if(heldRead)heldRead();await browser.close();await new Promise(r=>server.close(r));}
