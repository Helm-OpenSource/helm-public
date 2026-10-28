/**
 * Type contract for the fixed, build-supplied server bootstrap slot.
 * The public Core build projects its loader to an unavailable stub; assembled
 * applications provide the implementation at this exact module specifier.
 */
declare module "@/extensions/pack-bootstrap" {
  export function registerAllPacks(): void;
  export const serverBootstrapVersion: string;
  export const serverBootstrapMode: string;
  export function registerServerBootstrap(): Promise<void>;
}
