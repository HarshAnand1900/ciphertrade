"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useReadContract, useReadContracts } from "wagmi";
import { CIPHER_TRADE_ADDRESS, CIPHER_TRADE_ABI } from "@/lib/contract";

const MONO = "var(--font-jetbrains-mono), monospace";
const AMBER = "#f59e0b";
const GREEN = "#4ade80";
const RED = "#fca5a5";
const MUTED = "#7d8896";

function shortAddr(a: string) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function fmtPnl(netPnlBps: bigint, totalTrades: bigint) {
  if (totalTrades === 0n) return { str: "—", color: MUTED };
  const avg = Number(netPnlBps) / Number(totalTrades) / 100;
  const str = (avg >= 0 ? "+" : "") + avg.toFixed(1) + "%";
  return { str, color: avg >= 0 ? GREEN : RED };
}

function winRate(wins: bigint, total: bigint) {
  if (total === 0n) return "—";
  return Math.round((Number(wins) / Number(total)) * 100) + "%";
}

// ── Trader row inside the leaderboard ──
function TraderRow({
  address,
  rank,
  selected,
  onSelect,
}: {
  address: `0x${string}`;
  rank: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const { data: stats } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "traderStats",
    args: [address],
  });
  const { data: isOpen } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "isPositionOpen",
    args: [address],
  });

  const [totalTrades, wins, netPnlBps] = stats
    ? (stats as [bigint, bigint, bigint])
    : [0n, 0n, 0n];

  const pnl = fmtPnl(netPnlBps, totalTrades);
  const wr = winRate(wins, totalTrades);

  return (
    <div
      onClick={onSelect}
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr 60px 60px 70px 80px",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        background: selected ? "#1a1f12" : "#0f141a",
        border: "1px solid " + (selected ? "#5e4a24" : "#1a2030"),
        borderRadius: 12,
        cursor: "pointer",
        transition: "all .18s",
      }}
    >
      <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>#{rank}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: rank === 1 ? "linear-gradient(135deg,#f59e0b,#fbbf24)" : "#1e2630",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 700, fontSize: 13,
        }}>
          {address.slice(2, 4).toUpperCase()}
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: "#eef2f6" }}>{shortAddr(address)}</div>
          <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
            {isOpen ? <span style={{ color: GREEN }}>● live position</span> : <span style={{ color: MUTED }}>○ no position</span>}
          </div>
        </div>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 13, color: "#eef2f6", textAlign: "right" }}>{totalTrades.toString()}</div>
      <div style={{ fontFamily: MONO, fontSize: 13, color: GREEN, textAlign: "right" }}>{wr}</div>
      <div style={{ fontFamily: MONO, fontSize: 13, color: pnl.color, textAlign: "right" }}>{pnl.str}</div>
      <div style={{ textAlign: "right" }}>
        <span style={{
          fontFamily: MONO, fontSize: 10, fontWeight: 600,
          color: isOpen ? AMBER : MUTED,
          background: isOpen ? "#241b0c" : "#111418",
          border: "1px solid " + (isOpen ? "#5e4a24" : "#1a2030"),
          padding: "3px 8px", borderRadius: 6,
        }}>
          {isOpen ? "OPEN" : "CLOSED"}
        </span>
      </div>
    </div>
  );
}

// ── Follow form shown when a trader is selected ──
function FollowForm({ trader }: { trader: `0x${string}` }) {
  const { address } = useAccount();
  const [allocation, setAllocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const { writeContractAsync } = useWriteContract();

  const { data: isOpen } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "isPositionOpen",
    args: [trader],
  });
  const { data: followerCount } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "getFollowerCount",
    args: [trader],
  });
  const { data: stats } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "traderStats",
    args: [trader],
  });
  const { data: history } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "getTradeHistory",
    args: [trader],
  });

  const [totalTrades, wins, netPnlBps] = stats
    ? (stats as [bigint, bigint, bigint])
    : [0n, 0n, 0n];

  const pnl = fmtPnl(netPnlBps, totalTrades);
  const slots = 20 - Number(followerCount ?? 0n);

  const tradeRows = (history as { entryPrice: bigint; exitPrice: bigint; direction: boolean; pnlBps: bigint; timestamp: bigint }[] | undefined)
    ?.slice(-5)
    .reverse() ?? [];

  async function handleFollow() {
    if (!allocation || !isOpen) return;
    setLoading(true);
    setStatus("Submitting…");
    try {
      await writeContractAsync({
        address: CIPHER_TRADE_ADDRESS,
        abi: CIPHER_TRADE_ABI,
        functionName: "followTrader",
        args: [trader, BigInt(allocation)],
      });
      setStatus("✓ Following! You'll receive P&L share at settlement.");
      setAllocation("");
    } catch (e: unknown) {
      setStatus("Error: " + (e instanceof Error ? e.message.slice(0, 80) : String(e)));
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {[
          { label: "Settled trades", value: totalTrades.toString(), color: "#eef2f6" },
          { label: "Win rate", value: winRate(wins, totalTrades), color: GREEN },
          { label: "Avg P&L / trade", value: pnl.str, color: pnl.color },
        ].map((s) => (
          <div key={s.label} style={{ background: "#0f141a", border: "1px solid #1a2030", borderRadius: 11, padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* recent trades */}
      {tradeRows.length > 0 && (
        <div style={{ background: "#0f141a", border: "1px solid #1a2030", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a2030", fontSize: 11, color: MUTED, fontFamily: MONO }}>RECENT TRADES (last 5)</div>
          {tradeRows.map((tr, i) => {
            const pnlN = Number(tr.pnlBps) / 100;
            const col = pnlN >= 0 ? GREEN : RED;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", borderBottom: i < tradeRows.length - 1 ? "1px solid #1a2030" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: tr.direction ? GREEN : RED }}>{tr.direction ? "▲ LONG" : "▼ SHORT"}</span>
                  <span style={{ fontSize: 10, color: MUTED }}>entry ${(Number(tr.entryPrice) / 1e6).toFixed(0)} → exit ${(Number(tr.exitPrice) / 1e6).toFixed(0)}</span>
                </div>
                <span style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600, color: col }}>{pnlN >= 0 ? "+" : ""}{pnlN.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      )}

      {tradeRows.length === 0 && (
        <div style={{ background: "#0f141a", border: "1px solid #1a2030", borderRadius: 12, padding: "20px 16px", textAlign: "center", fontSize: 13, color: MUTED }}>
          No settled trades yet — track record will appear here.
        </div>
      )}

      {/* follow form */}
      <div style={{ background: "#12181f", border: "1px solid #232c37", borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Follow this trader</div>
          <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>{slots} slots left</div>
        </div>

        {!isOpen && (
          <div style={{ background: "#1a1f26", border: "1px solid #1a2030", borderRadius: 10, padding: "12px 14px", marginBottom: 14, fontSize: 13, color: MUTED }}>
            No open position right now. Follow when the trader opens one.
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 6 }}>Your allocation (cUSDT units)</label>
          <input
            type="number"
            value={allocation}
            onChange={(e) => setAllocation(e.target.value)}
            placeholder="e.g. 500"
            style={{
              width: "100%", background: "#0f141a", border: "1px solid #232c37", borderRadius: 10,
              padding: "12px 14px", color: "#eef2f6", fontSize: 14, fontFamily: MONO, outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <button
          onClick={handleFollow}
          disabled={loading || !isOpen || !allocation || trader === address}
          style={{
            width: "100%", padding: "13px 0", borderRadius: 10, border: "none",
            background: isOpen && allocation ? AMBER : "#1a2030",
            color: isOpen && allocation ? "#fff" : MUTED,
            fontSize: 14, fontWeight: 600, cursor: isOpen && allocation ? "pointer" : "not-allowed",
            transition: "all .2s", boxShadow: isOpen && allocation ? "0 6px 20px -6px rgba(245,158,11,.5)" : "none",
          }}
        >
          {loading ? status : trader === address ? "Can't follow yourself" : "Follow trader →"}
        </button>

        {status && !loading && (
          <div style={{ marginTop: 10, fontSize: 12, color: status.startsWith("✓") ? GREEN : RED, textAlign: "center", fontFamily: MONO }}>{status}</div>
        )}
      </div>
    </div>
  );
}

// ── Main panel ──
export default function FollowerPanel() {
  const [selected, setSelected] = useState<`0x${string}` | null>(null);

  const { data: traders, isLoading } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "getTraders",
  });

  const traderList = (traders as `0x${string}`[] | undefined) ?? [];

  return (
    <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 400px" : "1fr", gap: 20 }} className="follower-grid">
      {/* leaderboard */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Registered traders</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED }}>{traderList.length} on-chain</div>
        </div>

        {/* column headers */}
        {traderList.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 60px 60px 70px 80px", gap: 12, padding: "0 18px", marginBottom: -4 }}>
            {["#", "Trader", "Trades", "Win %", "Avg P&L", "Status"].map((h) => (
              <div key={h} style={{ fontSize: 10, color: MUTED, fontFamily: MONO, textAlign: h === "#" || h === "Trader" ? "left" : "right" }}>{h}</div>
            ))}
          </div>
        )}

        {isLoading && (
          <div style={{ padding: "40px 0", textAlign: "center", color: MUTED, fontSize: 13 }}>Loading traders…</div>
        )}

        {!isLoading && traderList.length === 0 && (
          <div style={{ background: "#0f141a", border: "1px solid #1a2030", borderRadius: 14, padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>🔒</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>No traders registered yet</div>
            <div style={{ fontSize: 13, color: MUTED }}>Switch to the Trader tab to open the first sealed position.</div>
          </div>
        )}

        {traderList.map((addr, i) => (
          <TraderRow
            key={addr}
            address={addr}
            rank={i + 1}
            selected={selected === addr}
            onSelect={() => setSelected(selected === addr ? null : addr)}
          />
        ))}
      </div>

      {/* detail / follow panel */}
      {selected && (
        <div style={{ background: "#12181f", border: "1px solid #232c37", borderRadius: 16, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO, marginBottom: 4 }}>Selected trader</div>
              <div style={{ fontFamily: MONO, fontSize: 13, color: "#eef2f6" }}>{shortAddr(selected)}</div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: MUTED, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>
          <FollowForm trader={selected} />
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `@media(max-width:760px){.follower-grid{grid-template-columns:1fr !important;}}` }} />
    </div>
  );
}
