"use client";

import { useState } from "react";
import { useAccount, useWriteContract, useReadContract, useWalletClient } from "wagmi";
import { CIPHER_TRADE_ADDRESS, CIPHER_TRADE_ABI } from "@/lib/contract";

const MONO = "var(--font-jetbrains-mono), monospace";
const SANS = "var(--font-space-grotesk), system-ui, sans-serif";
const AMBER = "#f59e0b";
const GREEN = "#4ade80";
const RED = "#fca5a5";
const MUTED = "#7d8896";

export default function TraderPanel() {
  const { address } = useAccount();
  const [direction, setDirection] = useState<"long" | "short">("long");
  const [size, setSize] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [statusOk, setStatusOk] = useState(false);

  const { writeContractAsync } = useWriteContract();
  const { data: walletClient } = useWalletClient();

  const { data: positionData } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "getPosition",
    args: [address!],
    query: { enabled: !!address },
  }) as { data: [bigint, bigint, boolean, boolean] | undefined };

  const { data: isOpen, refetch: refetchOpen } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "isPositionOpen",
    args: [address!],
    query: { enabled: !!address },
  }) as { data: boolean | undefined; refetch: () => void };

  const { data: stakedBalance, refetch: refetchStake } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "stakedBalance",
    args: [address!],
    query: { enabled: !!address },
  }) as { data: bigint | undefined; refetch: () => void };

  const { data: traderStats } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "traderStats",
    args: [address!],
    query: { enabled: !!address },
  }) as { data: [bigint, bigint, bigint] | undefined };

  const { data: followerCount } = useReadContract({
    address: CIPHER_TRADE_ADDRESS,
    abi: CIPHER_TRADE_ABI,
    functionName: "getFollowerCount",
    args: [address!],
    query: { enabled: !!address },
  }) as { data: bigint | undefined };

  const isStaked = stakedBalance && stakedBalance > 0n;
  const entryPrice = positionData ? Number(positionData[1]) / 1e6 : 0;
  const [totalTrades, wins] = traderStats ?? [0n, 0n];
  const winRateStr = totalTrades > 0n ? Math.round(Number(wins) / Number(totalTrades) * 100) + "%" : "—";

  function setErr(msg: string) { setStatus(msg); setStatusOk(false); }
  function setOk(msg: string) { setStatus(msg); setStatusOk(true); }

  async function handleOpenPosition() {
    if (!size || isNaN(Number(size)) || !address || !walletClient) return;
    setLoading(true);
    try {
      setStatus("Initializing FHE…"); setStatusOk(false);
      const { createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
      const fhevm = await createInstance({
        ...SepoliaConfig,
        network: walletClient as Parameters<typeof createInstance>[0]["network"],
      });
      setStatus("Encrypting position…");
      const input = fhevm.createEncryptedInput(CIPHER_TRADE_ADDRESS, address);
      input.addBool(direction === "long");
      input.add64(BigInt(Math.floor(Number(size))));
      const encrypted = await input.encrypt();

      setStatus("Sending transaction…");
      await writeContractAsync({
        address: CIPHER_TRADE_ADDRESS,
        abi: CIPHER_TRADE_ABI,
        functionName: "openPosition",
        args: [encrypted.handles[0], encrypted.handles[1], encrypted.inputProof],
      });
      setOk("Position sealed on-chain. Direction and size are encrypted.");
      setSize("");
      refetchOpen();
    } catch (e: unknown) {
      setErr("Error: " + (e instanceof Error ? e.message.slice(0, 100) : String(e)));
    }
    setLoading(false);
  }

  async function handleClose() {
    setLoading(true);
    setStatus("Closing…"); setStatusOk(false);
    try {
      await writeContractAsync({
        address: CIPHER_TRADE_ADDRESS,
        abi: CIPHER_TRADE_ABI,
        functionName: "closePosition",
      });
      setOk("Position closed. Awaiting KMS decryption and settlement.");
      refetchOpen();
    } catch (e: unknown) {
      setErr("Error: " + (e instanceof Error ? e.message.slice(0, 100) : String(e)));
    }
    setLoading(false);
  }

  async function handleStake() {
    setLoading(true);
    setStatusOk(false);
    try {
      await writeContractAsync({
        address: CIPHER_TRADE_ADDRESS,
        abi: CIPHER_TRADE_ABI,
        functionName: isStaked ? "unstake" : "stake",
      });
      setOk(isStaked ? "Unstaked." : "Staked. You now earn 18% performance fee.");
      refetchStake();
    } catch (e: unknown) {
      setErr("Error: " + (e instanceof Error ? e.message.slice(0, 100) : String(e)));
    }
    setLoading(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: SANS }}>

      {/* ── Status bar ── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10,
      }}>
        {[
          { label: "Position", value: isOpen ? "OPEN" : "CLOSED", color: isOpen ? GREEN : MUTED },
          { label: "Entry price", value: isOpen ? "$" + entryPrice.toFixed(2) : "—", color: "#eef2f6" },
          { label: "Followers", value: (followerCount ?? 0n).toString() + " / 20", color: "#eef2f6" },
          { label: "Fee tier", value: isStaked ? "18% staked" : "8% unstaked", color: isStaked ? AMBER : MUTED },
        ].map((s) => (
          <div key={s.label} style={{ background: "#0f141a", border: "1px solid #1a2030", borderRadius: 11, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Track record ── */}
      {totalTrades > 0n && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ background: "#0f141a", border: "1px solid #1a2030", borderRadius: 11, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 5 }}>Trades settled</div>
            <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: "#eef2f6" }}>{totalTrades.toString()}</div>
          </div>
          <div style={{ background: "#0f141a", border: "1px solid #1a2030", borderRadius: 11, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 5 }}>Win rate</div>
            <div style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: GREEN }}>{winRateStr}</div>
          </div>
        </div>
      )}

      {/* ── Open position form ── */}
      {!isOpen && (
        <div style={{ background: "#12181f", border: "1px solid #232c37", borderRadius: 16, padding: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Open encrypted position</div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 20 }}>Direction and size are FHE-encrypted in your browser. Nobody sees them while the trade is open.</div>

          {/* direction */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 8 }}>Direction</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["long", "short"] as const).map((d) => (
                <button key={d} onClick={() => setDirection(d)} style={{
                  flex: 1, padding: "12px 0", borderRadius: 11, fontWeight: 700, fontSize: 13, cursor: "pointer",
                  border: direction === d ? "none" : "1px solid #232c37",
                  background: direction === d ? (d === "long" ? "#22c55e" : "#ef4444") : "transparent",
                  color: direction === d ? "#fff" : MUTED, transition: "all .2s", fontFamily: SANS,
                }}>
                  {d === "long" ? "▲ LONG" : "▼ SHORT"}
                </button>
              ))}
            </div>
          </div>

          {/* size */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 8 }}>Size (cUSDT units)</label>
            <input
              type="number"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="e.g. 1000"
              style={{
                width: "100%", background: "#0f141a", border: "1px solid #232c37", borderRadius: 10,
                padding: "12px 14px", color: "#eef2f6", fontSize: 14, fontFamily: MONO, outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* FHE notice */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#241b0c", border: "1px solid #5e4a24", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#fbbf24" }}>
            <span>🔒</span>
            <span>Encrypted client-side via Zama FHEVM before broadcast</span>
          </div>

          <button onClick={handleOpenPosition} disabled={loading || !size} style={{
            width: "100%", padding: "14px 0", borderRadius: 11, border: "none",
            background: size ? AMBER : "#1a2030",
            color: size ? "#fff" : MUTED, fontSize: 14, fontWeight: 600,
            cursor: size ? "pointer" : "not-allowed", transition: "all .2s", fontFamily: SANS,
            boxShadow: size ? "0 6px 24px -8px rgba(245,158,11,.55)" : "none",
          }}>
            {loading ? status || "Processing…" : "Encrypt & open position →"}
          </button>
        </div>
      )}

      {/* ── Close position ── */}
      {isOpen && (
        <div style={{ background: "#12181f", border: "1px solid #232c37", borderRadius: 16, padding: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, boxShadow: "0 0 8px #4ade80" }} />
            <div style={{ fontSize: 15, fontWeight: 600 }}>Position is sealed on-chain</div>
          </div>
          <div style={{ background: "#0f141a", border: "1px solid #1a2030", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: MUTED }}>Direction</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: AMBER }}>🔒 encrypted</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: MUTED }}>Size</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: AMBER }}>🔒 encrypted</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: MUTED }}>Entry price</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: "#eef2f6" }}>${entryPrice.toFixed(2)}</span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: MUTED, marginBottom: 16 }}>
            Closing marks your values as decryptable. The KMS decrypts and admin settles P&L to your followers.
          </div>
          <button onClick={handleClose} disabled={loading} style={{
            width: "100%", padding: "13px 0", borderRadius: 11, border: "1px solid #4a1515",
            background: "#1f0a0a", color: "#fca5a5", fontSize: 14, fontWeight: 600,
            cursor: "pointer", transition: "all .2s", fontFamily: SANS,
          }}>
            {loading ? status : "Close position"}
          </button>
        </div>
      )}

      {/* ── Staking ── */}
      <div style={{ background: "#12181f", border: "1px solid " + (isStaked ? "#5e4a24" : "#232c37"), borderRadius: 16, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Staking</div>
            <div style={{ fontSize: 12, color: MUTED, maxWidth: 320 }}>
              Stake 100 cUSDT to earn 18% performance fee and boost your trust score. Your stake covers partial losses for followers.
            </div>
          </div>
          <div style={{
            fontFamily: MONO, fontSize: 11, fontWeight: 600,
            color: isStaked ? AMBER : MUTED,
            background: isStaked ? "#241b0c" : "#111418",
            border: "1px solid " + (isStaked ? "#5e4a24" : "#1a2030"),
            padding: "4px 10px", borderRadius: 8, whiteSpace: "nowrap",
          }}>
            {isStaked ? "18% fee" : "8% fee"}
          </div>
        </div>
        <button onClick={handleStake} disabled={loading || !!isOpen} style={{
          width: "100%", padding: "12px 0", borderRadius: 10, border: "1px solid " + (isStaked ? "#5e4a24" : "#232c37"),
          background: isStaked ? "#241b0c" : "#0f141a",
          color: isStaked ? AMBER : "#eef2f6",
          fontSize: 13, fontWeight: 600, cursor: isOpen ? "not-allowed" : "pointer",
          opacity: isOpen ? 0.5 : 1, transition: "all .2s", fontFamily: SANS,
        }}>
          {isStaked ? "Unstake" : "Stake 100 cUSDT"}
        </button>
        {isOpen && <div style={{ fontSize: 11, color: MUTED, marginTop: 8, textAlign: "center" }}>Close position first</div>}
      </div>

      {/* ── Status message ── */}
      {status && !loading && (
        <div style={{ textAlign: "center", fontSize: 12, fontFamily: MONO, color: statusOk ? GREEN : RED, padding: "10px 16px", background: statusOk ? "#0f1f17" : "#1f0a0a", border: "1px solid " + (statusOk ? "#1f4630" : "#4a1515"), borderRadius: 10 }}>
          {status}
        </div>
      )}
    </div>
  );
}
