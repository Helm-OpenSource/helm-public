import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = Symbol.for("helm.seat-device-revocation-observer");
const row = { id: "device-1", workspaceId: "ws-1", userId: "user-1", membershipId: "m-1", audiencePin: null };

beforeEach(() => {
  vi.resetModules();
  Reflect.deleteProperty(globalThis, KEY);
});
afterEach(() => {
  Reflect.deleteProperty(globalThis, KEY);
  vi.restoreAllMocks();
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("seat device revocation observer", () => {
  it("returns at once and calls nothing without a registration or with nothing revoked", async () => {
    const { notifySeatDevicesRevoked, registerSeatDeviceRevocationObserver, seatDeviceRevocationNotice } = await import("./revocation-observer");
    expect(notifySeatDevicesRevoked([seatDeviceRevocationNotice(row, "self", "user-1")])).toBeUndefined();
    const observer = vi.fn();
    registerSeatDeviceRevocationObserver(observer);
    notifySeatDevicesRevoked([]);
    notifySeatDevicesRevoked([null, seatDeviceRevocationNotice({ ...row, workspaceId: null }, "self", null), seatDeviceRevocationNotice({ ...row, userId: null }, "self", null)]);
    await flush();
    expect(observer).not.toHaveBeenCalled();
  });

  it("calls the observer once, after the caller returns, with frozen notices of exactly these fields", async () => {
    const { notifySeatDevicesRevoked, registerSeatDeviceRevocationObserver, seatDeviceRevocationNotice } = await import("./revocation-observer");
    const observer = vi.fn();
    registerSeatDeviceRevocationObserver(observer);
    const pinned = { ...row, id: "device-2", membershipId: null, audiencePin: "audience-a", deviceLabel: "label", refreshTokenHash: "x" };
    notifySeatDevicesRevoked([seatDeviceRevocationNotice(row, "admin", "actor-1"), null, seatDeviceRevocationNotice(pinned, "refresh_reuse", null)]);
    expect(observer).not.toHaveBeenCalled();
    await flush();
    expect(observer).toHaveBeenCalledTimes(1);
    const [notices] = observer.mock.calls[0];
    expect(notices).toEqual([
      { deviceId: "device-1", workspaceId: "ws-1", userId: "user-1", membershipId: "m-1", reason: "admin", actorUserId: "actor-1", audiencePin: null },
      { deviceId: "device-2", workspaceId: "ws-1", userId: "user-1", membershipId: null, reason: "refresh_reuse", actorUserId: null, audiencePin: "audience-a" },
    ]);
    expect(Object.isFrozen(notices)).toBe(true);
    expect(Object.isFrozen(notices[0])).toBe(true);
  });

  it.each([
    ["throws", () => { throw new TypeError("observer exploded with private detail"); }, "TypeError"],
    ["rejects", () => Promise.reject(new RangeError("private detail")), "RangeError"],
    ["rejects with a non-error", () => Promise.reject("private detail"), "unknown"],
    ["throws an error with an unsafe name", () => { const error = new Error("private detail"); error.name = "Bad Name\n"; throw error; }, "unknown"],
  ])("isolates an observer that %s: nothing reaches the caller, one fixed log line", async (_label, behaviour, logged) => {
    const { notifySeatDevicesRevoked, registerSeatDeviceRevocationObserver, seatDeviceRevocationNotice } = await import("./revocation-observer");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    registerSeatDeviceRevocationObserver(behaviour);
    expect(() => notifySeatDevicesRevoked([seatDeviceRevocationNotice(row, "self", "user-1")])).not.toThrow();
    await flush();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("[seat-device]", JSON.stringify({ event: "revocation_observer_failed", reason: logged }));
    expect(JSON.stringify(log.mock.calls)).not.toContain("private detail");
  });

  // The observer runs in a microtask ahead of the caller's continuation: its
  // returned Promise is never awaited, but its synchronous work delays the caller.
  it.each([
    ["returns a Promise that never settles", () => new Promise(() => undefined), false],
    ["busy-waits before returning", () => { const until = Date.now() + 200; while (Date.now() < until); }, true],
  ])("an observer that %s: the caller is delayed only by synchronous work", async (_label, behaviour, delays) => {
    const { notifySeatDevicesRevoked, registerSeatDeviceRevocationObserver, seatDeviceRevocationNotice } = await import("./revocation-observer");
    registerSeatDeviceRevocationObserver(behaviour);
    const started = Date.now();
    await (async () => notifySeatDevicesRevoked([seatDeviceRevocationNotice(row, "self", "user-1")]))();
    expect(Date.now() - started >= 200).toBe(delays);
  });

  it("a log line that cannot read the error's name still leaves no unhandled rejection", async () => {
    const { notifySeatDevicesRevoked, registerSeatDeviceRevocationObserver, seatDeviceRevocationNotice } = await import("./revocation-observer");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    registerSeatDeviceRevocationObserver(() => { throw Object.defineProperty(new Error("x"), "name", { get() { throw new Error("hostile"); } }); });
    notifySeatDevicesRevoked([seatDeviceRevocationNotice(row, "self", "user-1")]);
    await flush().then(flush).finally(() => process.off("unhandledRejection", unhandled));
    expect(unhandled).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("[seat-device]", JSON.stringify({ event: "revocation_observer_failed", reason: "unknown" }));
  });

  it("registers once: the same function again is accepted, another one throws", async () => {
    const { registerSeatDeviceRevocationObserver } = await import("./revocation-observer");
    const observer = vi.fn();
    registerSeatDeviceRevocationObserver(observer);
    expect(() => registerSeatDeviceRevocationObserver(observer)).not.toThrow();
    expect(() => registerSeatDeviceRevocationObserver(vi.fn())).toThrow("Seat device revocation observer already registered");
    expect(() => registerSeatDeviceRevocationObserver("not a function" as never)).toThrow("Seat device revocation observer must be a function");
  });

  it("says whether an observer is registered", async () => {
    const { isSeatDeviceRevocationObserved, registerSeatDeviceRevocationObserver } = await import("./revocation-observer");
    expect(isSeatDeviceRevocationObserved()).toBe(false);
    registerSeatDeviceRevocationObserver(vi.fn());
    expect(isSeatDeviceRevocationObserved()).toBe(true);
  });
});

// Every caller of the two low-level revokes must hand its notices out of its
// transaction. This lists them, so a new caller fails here until it is
// reviewed and added (with its notification) to the list.
describe("callers of the low-level seat device revokes", () => {
  const root = path.resolve(__dirname, "../..");
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) return name === "node_modules" || name.startsWith(".") ? [] : sources(full);
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
  }
  function calls(name: string) {
    const pattern = new RegExp(`\\b${name}\\(`, "g");
    return ["app", "lib", "features", "components", "extensions", "scripts"]
      .flatMap((dir) => sources(path.join(root, dir)))
      .flatMap((file) => {
        const text = readFileSync(file, "utf8");
        return [...text.matchAll(pattern)].map((match) => {
          const line = text.slice(0, match.index).split("\n").length;
          const statement = text.slice(text.lastIndexOf("\n", match.index) + 1, match.index);
          return { file: path.relative(root, file), line, statement: statement.trim() };
        });
      })
      .filter((call) => !call.statement.startsWith("export async function"))
      .map((call) => `${call.file}: ${call.statement}`);
  }

  it("revokeDeviceRowInTx: every call keeps the notice it returns", () => {
    expect(calls("revokeDeviceRowInTx").sort()).toEqual([
      "lib/seat-device/store-tokens.ts: const notice = await",
      "lib/seat-device/store-tokens.ts: const revoked = await",
      "lib/seat-device/store-tokens.ts: const revoked = await",
      "lib/seat-device/store-tokens.ts: return",
    ]);
  });

  it("revokeSeatDevicesInTx: every caller passes onRevoked and notifies on the line after its transaction", () => {
    const found = calls("revokeSeatDevicesInTx");
    expect(found).toEqual(["features/settings/actions.ts: await"]);
    const action = readFileSync(path.join(root, "features/settings/actions.ts"), "utf8");
    const call = action.slice(action.indexOf("revokeSeatDevicesInTx(tx,"));
    expect(call.slice(0, call.indexOf("});"))).toContain("onRevoked:");
    // The first statement closed at the function's indentation after the call
    // is its transaction; the very next line notifies, before the audit write.
    const afterTransaction = call.slice(call.indexOf("\n  });\n") + "\n  });\n".length);
    expect(afterTransaction.split("\n")[0]).toBe("  notifySeatDevicesRevoked(revokedDevices);");
  });
});
