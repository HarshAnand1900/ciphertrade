"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import Link from "next/link";
import TraderPanel from "@/components/TraderPanel";
import FollowerPanel from "@/components/FollowerPanel";
import { useState } from "react";

const MONO = "var(--font-jetbrains-mono), monospace";

export default function AppPage() {
  const { isConnected } = useAccount();
  const [tab, setTab] = useState<"trader" | "follower">("trader");

  return (
    <div style={{ minHeight: "100vh", background: "#08090c", color: "#eef2f6" }}>
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          backdropFilter: "blur(14px)",
          background: "rgba(8,9,12,.72)",
          borderBottom: "1px solid #14181f",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "16px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "linear-gradient(135deg,#f59e0b,#fbbf24)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 16,
                boxShadow: "0 0 18px rgba(245,158,11,.5)",
              }}
            >
              C
            </div>
            <div style={{ fontWeight: 600, fontSize: 18, color: "#eef2f6" }}>CipherTrade</div>
          </Link>
          <ConnectButton />
        </div>
      </header>

      {!isConnected && (
        <div style={{ textAlign: "center", padding: "120px 24px" }}>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 12 }}>Connect your wallet</div>
          <p style={{ color: "#aeb8c4", maxWidth: 380, margin: "0 auto" }}>
            Connect to open a sealed position or copy a ranked trader on Sepolia.
          </p>
        </div>
      )}

      {isConnected && (
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>
          {/* Tabs */}
          <div
            style={{
              display: "inline-flex",
              gap: 4,
              background: "#12181f",
              border: "1px solid #232c37",
              borderRadius: 12,
              padding: 4,
              marginBottom: 32,
            }}
          >
            {(["trader", "follower"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 24px",
                  borderRadius: 9,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: MONO,
                  border: "none",
                  cursor: "pointer",
                  transition: "all .2s",
                  background: tab === t ? "#f59e0b" : "transparent",
                  color: tab === t ? "#fff" : "#aeb8c4",
                }}
              >
                {t === "trader" ? "I'm a Trader" : "I'm a Follower"}
              </button>
            ))}
          </div>

          {tab === "trader" ? <TraderPanel /> : <FollowerPanel />}
        </div>
      )}
    </div>
  );
}
