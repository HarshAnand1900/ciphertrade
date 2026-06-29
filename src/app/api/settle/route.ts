import { NextRequest, NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, parseAbi, getAddress } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { CIPHER_TRADE_ADDRESS } from "@/lib/contract";

// Force the Node.js runtime (not Edge) and skip static analysis — the relayer
// SDK loads native WASM that can't be bundled into an Edge function.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Minimal ABI for the settlement flow.
const ABI = parseAbi([
  "function settlePosition(address trader, bool direction, uint64 size, uint64 leverage) external",
  "function getEncryptedHandles(address trader) external view returns (bytes32 direction, bytes32 size, bytes32 leverage)",
  "function isPositionOpen(address trader) external view returns (bool)",
  "function isSettled(address trader) external view returns (bool)",
]);

export async function POST(req: NextRequest) {
  try {
    const { trader: rawTrader } = (await req.json()) as { trader: string };
    if (!rawTrader) return NextResponse.json({ error: "trader required" }, { status: 400 });
    const trader = getAddress(rawTrader);

    const adminKey = process.env.ADMIN_PRIVATE_KEY;
    if (!adminKey) return NextResponse.json({ error: "ADMIN_PRIVATE_KEY not set" }, { status: 500 });
    const rpcUrl = process.env.SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";

    const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });

    // Guard: only settle a position that is actually closed and not yet settled.
    const [isOpen, alreadySettled] = await Promise.all([
      publicClient.readContract({ address: CIPHER_TRADE_ADDRESS, abi: ABI, functionName: "isPositionOpen", args: [trader] }),
      publicClient.readContract({ address: CIPHER_TRADE_ADDRESS, abi: ABI, functionName: "isSettled", args: [trader] }),
    ]);
    if (isOpen) return NextResponse.json({ error: "position still open" }, { status: 409 });
    if (alreadySettled) return NextResponse.json({ ok: true, alreadySettled: true });

    // Read the encrypted handles that closePosition marked publicly decryptable.
    const [dirHandle, sizeHandle, levHandle] = (await publicClient.readContract({
      address: CIPHER_TRADE_ADDRESS, abi: ABI, functionName: "getEncryptedHandles", args: [trader],
    })) as [`0x${string}`, `0x${string}`, `0x${string}`];

    // Decrypt the REAL on-chain ciphertext via the KMS/relayer — never trust the browser.
    // Imported dynamically so the WASM only loads at request time (keeps build static-analysis happy).
    const { createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/node");
    const fhevm = await createInstance({ ...SepoliaConfig, network: rpcUrl });
    const { clearValues } = await fhevm.publicDecrypt([dirHandle, sizeHandle, levHandle]);

    const direction = Boolean(clearValues[dirHandle.toLowerCase() as `0x${string}`] ?? clearValues[dirHandle]);
    const sizeRaw = clearValues[sizeHandle.toLowerCase() as `0x${string}`] ?? clearValues[sizeHandle];
    const levRaw = clearValues[levHandle.toLowerCase() as `0x${string}`] ?? clearValues[levHandle];
    const size = BigInt(sizeRaw as bigint);
    const leverage = BigInt(levRaw as bigint);

    // Submit the decrypted values; only the admin can call settlePosition.
    const account = privateKeyToAccount(adminKey as `0x${string}`);
    const walletClient = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
    const hash = await walletClient.writeContract({
      address: CIPHER_TRADE_ADDRESS, abi: ABI, functionName: "settlePosition",
      args: [trader, direction, size, leverage],
    });
    await publicClient.waitForTransactionReceipt({ hash });

    return NextResponse.json({ ok: true, hash, decrypted: { direction, size: size.toString(), leverage: leverage.toString() } });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
