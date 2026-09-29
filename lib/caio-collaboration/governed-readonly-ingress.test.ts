import {describe,it,expect,vi} from 'vitest';
import {createGovernedReadOnlyIngress} from './governed-readonly-ingress';
import type {WorkBuddyClientIdentity} from './contracts';
const identity={schemaVersion:'helm.workbuddy-client-identity/v1',clientId:'device:one',workspaceId:'workspace:one',actorUserId:'user:one',certificateFingerprint:`sha256:${'a'.repeat(64)}`,scopes:['caio:operations:read'],transport:'mtls',mtlsVerified:true,authenticatedAt:'2026-01-01T00:00:00Z'} as WorkBuddyClientIdentity;
function setup(){const authenticate=vi.fn(async()=>identity),listTools=vi.fn(()=>[]),dispatch=vi.fn();const make=(patch={})=>createGovernedReadOnlyIngress({enabled:true,workspaceId:identity.workspaceId,authenticate,dispatcher:{listTools,dispatch},...patch});const request=()=>new Request('https://example.invalid/read',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})});return{authenticate,listTools,make,request};}
describe('governed read ingress',()=>{
 it('does nothing unless explicitly enabled',async()=>{const f=setup();expect((await f.make({enabled:undefined})(f.request())).status).toBe(404);expect(f.authenticate).not.toHaveBeenCalled();});
 it('rejects null/foreign/elevated identity before MCP discovery',async()=>{for(const who of [null,{...identity,workspaceId:'workspace:foreign'},{...identity,scopes:['caio:operations:read','caio:canonical:mutate']}]){const f=setup();f.authenticate.mockResolvedValue(who as WorkBuddyClientIdentity);expect((await f.make()(f.request())).status).toBe(403);expect(f.listTools).not.toHaveBeenCalled();}});
 it('accepts only the deployment-authenticated narrow identity',async()=>{const f=setup();expect((await f.make()(f.request())).status).toBe(200);expect(f.listTools).toHaveBeenCalledWith(identity);});
 it('does not expose authentication exceptions',async()=>{const f=setup();f.authenticate.mockRejectedValue(Error('private'));const r=await f.make()(f.request());expect(r.status).toBe(503);expect(await r.text()).not.toContain('private');});
});
