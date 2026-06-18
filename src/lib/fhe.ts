// Cached, preloaded FHE instance so trades after the first are near-instant.
// The relayer SDK + WASM is heavy; we initialize it once and reuse it.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let instancePromise: Promise<any> | null = null;

function fallbackNetwork(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (typeof window !== "undefined" && (window as any).ethereum) || "https://ethereum-sepolia-rpc.publicnode.com";
}

// Returns a singleton fhevm instance. Safe to call repeatedly (e.g. to preload).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFhevm(): Promise<any> {
  if (instancePromise) return instancePromise;
  instancePromise = (async () => {
    const { createInstance, initSDK, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
    await initSDK(); // load WASM once
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createInstance({ ...SepoliaConfig, network: fallbackNetwork() as any });
  })().catch((e) => {
    instancePromise = null; // allow retry on failure
    throw e;
  });
  return instancePromise;
}

// Fire-and-forget preload, e.g. on app mount, so the first trade is fast.
export function preloadFhevm(): void {
  getFhevm().catch(() => { /* ignored; will retry on demand */ });
}

// relayer returns Uint8Array; viem needs 0x-hex for bytes32/bytes args.
export function toHex(v: unknown): `0x${string}` {
  if (typeof v === "string") return v as `0x${string}`;
  return ("0x" + Array.from(v as Uint8Array).map((b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
}
