import { afterEach, describe, expect, it, vi } from "vitest";
const mock=vi.hoisted(()=>({loaded:vi.fn()}));
vi.mock("@/lib/runtime/node-instrumentation",()=>{mock.loaded();return {registerNodeInstrumentation:vi.fn()};});
import {register} from "./instrumentation";
const prior=process.env.NEXT_RUNTIME;
afterEach(()=>{vi.restoreAllMocks();mock.loaded.mockClear();if(prior===undefined)delete process.env.NEXT_RUNTIME;else process.env.NEXT_RUNTIME=prior;});
describe("Next instrumentation runtime boundary",()=>{it("does not load the Node entry in Edge",async()=>{process.env.NEXT_RUNTIME="edge";const log=vi.spyOn(console,"info").mockImplementation(()=>undefined);await register();expect(mock.loaded).not.toHaveBeenCalled();expect(log).toHaveBeenCalledWith(expect.stringContaining('"nextRuntime":"edge"'));});});
