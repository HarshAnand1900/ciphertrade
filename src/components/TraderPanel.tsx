"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useReadContract, useWalletClient } from "wagmi";
import { CIPHER_TRADE_ADDRESS, CIPHER_TRADE_ABI } from "@/lib/contract";


export default function TraderPanel() {
  const { address } = useAccount();
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [size, setSize] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const { writeContractAsync } = useWriteContract();
  const { data: walletClient } = useWalletClient();

  const { data: positionData } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "getPosition",
    args: [address!],
    query: { enabled: !!address },
  }) as { data: [bigint, bigint, boolean, boolean] | undefined };

  const { data: isOpen } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "isPositionOpen",
    args: [address!],
    query: { enabled: !!address },
  }) as { data: boolean | undefined };

  const { data: stakedBalance } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "stakedBalance",
    args: [address!],
    query: { enabled: !!address },
  }) as { data: bigint | undefined };

  const isStaked = stakedBalance && BigInt(stakedBalance.toString()) > 0n;

  async function handleOpenPosition() {
    if (!size || isNaN(Number(size)) || !address || !walletClient) return;
    setLoading(true);
    try {
      setStatus("Initializing FHE instance...");
      const { createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk");
      const fhevm = await createInstance({
        ...SepoliaConfig,
        network: walletClient as Parameters<typeof createInstance>[0]["network"],
      });

      setStatus("Encrypting position...");
      const sizeValue = BigInt(Math.floor(Number(size)));
      const isLong = direction === "long";

      const input = fhevm.createEncryptedInput(CIPHER_TRADE_ADDRESS, address);
      input.addBool(isLong);
      input.add64(sizeValue);
      const encrypted = await input.encrypt();

      setStatus("Sending transaction...");
      await writeContractAsync({
        address: CIPHER_TRADE_ADDRESS,
        abi: CIPHER_TRADE_ABI,
        functionName: "openPosition",
        args: [
          encrypted.handles[0],
          encrypted.handles[1],
          encrypted.inputProof,
        ],
      });

      setStatus("Position opened - encrypted onchain!");
      setSize("");
    } catch (e: unknown) {
      setStatus("Error: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  }

  async function handleClose() {
    setLoading(true);
    setStatus("Closing position...");
    try {
      await writeContractAsync({
        address: CIPHER_TRADE_ADDRESS,
        abi: CIPHER_TRADE_ABI,
        functionName: "closePosition",
      });
      setStatus("Position closed. Awaiting settlement.");
    } catch (e: unknown) {
      setStatus("Error: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  }

  async function handleStake() {
    setLoading(true);
    try {
      await writeContractAsync({
        address: CIPHER_TRADE_ADDRESS,
        abi: CIPHER_TRADE_ABI,
        functionName: isStaked ? "unstake" : "stake",
      });
      setStatus(isStaked ? "Unstaked." : "Staked. You now earn 18% performance fee.");
    } catch (e: unknown) {
      setStatus("Error: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className={`rounded-xl p-4 border ${isOpen ? "bg-green-950 border-green-700" : "bg-gray-900 border-gray-800"}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Position Status</div>
            <div className={`text-lg font-semibold ${isOpen ? "text-green-400" : "text-gray-500"}`}>
              {!!isOpen ? "Active - Encrypted Onchain" : "No Open Position"}
            </div>
            {!!isOpen && positionData && (
              <div className="text-xs text-gray-500 mt-1">
                Entry price: {(Number((positionData as [unknown, bigint, boolean, boolean])[1]) / 1e6).toFixed(2)}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Fee Tier</div>
            <div className={`font-semibold ${isStaked ? "text-indigo-400" : "text-gray-400"}`}>
              {isStaked ? "18% (Staked)" : "8% (Unstaked)"}
            </div>
          </div>
        </div>
      </div>

      {!isOpen && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
          <h2 className="font-semibold text-white">Open Encrypted Position</h2>
          <p className="text-xs text-gray-500">Your direction and size will be FHE-encrypted before hitting the chain. Nobody can see them while the trade is open.</p>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Direction</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDirection("long")}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${direction === "long" ? "bg-green-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                LONG
              </button>
              <button
                onClick={() => setDirection("short")}
                className={`flex-1 py-3 rounded-lg font-medium transition-colors ${direction === "short" ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                SHORT
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400 mb-2 block">Size (cUSDT units)</label>
            <input
              type="number"
              value={size}
              onChange={e => setSize(e.target.value)}
              placeholder="e.g. 1000"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            onClick={handleOpenPosition}
            disabled={loading || !size}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-3 rounded-lg transition-colors"
          >
            {loading ? status || "Processing..." : "Encrypt and Open Position"}
          </button>
        </div>
      )}

      {!!isOpen && (
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="font-semibold text-white mb-2">Close Position</h2>
          <p className="text-xs text-gray-500 mb-4">Closing will mark your encrypted values as decryptable. Admin settles P&L and distributes to followers.</p>
          <button
            onClick={handleClose}
            disabled={loading}
            className="w-full bg-red-700 hover:bg-red-600 disabled:bg-gray-700 text-white font-medium py-3 rounded-lg transition-colors"
          >
            {loading ? status : "Close Position"}
          </button>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-white">Staking</h2>
            <p className="text-xs text-gray-500 mt-1">Stake to earn 18% fee. Your stake is slashed proportionally on losing trades.</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${isStaked ? "bg-indigo-900 text-indigo-300" : "bg-gray-800 text-gray-400"}`}>
            {isStaked ? "Staked" : "Unstaked"}
          </div>
        </div>
        <button
          onClick={handleStake}
          disabled={loading || !!isOpen}
          className="w-full bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
        >
          {isStaked ? "Unstake" : "Stake 100 cUSDT"}
        </button>
        {!!isOpen && <p className="text-xs text-gray-600 mt-2 text-center">Close position first to change stake</p>}
      </div>

      {status && !loading && (
        <div className="text-sm text-gray-400 text-center">{status}</div>
      )}
    </div>
  );
}

