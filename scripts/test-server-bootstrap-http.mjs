// Test-only: real Next instrumentation, registry and Prisma; no payment/DB transport.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync,existsSync,lstatSync,symlinkSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {request} from 'node:http';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {closeOwnedChild,childHasExited} from './caio-http-child-lifecycle.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const SLOT='lib/runtime/server-bootstrap-binding.ts';
const BOOTSTRAP='extensions/pack-bootstrap.ts';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function captureServerBootstrapSources(root,bootstrapSource) {
 const queue=['instrumentation.ts','lib/extensions/registry-contract.ts'],sources=new Map();
 if(bootstrapSource)queue.push(BOOTSTRAP);
 if(existsSync(path.join(root,'app/api/health/route.ts')))queue.push('app/api/health/route.ts');
 while(queue.length){
  const relative=queue.shift();if(sources.has(relative))continue;
  const leaf=path.join(root,relative),bytes=relative===BOOTSTRAP&&bootstrapSource?Buffer.from(bootstrapSource):readFileSync(leaf);
  if(!(relative===BOOTSTRAP&&bootstrapSource)){const s=lstatSync(leaf);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1,'bootstrap_fixture_source_regular_required');}
  assert.ok(bytes.length<=2*1024*1024&&sources.size<512,'bootstrap_fixture_source_bound');sources.set(relative,Buffer.from(bytes));
  const sf=ts.createSourceFile(relative,bytes.toString('utf8'),ts.ScriptTarget.Latest,true);
  const follow=specifier=>{
   if(!(specifier.startsWith('@/')||specifier.startsWith('.'))||specifier.startsWith('.prisma/'))return;
   const base=specifier.startsWith('@/')?path.join(root,specifier.slice(2)):path.resolve(root,path.dirname(relative),specifier);
   const absolute=[base,...['.ts','.tsx','.mjs','.js','.json'].map(e=>base+e),path.join(base,'index.ts')].find(f=>existsSync(f)&&lstatSync(f).isFile());
   assert.ok(absolute,'bootstrap_fixture_dependency_missing');const next=path.relative(root,absolute);
   assert.ok(!next.startsWith('..')&&!path.isAbsolute(next),'bootstrap_fixture_source_escape');queue.push(next);
  };
  function visit(n){
   if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier){assert.ok(ts.isStringLiteral(n.moduleSpecifier));follow(n.moduleSpecifier.text);}
   if(ts.isCallExpression(n)&&(n.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(n.expression)&&n.expression.text==='require')){
    if(n.arguments.length===1&&ts.isStringLiteral(n.arguments[0]))follow(n.arguments[0].text);
    else assert.ok(relative==='instrumentation.ts'&&n.getText(sf)==='import(packBootstrapPath)'&&bytes.toString().includes('const packBootstrapPath = ["@/extensions", "pack-bootstrap"].join("/");'),'bootstrap_fixture_dynamic_dependency_unknown');
   }
   ts.forEachChild(n,visit);
  }visit(sf);
 }return sources;
}
const REGISTRATION=String.raw`import "server-only";
import { registerPackContributions } from "@/lib/extensions/registry-contract";
if(process.env.HELM_RESERVED_BOOTSTRAP_OUTCOME==="import-refusal")throw new Error("reserved_import_refused");
export function registerAllPacks():void {
 registerPackContributions("reserved-bootstrap",{catalog:[{extensionKey:"reserved-bootstrap",kind:"REUSABLE_EXTENSION",nameZh:"Reserved",nameEn:"Reserved",descriptionZh:"Synthetic only",descriptionEn:"Synthetic only"}]});
 if(process.env.HELM_RESERVED_BOOTSTRAP_OUTCOME==="registration-refusal")throw new Error("reserved_contribution_refused");
}`;
const INITIALIZER=String.raw`
export const serverBootstrapVersion="helm.server-bootstrap/v1";
export const serverBootstrapMode="__MODE__";
export async function registerServerBootstrap():Promise<void> {
 const g=globalThis as typeof globalThis & {reservedServerBootstrapCalls?:number;reservedServerBootstrapReady?:boolean};
 g.reservedServerBootstrapCalls=(g.reservedServerBootstrapCalls??0)+1;
 if(process.env.HELM_RESERVED_BOOTSTRAP_OUTCOME==="reject")throw new Error("reserved_initializer_refused");
 if(process.env.HELM_RESERVED_BOOTSTRAP_OUTCOME==="pending")await new Promise(()=>{});
 await new Promise(r=>setTimeout(r,100));g.reservedServerBootstrapReady=true;
}
`;
function get(port,method='GET',pathname='/api/reserved-server-bootstrap') {
 assert.ok(['/api/reserved-server-bootstrap','/api/health','/'].includes(pathname),'bootstrap_fixture_path_invalid');
 assert.ok(Number.isInteger(port)&&port>0&&port<=65535,'bootstrap_fixture_port_invalid');
 return new Promise((resolve,reject)=>{
  const r=request({hostname:'127.0.0.1',port,path:pathname,method,agent:false,headers:{connection:'close'}},s=>{let body='';s.on('data',b=>{body+=b;if(body.length>4096)r.destroy(new Error('bootstrap_fixture_response_bound'));});s.on('error',reject);s.on('end',()=>{try{resolve({status:s.statusCode,body:JSON.parse(body)});}catch{if(s.statusCode!==200)resolve({status:s.statusCode,body:null});else if(pathname==='/')resolve({status:s.statusCode,body:null});else reject(new Error('bootstrap_fixture_response_invalid'));}});});
  r.on('error',reject);r.setTimeout(2000,()=>r.destroy(new Error('bootstrap_fixture_request_timeout')));r.end();
 });
}
function env(parent,extra={}) {
 return {PATH:process.env.PATH,HOME:parent,NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'production',DATABASE_URL:'mysql://127.0.0.1:1/helm_reserved_no_connection',LLM_ENABLED:'false',ENGINEERING_REVIEW_CRON_ENABLED:'false',LIGHT_CHAIN_FOLLOW_THROUGH_CRON_ENABLED:'false',SIGNAL_COLLECTION_SCHEDULER_ENABLED:'false',NODE_OPTIONS:'--require='+path.join(parent,'preload.cjs'),HELM_RESERVED_ROUTE_COUNTERS:path.join(parent,'counts.json'),...extra};
}
async function start(root,fixture,outcome,refused,observe) {
 const next=path.join(root,'node_modules/next/dist/bin/next');let text='',port,result,closed,evidence;
 const child=spawn(process.execPath,[next,'start','--hostname','127.0.0.1','--port','0'],{cwd:fixture,env:env(fixture,{HELM_RESERVED_BOOTSTRAP_OUTCOME:outcome,HELM_DEPLOYMENT_KEY:'caller-cannot-select-required',SERVER_BOOTSTRAP_MODE:'required'}),stdio:['ignore','pipe','pipe']});
 for(const s of [child.stdout,child.stderr])s.on('data',b=>{text+=b;if(text.length>1048576)child.kill('SIGTERM');});
 try {
  for(let i=0;i<500;i++){
   if(childHasExited(child))break;const m=/http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})/.exec(text);if(m)port=Number(m[1]);
   if(port)try{result=await get(port);if(!refused&&result.status===200||refused&&result.status!==200&&/server_bootstrap_refused/.test(text))break;}catch{}
   await new Promise(r=>setTimeout(r,25));
  }
  if(refused){assert.notEqual(result?.status,200,'required_refusal_must_not_serve');assert.match(text,/server_bootstrap_refused/);if(childHasExited(child))assert.equal(child.exitCode,1);else assert.equal(result?.status,500,'required_refusal_must_fail_http');}
  else {assert.equal(result?.status,200,'actual_next_readiness_missing');await observe(result,()=>get(port,'POST'));}
  const routeStatuses={readiness:result?.status??null};
  if(!childHasExited(child)){for(const name of ['/api/health','/']){const observed=await get(port,'GET',name);routeStatuses[name]=observed.status;assert.equal(observed.status,refused?500:200,'actual_public_route_startup_boundary');}if(refused)assert.equal((await get(port,'POST')).status,500,'required_reentry_must_stay_refused');}
  const counts=JSON.parse(readFileSync(path.join(fixture,'counts.json')));assert.equal(counts.connects,0);assert.equal(counts.queries,0);if(refused)assert.equal(counts.constructors,0);
  evidence={outcome,refused,httpStatus:result?.status??null,exitedBeforeCleanup:childHasExited(child),routeStatuses,counts};return evidence;
 }finally{closed=await closeOwnedChild(child);assert.equal(closed.closed,true,'bootstrap_fixture_cleanup_failed');if(evidence)evidence.cleanup=closed;}
}
export async function runServerBootstrapHttpProof({root=ROOT,modes=['legacy-optional','disabled','required'],bootstrapSource,slotSource,observe}={}) {
 const sources=captureServerBootstrapSources(root,bootstrapSource);assert.ok(sources.has('app/api/health/route.ts'),'actual_health_source_required');const parent=mkdtempSync(path.join(tmpdir(),'helm-server-bootstrap-'));let checks=0;const observations=[];
 try {
  for(const mode of modes){assert.ok(['legacy-optional','disabled','required'].includes(mode));const fixture=path.join(parent,mode);mkdirSync(fixture,{mode:0o700});
   for(const [p,b]of sources){mkdirSync(path.dirname(path.join(fixture,p)),{recursive:true});writeFileSync(path.join(fixture,p),b);}
   const original=readFileSync(path.join(fixture,'instrumentation.ts'),'utf8');assert.equal(original.split('import(packBootstrapPath)').length,2,'bootstrap_fixture_single_relocation_required');writeFileSync(path.join(fixture,'instrumentation.ts'),original.replace('import(packBootstrapPath)','import("@/extensions/pack-bootstrap")'));
   if(slotSource)writeFileSync(path.join(fixture,SLOT),slotSource);
   else {const slot=readFileSync(path.join(fixture,SLOT),'utf8');assert.equal(slot.split('mode: "legacy-optional"').length,2);writeFileSync(path.join(fixture,SLOT),slot.replace('mode: "legacy-optional"',`mode: "${mode}"`));}
   mkdirSync(path.join(fixture,'extensions'),{recursive:true});writeFileSync(path.join(fixture,BOOTSTRAP),bootstrapSource??REGISTRATION+(mode==='legacy-optional'?'':INITIALIZER.replace('__MODE__',mode)));
   mkdirSync(path.join(fixture,'app/api/reserved-server-bootstrap'),{recursive:true});writeFileSync(path.join(fixture,'app/layout.tsx'),'export default function Root({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>}\n');writeFileSync(path.join(fixture,'app/page.tsx'),'export default function Page(){return <p>Reserved server bootstrap</p>}\n');
   writeFileSync(path.join(fixture,'app/api/reserved-server-bootstrap/route.ts'),String.raw`import {getRegisteredCatalog} from "@/lib/extensions/registry-contract";import {register} from "@/instrumentation";
export const dynamic="force-dynamic";function read(){const g=globalThis as typeof globalThis & {reservedServerBootstrapReady?:boolean;reservedServerBootstrapCalls?:number};return Response.json({catalog:getRegisteredCatalog().map(x=>x.extensionKey),ready:g.reservedServerBootstrapReady===true,calls:g.reservedServerBootstrapCalls??0});}export function GET(){return read();}export async function POST(){await register();return read();}`);
   symlinkSync(path.join(root,'node_modules'),path.join(fixture,'node_modules'),'dir');const pkg=JSON.parse(readFileSync(path.join(root,'package.json')));writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'helm-reserved-bootstrap',private:true,dependencies:pkg.dependencies,devDependencies:pkg.devDependencies}));
   writeFileSync(path.join(fixture,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2020',lib:['dom','esnext'],strict:true,skipLibCheck:true,noEmit:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'preserve',baseUrl:'.',paths:{'@/*':['./*']}},include:['**/*.ts','**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']}));writeFileSync(path.join(fixture,'next.config.mjs'),'export default {experimental:{cpus:1}};\n');
   const helper=readFileSync(path.join(root,'scripts/test-caio-route-admission-http.mjs'),'utf8');const preload=/const PRELOAD = String\.raw`([\s\S]*?)`;/u.exec(helper);assert.ok(preload);writeFileSync(path.join(fixture,'preload.cjs'),preload[1]+"\nrequire('node:net').Socket.prototype.connect=function(){throw new Error('reserved_network_forbidden')};\n");
   const build=spawnSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:fixture,env:env(fixture),encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
   assert.equal(build.error,undefined);assert.equal(build.status,0,'actual_next_bootstrap_build_failed');
   for(const outcome of mode==='required'?['complete','registration-refusal','reject','pending']:mode==='legacy-optional'?['complete','registration-refusal','import-refusal']:['complete']){
    observations.push({mode,...await start(root,fixture,outcome,mode==='required'&&outcome!=='complete',async(r,repeat)=>{
     if(observe)await observe(r);
     else {assert.deepEqual(r.body.catalog,outcome==='import-refusal'?[]:['reserved-bootstrap']);assert.equal(r.body.ready,mode!=='legacy-optional');assert.equal(r.body.calls,mode==='legacy-optional'?0:1);const again=await repeat();assert.deepEqual(again,r,'register_reentry_must_not_duplicate_initialization');}checks++;
    })});if(mode==='required'&&outcome!=='complete')checks++;
   }
  }
  return {schema:'helm.server-bootstrap-http-proof/v1',checks,realNext:true,sourceFiles:sources.size,sourceDigest:sha(Buffer.from(JSON.stringify([...sources].map(([p,b])=>[p,sha(b)])))),observations,fixtureRemovedOnReturn:true,productionQualification:false};
 }finally{rmSync(parent,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await runServerBootstrapHttpProof()));}catch(error){console.error(error.message);process.exitCode=1;}
}
