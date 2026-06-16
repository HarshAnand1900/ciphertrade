"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useReadContract } from "wagmi";
import { isAddress } from "viem";
import { CIPHER_TRADE_ADDRESS, CIPHER_TRADE_ABI } from "@/lib/contract";

export default function FollowerPanel() {
  const { address } = useAccount();
  const [traderAddress, setTraderAddress] = useState("");
  const [allocation, setAllocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const { writeContractAsync } = useWriteContract();

  const validAddress = isAddress(traderAddress);

  const { data: isOpen } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "isPositionOpen",
    args: [traderAddress as `0x${string}`],
    query: { enabled: validAddress },
  });

  const { data: followerCount } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "getFollowerCount",
    args: [traderAddress as `0x${string}`],
    query: { enabled: validAddress },
  });

  const { data: positionData } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "getPosition",
    args: [traderAddress as `0x${string}`],
    query: { enabled: validAddress && !!isOpen },
  });

  async function handleFollow() {
    if (!validAddress || !allocation) return;
    setLoading(true);
    setStatus("Submitting...");
    try {
      await writeContractAsync({
        address: CIPHER_TRADE_ADDRESS,
        abi: CIPHER_TRADE_ABI,
        functionName: "followTrader",
        args: [traderAddress as `0x${string}`, BigInt(allocation)],
      });
      setStatus("Following! You'll receive P&L share when position closes.");
    } catch (e: unknown) {
      setStatus("Error: " + (e instanceof Error ? e.message : String(e)));
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 space-y-4">
        <h2 className="font-semibold text-white">Follow a Trader</h2>
        <p className="text-xs text-gray-500">
          Enter a trader's address to follow their encrypted position.
          You won't know their direction or size â€” only P&L is revealed at settlement.
        </p>

        <div>
          <label className="text-sm text-gray-400 mb-2 block">Trader Address</label>
          <input
            type="text"
            value={traderAddress}
            onChange={e => setTraderAddress(e.target.value)}
            placeholder="0x..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 font-mono text-sm"
          />
        </div>

        {/* Trader info */}
        {validAddress && (
          <div className={`rounded-lg p-4 border ${isOpen ? "bg-green-950 border-green-800" : "bg-gray-800 border-gray-700"}`}>
            {isOpen ? (
              <div className="space-y-1">
                <div className="text-green-400 font-medium text-sm">ðŸ” Active encrypted position</div>
                <div className="text-xs text-gray-400">
                  Entry price: ${positionData ? (Number((positionData as [unknown, bigint, boolean, boolean])[1]) / 1e6).toFixed(2) : "â€”"}
                </div>
                <div className="text-xs text-gray-400">
                  Followers: {followerCount?.toString() ?? "0"} / 20
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Direction and size are encrypted. You'll share in P&L at close.
                </div>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No open position for this address.</div>
            )}
          </div>
        )}

        <div>
          <label className="text-sm text-gray-400 mb-2 block">Your Allocation (cUSDT units)</label>
          <input
            type="number"
            value={allocation}
            onChange={e => setAllocation(e.target.value)}
            placeholder="e.g. 500"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <button
          onClick={handleFollow}
          disabled={loading || !validAddress || !isOpen || !allocation}
          className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium py-3 rounded-lg transition-colors"
        >
          {loading ? status : "Follow Trader"}
        </button>

        {status && !loading && (
          <div className="text-sm text-gray-400 text-center">{status}</div>
        )}
      </div>

      {/* Info box */}
      <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
        <h3 className="font-medium text-white mb-3">How it works</h3>
        <ol className="space-y-2 text-sm text-gray-400 list-decimal list-inside">
          <li>Find a trader address with an active encrypted position</li>
          <li>Commit your allocation â€” it mirrors their trade proportionally</li>
          <li>When the trader closes, the contract decrypts the position</li>
          <li>P&L is calculated and distributed â€” you keep profit minus the trader's fee</li>
          <li>On a losing trade, the trader's stake is slashed to partially cover you</li>
        </ol>
      </div>
    </div>
  );
}
