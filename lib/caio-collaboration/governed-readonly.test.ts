import {describe,it,expect,vi} from 'vitest';
import {z} from 'zod';
import {createGovernedReadOnlyDispatcher} from './governed-readonly';
import {WorkBuddyCollaborationError,type WorkBuddyClientIdentity} from './contracts';
import type {GovernedReadAudit} from './governed-readonly';
const identity={schemaVersion:'helm.workbuddy-client-identity/v1',clientId:'device:one',workspaceId:'workspace:one',actorUserId:'user:one',certificateFingerprint:`sha256:${'a'.repeat(64)}`,scopes:['caio:operations:read'],transport:'mtls',mtlsVerified:true,authenticatedAt:'2026-01-01T00:00:00.000Z'} as WorkBuddyClientIdentity;
function setup(enabled=true){
 const read=vi.fn(async()=>({count:3})),audit=vi.fn(async(_event:GovernedReadAudit)=>{});
 const authorize=vi.fn(async()=>({...identity,authorizationVersion:'revision:1',expiresAt:'2026-01-01T00:05:00.000Z'}));
 const definition={name:'get_operations_summary',description:'Read scoped counters.',inputSchema:z.object({}).strict(),inputJsonSchema:{type:'object',properties:{},additionalProperties:false},outputSchema:z.object({count:z.number().int().nonnegative()}).strict(),read};
 const make=(patch={})=>createGovernedReadOnlyDispatcher({enabled,workspaceId:identity.workspaceId,definitions:[definition],authorize,audit,now:()=> '2026-01-01T00:01:00.000Z',...patch});
 const call=(d=make(),who=identity,name=definition.name)=>d.dispatch({name,input:{},context:{identity:who,requestId:'request:one'}});
 return {make,call,read,audit,authorize,definition};
}
describe('governed read-only extension',()=>{
 it('is inert by default',async()=>{const f=setup();const d=f.make({enabled:undefined});expect(d.listTools(identity)).toEqual([]);expect((await f.call(d)).ok).toBe(false);expect(f.authorize).not.toHaveBeenCalled();});
 it('requires its narrow scope; old read scopes gain no rights',async()=>{const f=setup();expect((await f.call(f.make(),{...identity,scopes:['caio:p1c:read']})).ok).toBe(false);expect(f.read).not.toHaveBeenCalled();});
 it('reads only after authorization and audit, rechecks before release',async()=>{const f=setup();expect((await f.call()).ok).toBe(true);expect(f.authorize).toHaveBeenCalledTimes(2);expect(f.audit.mock.calls.map(x=>x[0].phase)).toEqual(['started','completed']);expect(f.audit.mock.invocationCallOrder[0]).toBeLessThan(f.read.mock.invocationCallOrder[0]);});
 it('refuses foreign workspace and altered authoritative actor',async()=>{const f=setup();expect((await f.call(f.make(),{...identity,workspaceId:'workspace:other'})).ok).toBe(false);f.authorize.mockResolvedValue({...identity,actorUserId:'user:other',authorizationVersion:'revision:1',expiresAt:'2026-01-01T00:05:00.000Z'});expect((await f.call()).ok).toBe(false);expect(f.read).not.toHaveBeenCalled();});
 it('revocation/version change after read prevents response',async()=>{const f=setup();f.authorize.mockResolvedValueOnce({...identity,authorizationVersion:'revision:1',expiresAt:'2026-01-01T00:05:00.000Z'}).mockResolvedValueOnce({...identity,authorizationVersion:'revision:2',expiresAt:'2026-01-01T00:05:00.000Z'});expect((await f.call()).ok).toBe(false);});
 it('audit failure before or after read never returns data',async()=>{for(const phase of ['started','completed']){const f=setup();f.audit.mockImplementation(async e=>{if(e.phase===phase)throw Error('private detail');});const r=await f.call();expect(r.ok).toBe(false);expect(JSON.stringify(r)).not.toContain('private detail');if(phase==='started')expect(f.read).not.toHaveBeenCalled();}});
 it('rejects unknown and write tool definitions/calls',async()=>{const f=setup();expect((await f.call(f.make(),identity,'delete_record')).ok).toBe(false);expect(()=>f.make({definitions:[{...f.definition,name:'delete_record'}]})).toThrow();expect(()=>f.make({definitions:[{...f.definition,risk:'mutation'}]})).toThrow();});
 it('rejects undeclared output fields',async()=>{const f=setup();f.read.mockResolvedValue({count:3,secret:'private'} as {count:number});const r=await f.call();expect(r.ok).toBe(false);expect(JSON.stringify(r)).not.toContain('private');});
 it('honors cancellation before read',async()=>{const f=setup(),c=new AbortController();c.abort();const r=await f.make().dispatch({name:f.definition.name,input:{},context:{identity,requestId:'request:one',signal:c.signal}});expect(r.ok).toBe(false);expect(f.read).not.toHaveBeenCalled();});
 it('redacts typed errors from deployment ports',async()=>{const f=setup();f.read.mockRejectedValue(new WorkBuddyCollaborationError('SCOPE_DENIED','private port detail'));const r=await f.call();expect(r.ok).toBe(false);expect(JSON.stringify(r)).not.toContain('private port detail');});
 it('captures definition metadata against later caller mutation',async()=>{const f=setup(),d=f.make();f.definition.name='get_changed';f.definition.description='changed';expect((await f.call(d,identity,'get_operations_summary')).ok).toBe(true);expect(f.audit.mock.calls[0][0].toolName).toBe('get_operations_summary');});
 it('rejects elevated scope combinations',async()=>{const f=setup();expect((await f.call(f.make(),{...identity,scopes:['caio:operations:read','caio:p1c:read']})).ok).toBe(false);expect(f.read).not.toHaveBeenCalled();});
 it('rejects expired grants',async()=>{const f=setup();f.authorize.mockResolvedValue({...identity,authorizationVersion:'revision:1',expiresAt:'2026-01-01T00:00:59.000Z'});expect((await f.call()).ok).toBe(false);expect(f.read).not.toHaveBeenCalled();});
});
