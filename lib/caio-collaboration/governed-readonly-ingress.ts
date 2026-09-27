import {workBuddyClientIdentitySchema,type WorkBuddyClientIdentity,workBuddySafeRefSchema} from './contracts';
import {OPERATIONS_READ_SCOPE} from './governed-readonly';
import {handleWorkBuddyMcpMessage} from './mcp-protocol';
import type {WorkBuddyMcpToolDispatcher} from './mcp-tool-dispatcher';
import {readBoundedRequestBytes} from '../http/bounded-request-bytes';
import {assertWorkBuddyRequestActive} from './request-cancellation';
const response=(status:number,body:unknown)=>new Response(body===null?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
/**
 * Explicit deployment-owned route composition. No public route is mounted here.
 * authenticate MUST verify a real trusted transport plus current revocable
 * device/workspace mapping, not deserialize a caller-supplied identity or bool.
 * Do not pass the legacy P1C edge's shared scopes as an operations grant.
 */
export function createGovernedReadOnlyIngress(input:{
 enabled?:boolean;workspaceId:string;
 authenticate(request:Request):Promise<WorkBuddyClientIdentity|null>;
 dispatcher:WorkBuddyMcpToolDispatcher;
}):(request:Request)=>Promise<Response>{
 const enabled=input.enabled===true,workspaceId=workBuddySafeRefSchema.parse(input.workspaceId);
 const {authenticate,dispatcher}=input;
 return async request=>{
  if(!enabled)return response(404,null);
  if(request.method!=='POST')return response(405,null);
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return response(415,null);
  try{
   assertWorkBuddyRequestActive(request.signal);
   const parsed=workBuddyClientIdentitySchema.safeParse(await authenticate(request));
   assertWorkBuddyRequestActive(request.signal);
   if(!parsed.success||parsed.data.workspaceId!==workspaceId||parsed.data.scopes.length!==1||parsed.data.scopes[0]!==OPERATIONS_READ_SCOPE)return response(403,{error:'read_identity_denied'});
   const read=await readBoundedRequestBytes(request.body,{maxBytes:32768,timeoutMs:5000});
   if(!read.ok)return response(read.code==='body_too_large'?413:read.code==='body_timeout'?408:400,null);
   let message:unknown;try{message=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(read.bytes));}catch{return response(400,null);}finally{read.bytes.fill(0);}
   assertWorkBuddyRequestActive(request.signal);
   const result=await handleWorkBuddyMcpMessage({message,identity:parsed.data,dispatcher,requestId:`operations-read:${crypto.randomUUID()}`,signal:request.signal});
   assertWorkBuddyRequestActive(request.signal);
   return response(result.httpStatus,result.body);
  }catch{return response(503,{error:'read_ingress_unavailable'});}
 };
}
