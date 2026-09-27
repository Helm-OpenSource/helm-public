import { z } from 'zod';
import {workBuddyClientIdentitySchema,workBuddySafeRefSchema,WorkBuddyCollaborationError,type WorkBuddyClientIdentity} from './contracts';
import {DEFAULT_WORKBUDDY_FEATURE_FLAGS} from './feature-flags';
import {createWorkBuddyMcpToolDispatcher,type WorkBuddyToolExecutionContext,type WorkBuddyMcpToolDispatcher} from './mcp-tool-dispatcher';
import type {WorkBuddyJsonSchema} from './tool-schemas';
import {assertWorkBuddyRequestActive} from './request-cancellation';

export const OPERATIONS_READ_SCOPE = 'caio:operations:read' as const;
export type GovernedReadGrant = WorkBuddyClientIdentity & Readonly<{authorizationVersion:string;expiresAt:string}>;
export type GovernedReadDefinition = Readonly<{
  name:string;description:string;inputSchema:z.ZodType;inputJsonSchema:WorkBuddyJsonSchema;
  /** Must be a strict remote-safe projection; never return a database row. */
  outputSchema:z.ZodType;
  read(input:unknown,context:WorkBuddyToolExecutionContext):Promise<unknown>;
}>;
export type GovernedReadAudit = Readonly<{
  phase:'started'|'completed';requestId:string;toolName:string;
  workspaceId:string;actorUserId:string;clientId:string;authorizationVersion:string;
}>;
const grantSchema=workBuddyClientIdentitySchema.extend({
  authorizationVersion:workBuddySafeRefSchema,expiresAt:z.string().datetime({offset:true}),
}).strict();
function denied():never{throw new WorkBuddyCollaborationError('CAPABILITY_DENIED','The read authorization is unavailable.');}
/**
 * Trusted deployment composition, not a sandbox or authentication mechanism.
 * The upstream transport must authenticate mTLS/edge identity. The authorizer
 * rechecks current device, member and deployment-owned scope/grant state.
 * No environment variable, default edge scope or P1C tool grants this capability.
 */
export function createGovernedReadOnlyDispatcher(input:{
  enabled?:boolean;workspaceId:string;definitions:readonly GovernedReadDefinition[];
  authorize(context:WorkBuddyToolExecutionContext):Promise<GovernedReadGrant|null>;
  audit(event:GovernedReadAudit,signal?:AbortSignal):Promise<void>;
  now?:()=>string;
}):WorkBuddyMcpToolDispatcher{
  const now=input.now??(()=>new Date().toISOString());
  const workspaceId=workBuddySafeRefSchema.parse(input.workspaceId);
  const enabled=input.enabled===true;
  if(enabled&&(typeof input.authorize!=='function'||typeof input.audit!=='function'))throw Error('read_ports_required');
  const names=new Set<string>();
  const tools=(enabled?input.definitions:[]).map(definition=>{
    const keys=['name','description','inputSchema','inputJsonSchema','outputSchema','read'];
    if(Object.keys(definition).some(k=>!keys.includes(k))||
      !/^get_[a-z][a-z0-9_]{0,79}$/.test(definition.name)||names.has(definition.name)||
      typeof definition.read!=='function'||typeof definition.outputSchema?.parse!=='function')throw Error('read_definition_invalid');
    names.add(definition.name);
    // Capture trusted ports once; later edits to the input object cannot swap them.
    const {name,description,inputSchema,read,outputSchema}=definition,{authorize,audit}=input;
    const inputJsonSchema=structuredClone(definition.inputJsonSchema);
    async function check(context:WorkBuddyToolExecutionContext){
      assertWorkBuddyRequestActive(context.signal);
      const identity=workBuddyClientIdentitySchema.parse(context.identity);
      if(identity.workspaceId!==workspaceId||identity.scopes.length!==1||identity.scopes[0]!==OPERATIONS_READ_SCOPE)denied();
      const parsed=grantSchema.safeParse(await authorize(context));
      assertWorkBuddyRequestActive(context.signal);
      if(!parsed.success)denied();
      const grant=parsed.data,at=Date.parse(now());
      if(!Number.isFinite(at)||at<Date.parse(identity.authenticatedAt)||Date.parse(grant.expiresAt)<=at||
        grant.scopes.length!==1||grant.scopes[0]!==OPERATIONS_READ_SCOPE||
        (['clientId','workspaceId','actorUserId','certificateFingerprint','authenticatedAt'] as const).some(k=>grant[k]!==identity[k]))denied();
      return grant;
    }
    return {
      name,description,risk:'read' as const,
      requiredScopes:[OPERATIONS_READ_SCOPE],inputSchema,inputJsonSchema,
      async execute(raw:unknown,context:WorkBuddyToolExecutionContext){
        try {
        const grant=await check(context);
        const event={requestId:context.requestId,toolName:name,workspaceId,
          actorUserId:grant.actorUserId,clientId:grant.clientId,authorizationVersion:grant.authorizationVersion};
        await audit({...event,phase:'started'},context.signal);
        assertWorkBuddyRequestActive(context.signal);
        const output=outputSchema.parse(await read(raw,context));
        const current=await check(context);
        if(current.authorizationVersion!==grant.authorizationVersion)denied();
        await audit({...event,phase:'completed'},context.signal);
        assertWorkBuddyRequestActive(context.signal);
        const finalTime=Date.parse(now());
        if(!Number.isFinite(finalTime)||finalTime<Date.parse(current.authenticatedAt)||finalTime>=Date.parse(current.expiresAt))denied();
        return output;
        } catch {
          assertWorkBuddyRequestActive(context.signal);
          throw new Error("governed_read_failed");
        }
      },
    };
  });
  return createWorkBuddyMcpToolDispatcher({now,flags:{...DEFAULT_WORKBUDDY_FEATURE_FLAGS,gatewayEnabled:enabled,readEnabled:enabled},tools});
}
