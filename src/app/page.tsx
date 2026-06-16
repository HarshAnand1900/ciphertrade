"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import TraderPanel from "@/components/TraderPanel";
import FollowerPanel from "@/components/FollowerPanel";
import { useState } from "react";

export default function Home() {
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<"trader" | "follower">("trader");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">CipherTrade</h1>
          <p className="text-xs text-gray-400">Confidential copy trading · Zama FHE</p>
        </div>
        <ConnectButton />
      </header>

      {/* Hero */}
      {!isConnected && (
        <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-indigo-950 border border-indigo-700 rounded-full px-4 py-1.5 text-indigo-300 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Powered by Zama FHE · Sepolia Testnet
          </div>
          <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Trade Without<br />Leaking Your Edge
          </h2>
          <p className="text-gray-400 max-w-lg mb-8 text-lg">
            Your position direction and size stay fully encrypted onchain while the trade is open.
            No front-running. No alpha leakage. Copy trading that actually works.
          </p>
          <div className="grid grid-cols-3 gap-6 max-w-lg text-sm text-gray-400 mb-10">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-2xl mb-1">🔐</div>
              <div className="font-medium text-white">Encrypted Positions</div>
              <div>Direction + size hidden onchain</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-2xl mb-1">🤝</div>
              <div className="font-medium text-white">Copy Trading</div>
              <div>Follow top traders privately</div>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-2xl mb-1">⚡</div>
              <div className="font-medium text-white">Aligned Fees</div>
              <div>Traders earn more when staked</div>
            </div>
          </div>
          <p className="text-gray-500 text-sm">Connect your wallet to get started</p>
        </div>
      )}

      {/* App */}
      {isConnected && (
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-8 w-fit">
            <button
              onClick={() => setTab("trader")}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === "trader"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              I'm a Trader
            </button>
            <button
              onClick={() => setTab("follower")}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === "follower"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              I'm a Follower
            </button>
          </div>

          {tab === "trader" ? <TraderPanel /> : <FollowerPanel />}
        </div>
      )}
    </div>
  );
}