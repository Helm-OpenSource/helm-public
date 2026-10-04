import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {captureRouteFixtureSources, loopbackRequest} from './test-caio-route-admission-http.mjs';
function fixture(run) {
 const parent=mkdtempSync(path.join(tmpdir(),'helm-route-graph-')); const root=path.join(parent,'root'); mkdirSync(root);
 const put=(p,text)=>{mkdirSync(path.dirname(path.join(root,p)),{recursive:true});writeFileSync(path.join(root,p),text);};
 try{return run(root,put);}finally{rmSync(parent,{recursive:true,force:true});}
}
test('the Next fixture copies both type dependencies and actual dynamic imports',()=>fixture((root,put)=>{
 put('app/api/runtime/caio/workbuddy/route.ts','import type {T} from "@/lib/types"; export async function POST(){return import("@/lib/runtime");}');
 put('lib/types.ts','export type T = string;');put('lib/runtime.ts','export const value = 1;');
 assert.deepEqual([...captureRouteFixtureSources(root).keys()].sort(),['app/api/runtime/caio/workbuddy/route.ts','lib/runtime.ts','lib/types.ts']);
}));
test('a nonliteral execution dependency is refused instead of silently omitted',()=>fixture((root,put)=>{
 put('app/api/runtime/caio/workbuddy/route.ts','export async function POST(name){return import(name);}');
 assert.throws(()=>captureRouteFixtureSources(root),/route_fixture_dynamic_dependency_unknown/);
}));
test('a missing source dependency is refused',()=>fixture((root,put)=>{
 put('app/api/runtime/caio/workbuddy/route.ts','import "@/lib/missing";');
 assert.throws(()=>captureRouteFixtureSources(root),/route_fixture_source_dependency_missing/);
}));
test('the fixture source graph refuses paths outside its explicit root',()=>fixture((root,put)=>{
 put('app/api/runtime/caio/workbuddy/route.ts','import "../../../../../../outside";');
 // An existing outside file must still be refused; this is not the missing-file branch.
 const outside=path.join(path.dirname(root),'outside.ts');writeFileSync(outside,'export {};');
 try { assert.throws(()=>captureRouteFixtureSources(root),/route_fixture_source_escape/); }
 finally {rmSync(outside,{force:true});}
}));


test('fixed loopback rejects remote, credentials, invalid ports and non-owned paths before connecting', async () => {
  for (const base of ['https://127.0.0.1:12345', 'http://localhost:12345', 'http://example.test:12345',
    'http://127.0.0.1', 'http://127.0.0.1:0', 'http://127.0.0.1:65536',
    'http://actor@127.0.0.1:12345', 'http://127.0.0.1:12345/other', 'http://127.0.0.1:12345/?query']) {
    await assert.rejects(loopbackRequest(base, '/'), /owned_loopback_endpoint_required|Invalid URL/);
  }
  await assert.rejects(loopbackRequest('http://127.0.0.1:12345', '/foreign'), /owned_loopback_path_required/);
  await assert.rejects(loopbackRequest('http://127.0.0.1:12345', '/', {method:'DELETE'}), /owned_loopback_method_required/);
});
