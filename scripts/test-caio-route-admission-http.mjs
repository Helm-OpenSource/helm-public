// Test-only: real Next route over loopback, original transitive source, no DB connection.
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createHash} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, statSync, symlinkSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {closeOwnedChild, childHasExited} from './caio-http-child-lifecycle.mjs';

const ROUTE = 'app/api/runtime/caio/workbuddy/route.ts';
const SLOT = 'lib/caio-collaboration/runtime-binding.ts';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function captureRouteFixtureSources(root, routeBytes) {
  const queue = [ROUTE], sources = new Map();
  while (queue.length) {
    const relative = queue.shift();
    if (sources.has(relative)) continue;
    const bytes = relative === ROUTE && routeBytes ? routeBytes : readFileSync(path.join(root, relative));
    sources.set(relative, Buffer.from(bytes));
    const sf = ts.createSourceFile(relative, bytes.toString('utf8'), ts.ScriptTarget.Latest, true);
    function follow(specifier) {
      if (!(specifier.startsWith('@/') || specifier.startsWith('.'))) return;
      // Generated Prisma is an installed external dependency, not a source path.
      if (specifier.startsWith('.prisma/')) return;
      const base = specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) : path.resolve(root, path.dirname(relative), specifier);
      const absolute = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, path.join(base, 'index.ts')]
        .find(file => existsSync(file) && statSync(file).isFile());
      assert.ok(absolute, 'route_fixture_source_dependency_missing');
      const next = path.relative(root, absolute);
      assert.ok(!next.startsWith('..') && !path.isAbsolute(next), 'route_fixture_source_escape');
      queue.push(next);
    }
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
        // Include type-only dependencies as part of the actual Next typecheck.
        assert.ok(ts.isStringLiteral(node.moduleSpecifier)); follow(node.moduleSpecifier.text);
      }
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === 'require')) {
        assert.ok(node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]), 'route_fixture_dynamic_dependency_unknown');
        follow(node.arguments[0].text);
      }
      ts.forEachChild(node, visit);
    }
    visit(sf);
  }
  return sources;
}

// Observe the actual generated Prisma constructor. Connect/query attempts are
// counted and blocked; this fixture never opens a DB socket or mocks the route.
const PRELOAD = String.raw`
const Module = require('node:module'); const fs = require('node:fs');
const load = Module._load; const wrapped = new WeakMap();
const counts = {prismaLoads:0, constructors:0, connects:0, queries:0};
const file = process.env.HELM_RESERVED_ROUTE_COUNTERS;
const save = () => fs.writeFileSync(file, JSON.stringify(counts)); save();
function wrap(original) {
 if (!wrapped.has(original)) wrapped.set(original, new Proxy(original, {construct(target,args) {
  counts.constructors++; save(); const client = Reflect.construct(target,args,target);
  return new Proxy(client, {get(object,key) {
   const field=Reflect.get(object,key,object);
   if (key === '$connect') return () => { counts.connects++; save(); throw new Error('reserved_db_connect_forbidden'); };
   if (['_request','$queryRaw','$queryRawUnsafe','$executeRaw','$executeRawUnsafe','$transaction'].includes(key)) return () => { counts.queries++; save(); throw new Error('reserved_db_query_forbidden'); };
   return typeof field === 'function' ? field.bind(object) : field;
  }});
 }}));
 return wrapped.get(original);
}
Module._load = function(request, parent, main) {
 const value = load.call(this, request, parent, main);
 if (request.includes('@prisma/client/runtime') && typeof value?.getPrismaClient === 'function') {
  counts.prismaLoads++; save();
  return {...value,getPrismaClient(...args) {return wrap(value.getPrismaClient(...args));}};
 }
 if (request.includes('.prisma/client') && typeof value?.PrismaClient === 'function') {
  counts.prismaLoads++; save(); return {...value,PrismaClient:wrap(value.PrismaClient)};
 }
 return value;
};
`;
function cleanEnvironment(root, extra = {}) {
  return {...Object.fromEntries(['PATH','HOME','TMPDIR','SYSTEMROOT'].filter(k => process.env[k]).map(k => [k,process.env[k]])),
    NEXT_TELEMETRY_DISABLED:'1', NODE_ENV:'production',
    DATABASE_URL:'mysql://127.0.0.1:1/helm_reserved_route_no_connection',
    LLM_ENABLED:'false', SIGNAL_COLLECTION_SCHEDULER_ENABLED:'false',
    ENGINEERING_REVIEW_CRON_ENABLED:'false', LIGHT_CHAIN_FOLLOW_THROUGH_CRON_ENABLED:'false',
    ...extra};
}
// This test transport can only reach the exact owned IPv4 loopback listener.
// It does not resolve external hosts or follow redirects.
export async function loopbackRequest(base, route, options = {}) {
  const parsed = new URL(base);
  const port = Number(parsed.port);
  assert.ok(parsed.protocol === 'http:' && parsed.hostname === '127.0.0.1' &&
    parsed.pathname === '/' && !parsed.search && !parsed.hash && !parsed.username && !parsed.password &&
    /^[1-9][0-9]{0,4}$/.test(parsed.port) && Number.isInteger(port) && port <= 65535,
    'owned_loopback_endpoint_required');
  assert.ok(route === '/' || route === '/api/runtime/caio/workbuddy', 'owned_loopback_path_required');
  assert.ok(options.method === undefined || options.method === 'POST', 'owned_loopback_method_required');
  return new Promise((resolve, reject) => {
    const request = httpRequest({hostname:'127.0.0.1', port, path:route,
      method:options.method ?? 'GET', agent:false, headers:{connection:'close'}}, response => {
      const chunks=[]; let bytes=0;
      response.on('data', chunk => {
        bytes+=chunk.length;
        if(bytes>2*1024*1024) request.destroy(new Error('owned_loopback_response_limit'));
        else chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        const text=Buffer.concat(chunks).toString('utf8');
        resolve({status:response.statusCode, json:async()=>JSON.parse(text)});
      });
    });
    request.on('error', reject);
    request.setTimeout(2000, () => request.destroy(new Error('owned_loopback_request_timeout')));
    request.end(options.body);
  });
}
async function ready(child, base) {
  for (let count=0;count<200;count++) {
    assert.ok(!childHasExited(child), 'owned_next_exited_before_ready');
    try { const r = await loopbackRequest(base, '/'); if(r.status===200) return; } catch {}
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw new Error('owned_next_readiness_timeout');
}
async function withServer(root, fixture, configured, callback) {
  const counter=path.join(fixture,'counter.json');
  const child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','0'], {
    cwd:fixture, env:cleanEnvironment(root,{NODE_OPTIONS:`--require=${path.join(fixture,'preload.cjs')}`,HELM_RESERVED_ROUTE_COUNTERS:counter,
      CAIO_WORKBUDDY_EDGE_SHARED_SECRET:configured?'s'.repeat(48):'', CAIO_WORKBUDDY_EDGE_WORKSPACE_SYSTEM_KEY:configured?'reserved_workspace':'',
      HELM_RUNTIME_DEPLOYMENT_ID:'caller-env-does-not-select-binding', HELM_DEPLOYMENT_KEY:'caller-claimed'}), stdio:['ignore','pipe','pipe'],
  });
  let output='',base;
  child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/http:\/\/127\.0\.0\.1:(\d+)/);if(match)base=`http://127.0.0.1:${match[1]}`;});
  child.stderr.resume();
  try {
    for(let i=0;i<200&&!base;i++){assert.ok(!childHasExited(child),'owned_next_start_failed');await new Promise(r=>setTimeout(r,50));}
    assert.ok(base,'owned_next_port_missing');await ready(child,base);
    await callback(base,()=>JSON.parse(readFileSync(counter,'utf8')));
  } finally { assert.equal((await closeOwnedChild(child)).closed,true,'owned_next_cleanup_failed'); }
}
export async function runRouteHttpProof({root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'), baselineRouteBytes}={}) {
  const sources=captureRouteFixtureSources(root,baselineRouteBytes);
  const parent=mkdtempSync(path.join(tmpdir(),'helm-route-admission-'));let checks=0;
  try {
    for(const mode of baselineRouteBytes?['baseline']:['legacy-configured','disabled','unknown']) {
      const fixture=path.join(parent,mode);mkdirSync(fixture,{mode:0o700});
      for(const [relative,bytes] of sources){const dest=path.join(fixture,relative);mkdirSync(path.dirname(dest),{recursive:true});writeFileSync(dest,bytes);}
      if(mode==='disabled'||mode==='unknown') {
        const original=sources.get(SLOT).toString('utf8');assert.ok(original.includes('mode: "legacy-configured"'));
        writeFileSync(path.join(fixture,SLOT),original.replace('mode: "legacy-configured"',`mode: "${mode==='disabled'?'disabled':'unknown'}"`).replace(mode==='unknown'?': WorkBuddyRouteBinding =':'not-present',': unknown ='));
      }
      mkdirSync(path.join(fixture,'app'),{recursive:true});
      writeFileSync(path.join(fixture,'app/layout.tsx'),'export default function Root({children}: {children: React.ReactNode}) {return <html><body>{children}</body></html>}\n');
      writeFileSync(path.join(fixture,'app/page.tsx'),'export default function Home(){return <p>Reserved route fixture</p>}\n');
      // The root dependency installation is owned by this test worktree and
      // already lock-pinned; never resolve modules from a sibling project.
      symlinkSync(path.join(root,'node_modules'),path.join(fixture,'node_modules'),'dir');
      const pkg=JSON.parse(readFileSync(path.join(root,'package.json')));
      writeFileSync(path.join(fixture,'package.json'),JSON.stringify({name:'helm-reserved-route-fixture',private:true,dependencies:pkg.dependencies,devDependencies:pkg.devDependencies}));
      writeFileSync(path.join(fixture,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2017',lib:['dom','dom.iterable','esnext'],skipLibCheck:true,strict:true,noEmit:true,module:'esnext',moduleResolution:'bundler',jsx:'preserve',esModuleInterop:true,resolveJsonModule:true,baseUrl:'.',paths:{'@/*':['./*']}},include:['**/*.ts','**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']}));
      writeFileSync(path.join(fixture,'next.config.mjs'),'export default {experimental:{cpus:1}, typescript:{ignoreBuildErrors:false}};\n');
      writeFileSync(path.join(fixture,'preload.cjs'),PRELOAD);
      const build=spawnSync(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'build','--webpack'],{cwd:fixture,env:cleanEnvironment(root),encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
      if(build.status!==0) { process.stderr.write(build.stdout??'');process.stderr.write(build.stderr??''); }
      assert.equal(build.status,0,'actual_next_fixture_build_failed');
      if(mode==='baseline'||mode==='legacy-configured') {
        await withServer(root,fixture,false,async(base,counts)=>{
          const response=await loopbackRequest(base, '/api/runtime/caio/workbuddy', {method:'POST',body:'not-json'});
          assert.equal(response.status,503);assert.equal(counts().constructors,0);assert.equal(counts().prismaLoads,0);checks++;
        });
      }
      if(mode==='legacy-configured') await withServer(root,fixture,true,async(base,counts)=>{
        assert.equal((await loopbackRequest(base, '/api/runtime/caio/workbuddy')).status,405);
        assert.equal((await loopbackRequest(base, '/api/runtime/caio/workbuddy', {method:'POST',body:'not-json'})).status,400);
        assert.equal(counts().constructors,0);
        assert.equal((await loopbackRequest(base, '/api/runtime/caio/workbuddy', {method:'POST',body:'x'.repeat(1048577)})).status,413);
        assert.equal(counts().constructors,0);
        assert.equal((await loopbackRequest(base, '/api/runtime/caio/workbuddy', {method:'POST',body:'{}'})).status,401);
        assert.ok(counts().constructors>=1,'actual_prisma_positive_control_missing');
        assert.equal(counts().connects,0);assert.equal(counts().queries,0);checks+=5;
      });
      if(mode==='disabled'||mode==='unknown') await withServer(root,fixture,true,async(base,counts)=>{
        const response=await loopbackRequest(base, '/api/runtime/caio/workbuddy', {method:'POST',body:'not-json'});
        assert.equal(response.status,503);assert.deepEqual(await response.json(),{ok:false,error:'workbuddy_edge_not_configured'});
        assert.deepEqual(counts(),{prismaLoads:0,constructors:0,connects:0,queries:0});
        assert.equal((await loopbackRequest(base, '/api/runtime/caio/workbuddy')).status,405);checks+=2;
      });
    }
    const result={checks,sourceFiles:sources.size,sourceDigest:hash(Buffer.from(JSON.stringify([...sources].map(([p,b])=>[p,hash(b)])))),
      realNext:true,actualPrismaPositiveControl:!baselineRouteBytes,databaseConnections:0,productionQualification:false};
    return result;
  } finally {rmSync(parent,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {console.log(JSON.stringify(await runRouteHttpProof()));} catch(error) {console.error(error.message);process.exitCode=1;}
}
