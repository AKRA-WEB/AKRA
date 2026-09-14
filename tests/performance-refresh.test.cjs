const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const scripts = [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
scripts.forEach(s=>new vm.Script(s));
let config; const requests=[]; const listeners={};
const context=vm.createContext({console, Date, Promise, currentUser:'fixture', sessionToken:'session-a',
  localStorage:{getItem:()=>null,setItem(){},removeItem(){}},
  document:{hidden:false,addEventListener:(k,v)=>listeners[k]=v,removeEventListener:(k)=>delete listeners[k]},
  window:{}, Vue:{createApp(c){config=c;return {mount(){}};}},
  AppVersionGuard:{blockIfStale:async()=>false},
  fetch:(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}))});
vm.runInContext(scripts.find(s=>s.includes('createApp({')),context);
const app={...config.data()};for(const [k,v] of Object.entries(config.methods))app[k]=v.bind(app);
app.showAlert=()=>{};
function finish(index,products=[{id:1,name:'fixture',stock:1}],ok=true){requests[index].resolve({ok,status:ok?200:500,json:async()=>({success:ok,products,history:[],pickList:[]})});}
(async()=>{
 const first=app.loadData(true);const second=app.loadData(true);assert.equal(requests.length,1,'concurrent reads must share one fetch');
 finish(0);await Promise.all([first,second]);assert.equal(app.products[0].stock,1);
 app.activeTab='dashboard';app.lastDataLoadedAt=0;context.document.hidden=true;await app.refreshVisibleData();assert.equal(requests.length,1,'hidden tabs do not poll');
 context.document.hidden=false;const foreground=app.refreshVisibleData();assert.equal(requests.length,2);finish(1);await foreground;
 await app.refreshVisibleData();assert.equal(requests.length,2,'fresh foreground does not duplicate reads');
 const old=app.loadData(true);context.sessionToken='session-b';const fresh=app.loadData(true);assert.equal(requests.length,4);
 finish(3,[{id:1,name:'new',stock:9}]);await fresh;finish(2,[{id:1,name:'old',stock:2}]);await old;assert.equal(app.products[0].stock,9,'old session response ignored');
 const fail=app.loadData(true);requests[4].reject(new Error('fixture'));await fail;const retry=app.loadData(true);assert.equal(requests.length,6);finish(5);await retry;
 const beforeMutation=app.loadData(true);const mutation=app.apiCall({action:'transaction'});await new Promise(setImmediate);assert.equal(requests[7].options.method,'POST');
 await app.loadData(true);assert.equal(requests.length,8,'do not fetch while mutation is pending');
 finish(6,[{id:1,name:'old stock',stock:200}]);await beforeMutation;assert.equal(app.products[0].stock,1,'pre-mutation snapshot cannot overwrite stock');
 finish(7);await mutation;const afterMutation=app.loadData(true);assert.equal(requests.length,9,'post-mutation read must start fresh');finish(8,[{id:1,name:'updated',stock:3}]);await afterMutation;assert.equal(app.products[0].stock,3);
 const bad=app.loadData(true);finish(9,[{id:1,name:'denied',stock:100}],false);await bad;assert.equal(app.products[0].stock,3,'failed response never applied');
 console.log('PASS AKRA: parse, coalescing, visibility/freshness, session isolation, retry, mutation barrier, failed response');
})().catch(e=>{console.error(e);process.exitCode=1;});
