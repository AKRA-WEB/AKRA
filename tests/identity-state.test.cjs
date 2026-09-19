// Actual W5 auth/cache/Vue methods, synthetic browser storage and intercepted fetch only.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
const oldOwner={id:'reused',name:'Original',identityId:'10000000-0000-4000-8000-000000000011',sessionVersion:1,authorizationRevision:'rev-one',roles:['ADMIN'],perms:{'app-akra':['manageProducts']}};
const newOwner={...oldOwner,identityId:'10000000-0000-4000-8000-000000000012'};
function fixture(){
    let config;const storage=new Map(),requests=[],events={},alerts=[];
    const window={location:{hostname:'fixture.invalid',search:'?sso=synthetic-token',pathname:'/AKRA/'},history:{replaceState(){window.location.search='';}},addEventListener:(name,fn)=>events[name]=fn,removeEventListener:name=>delete events[name],
        AkraModule:{embedded:false,isLocalPreview:()=>false,getToken:()=>'',authRequired(){},verifySession:async()=>({...oldOwner})}};
    const c=vm.createContext({window,URLSearchParams,Date,console,document:{title:'Fixture',hidden:false,addEventListener(){},removeEventListener(){}},
        localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
        alert:message=>alerts.push(message),setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
        fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve})),Vue:{createApp:value=>{config=value;return{mount(){}};}}});
    scripts.forEach(code=>vm.runInContext(code,c));
    c.AppVersionGuard.blockIfStale=async()=>false;
    const app={...config.data()};for(const [name,fn]of Object.entries(config.methods))app[name]=fn.bind(app);
    app.showAlert=(...args)=>alerts.push(args);
    return{c,app,config,storage,requests,events,alerts,window};
}
test('W5 verifies SSO and cached tokens with Main, blocks unfinished/rejected and superseded verification',async()=>{
    for(const source of ['sso','cached'])for(const outcome of ['denied','allowed','replaced']){
        const f=fixture();let finish,verifications=0;
        if(source==='cached'){f.window.location.search='';f.storage.set('akra_w5_session_token','synthetic-token');}
        f.c.decodeJwtPayload=()=>({...oldOwner});
        f.window.AkraModule.verifySession=(app,token)=>{verifications++;assert.equal(app,'app-w5');assert.equal(token,'synthetic-token');return new Promise((resolve,reject)=>finish=()=>outcome==='denied'?reject(Error('invalid_session')):resolve({...oldOwner}));};
        const pending=f.c.verifyAccess();await new Promise(setImmediate);
        assert.equal(f.c.appUser,null,'decoded identity must not authorize');assert.equal(verifications,1);assert.equal(f.requests.length,0);
        if(outcome==='replaced')f.storage.set('akra_w5_session_token','new-login');
        finish();assert.equal(await pending,outcome==='allowed');
        if(outcome==='allowed')assert.equal(f.c.appUser.identityId,oldOwner.identityId);
        if(outcome==='replaced')assert.equal(f.storage.get('akra_w5_session_token'),'new-login');
    }
});
test('W5 private cache and category preferences cannot cross replacement UUID or authorization revision',()=>{
    const f=fixture();f.c.appUser={...oldOwner};
    f.storage.set('AKRA_WMS_DATA',JSON.stringify({_ts:Date.now(),_d:'global-private'}));
    f.storage.set('AKRA_PRODUCT_CUSTOM_TAGS',JSON.stringify({1:'private-tag'}));
    assert.equal(f.c.getCache('AKRA_WMS_DATA',60000),null);
    f.c.setCache('AKRA_WMS_DATA','owner-one');assert.equal(f.c.getCache('AKRA_WMS_DATA',60000),'owner-one');
    f.app.loadCustomTags();assert.equal(f.app.customTags[1],undefined);
    f.app.setProductCustomTag(1,'chilled');
    f.c.appUser={...newOwner};assert.equal(f.c.getCache('AKRA_WMS_DATA',60000),null);
    f.app.loadCustomTags();assert.equal(f.app.customTags[1],undefined);
    f.c.appUser={...oldOwner,authorizationRevision:'rev-two'};assert.equal(f.c.getCache('AKRA_WMS_DATA',60000),null);
    f.app.loadCustomTags();assert.equal(f.app.customTags[1],'chilled','same owner preferences survive revision change');
    f.c.appUser=null;assert.equal(f.c.setCache('AKRA_WMS_DATA','unverified'),false);
});
test('W5 starts with private UI gated and does not send an unauthenticated mutation',async()=>{
    const f=fixture();assert.equal(f.app.isAuthorized,false);
    assert.equal(await f.app.apiCall({action:'transaction'}),false);assert.equal(f.requests.length,0);
});
test('W5 late mutation/search responses cannot confirm or display after owner replacement',async()=>{
    for(const mutation of [true,false]){
        const f=fixture();f.c.appUser={...oldOwner};f.c.sessionToken='original-token';f.app.isAuthorized=true;
        const pending=mutation?f.app.apiCall({action:'transaction'}):f.app.fetchMasterProducts('private');
        await new Promise(setImmediate);assert.equal(f.requests.length,1);
        f.c.appUser={...newOwner};f.c.sessionToken='new-token';
        f.requests[0].resolve({ok:true,status:200,json:async()=>({success:true,products:[{id:1,name:'old-owner-only'}]})});
        const result=await pending;
        if(mutation)assert.equal(result,false,'old success must not execute current-page optimistic stock updates');
        else assert.equal(f.app.masterSearchResults.length,0);
    }
});
test('W5 actual mounted storage handler hides private UI and late reads after cross-tab login',async()=>{
    const f=fixture();f.c.checkAppVersion=async()=>true;f.c.AppVersionGuard.start=()=>{};
    await f.config.mounted.call(f.app);
    assert.equal(f.app.isAuthorized,true);assert.equal(f.requests.length,1);
    f.app.products=[{id:1,name:'private'}];f.storage.set('akra_w5_session_token','new-login');
    f.events.storage({key:'akra_w5_session_token',oldValue:'synthetic-token',newValue:'new-login'});
    assert.equal(f.app.isAuthorized,false);assert.equal(f.app.products.length,0);assert.equal(f.c.sessionToken,null);
    assert.equal(f.storage.get('akra_w5_session_token'),'new-login','do not remove another tab login');
    f.requests[0].resolve({ok:true,status:200,json:async()=>({success:true,products:[{id:1,name:'old-owner'}]})});
    await f.app.dataLoadPromise;assert.equal(f.app.products.length,0);
    await f.app.loadData();assert.equal(f.requests.length,1);
    f.config.unmounted.call(f.app);assert.equal(f.events.storage,undefined);
});
test('W5 explicit demo stays local and does not submit stock mutations',async()=>{
    const f=fixture();f.window.location.search='';f.window.AkraModule.isLocalPreview=()=>true;
    assert.equal(await f.c.verifyAccess(),true);f.app.isAuthorized=true;
    await f.app.loadData();assert.ok(f.app.products.length>0);assert.equal(f.requests.length,0);
    assert.equal(await f.app.apiCall({action:'transaction'}),false);assert.equal(f.requests.length,0);
});
