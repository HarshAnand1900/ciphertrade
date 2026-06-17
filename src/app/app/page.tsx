"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, useWalletClient } from "wagmi";
import Link from "next/link";
import { CIPHER_TRADE_ADDRESS, CIPHER_TRADE_ABI } from "@/lib/contract";

// ─── design tokens ────────────────────────────────────────────────────────────
const MONO = "var(--font-jetbrains-mono), monospace";
const SANS = "var(--font-space-grotesk), system-ui, sans-serif";
const AMBER = "#f59e0b";
const GREEN = "#4ade80";
const RED = "#ef4444";
const RED_SOFT = "#fca5a5";
const MUTED = "#7d8896";
const BG = "#08090c";
const CARD = "#0f151d";
const CARD2 = "#12181f";
const INNER = "#0a0e14";
const BORDER = "#1e2a36";
const BORDER2 = "#232c37";

type Tab = "chart" | "discover" | "following" | "portfolio" | "leaderboard";
type Dir = "LONG" | "SHORT";

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmt(addr: string) { return addr.slice(0, 6) + "…" + addr.slice(-4); }
function initial(addr: string) { return addr.slice(2, 3).toUpperCase(); }

// ─── Candle chart canvas ──────────────────────────────────────────────────────
interface Candle { o: number; h: number; l: number; c: number; v: number; t: number }
function genCandles(n: number): Candle[] {
  const cs: Candle[] = []; let price = 1000;
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const bias = Math.random() > 0.47 ? 1 : -1;
    const move = (Math.random() * 18 + 2) * bias;
    const close = Math.max(860, Math.min(1200, price + move));
    const wick = Math.random() * 10;
    cs.push({ o: price, h: Math.max(price, close) + wick, l: Math.min(price, close) - wick, c: close, v: 600 + Math.random() * 2400, t: now - (n - i) * 3600000 });
    price = close;
  }
  return cs;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// ─── main page ────────────────────────────────────────────────────────────────
export default function AppPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("chart");

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#eef2f6", fontFamily: SANS }}>
      {/* header */}
      <header style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(14px)", background: "rgba(8,9,12,.82)", borderBottom: "1px solid #14181f" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 800, fontSize: 15 }}>C</div>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#eef2f6" }}>CipherTrade</span>
            </Link>
            {isConnected && (
              <nav style={{ display: "flex", gap: 2 }}>
                {(["chart", "discover", "following", "portfolio", "leaderboard"] as Tab[]).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={{
                    padding: "5px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer",
                    background: tab === t ? "#1e2a36" : "transparent",
                    color: tab === t ? "#eef2f6" : MUTED,
                  }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </nav>
            )}
          </div>
          <ConnectButton />
        </div>
      </header>

      {!isConnected && (
        <div style={{ textAlign: "center", padding: "140px 24px" }}>
          <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 12 }}>Connect your wallet</div>
          <p style={{ color: "#aeb8c4", maxWidth: 380, margin: "0 auto 28px", lineHeight: 1.6 }}>Connect to open an encrypted position or copy a ranked trader on Sepolia.</p>
          <ConnectButton />
        </div>
      )}

      {isConnected && (
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 20px 60px" }}>
          {tab === "chart" && <ChartTab address={address!} />}
          {tab === "discover" && <DiscoverTab address={address!} />}
          {tab === "following" && <FollowingTab address={address!} />}
          {tab === "portfolio" && <PortfolioTab address={address!} />}
          {tab === "leaderboard" && <LeaderboardTab />}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ChartTab({ address }: { address: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [candles] = useState(() => genCandles(80));
  const [price] = useState(candles[candles.length - 1].c);
  const [tf, setTf] = useState("1H");
  const animRef = useRef<number>(0);

  // contract reads
  const { data: positionData } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getPosition", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: [bigint, bigint, boolean, boolean] | undefined };
  const { data: isOpen, refetch: refetchOpen } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "isPositionOpen", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: boolean | undefined; refetch: () => void };
  const { data: stakedBalance, refetch: refetchStake } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "stakedBalance", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: bigint | undefined; refetch: () => void };
  const { data: followerCount } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: bigint | undefined };
  const { data: traderStats } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: [bigint, bigint, bigint] | undefined };

  const isStaked = !!(stakedBalance && stakedBalance > 0n);
  const entryPrice = positionData ? Number(positionData[1]) / 1e6 : 0;
  const position = isOpen ? { dir: "LONG" as Dir, entry: entryPrice } : null;
  const [totalTrades, wins] = traderStats ?? [0n, 0n];

  // form state
  const [dir, setDir] = useState<Dir>("LONG");
  const [size, setSize] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusOk, setStatusOk] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const [encFrame, setEncFrame] = useState(0);

  const { writeContractAsync } = useWriteContract();
  const { data: walletClient } = useWalletClient();

  function setErr(m: string) { setStatusMsg(m); setStatusOk(false); }
  function setOk(m: string) { setStatusMsg(m); setStatusOk(true); }

  // draw chart
  const drawChart = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const W = rect.width, H = rect.height;
    if (!W || !H) return;
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const MT = 14, MR = 68, MB = 26, ML = 4, VOLH = Math.floor(H * 0.14);
    const CW = W - ML - MR, CH = H - MT - MB - VOLH - 6, CT = MT, CB = MT + CH, VT = CB + 6, VB = H - MB;
    const VISIBLE = 62;
    const cs = candles.slice(-VISIBLE);
    if (!cs.length) return;
    const prices = cs.flatMap(c => [c.h, c.l]);
    let maxP = Math.max(...prices), minP = Math.min(...prices);
    const pad = (maxP - minP) * 0.08; maxP += pad; minP -= pad;
    const maxV = Math.max(...cs.map(c => c.v));
    const py = (p: number) => CT + CH * (1 - (p - minP) / (maxP - minP));
    const cx = (i: number) => ML + (i + 0.5) * (CW / VISIBLE);
    const cw2 = CW / VISIBLE, bw = Math.max(1, cw2 * 0.68);
    ctx.fillStyle = "#0c1017"; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i <= 5; i++) {
      const p = minP + (maxP - minP) * (i / 5), y = py(p);
      ctx.strokeStyle = "#161e28"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(ML, y); ctx.lineTo(ML + CW, y); ctx.stroke();
      ctx.fillStyle = "#3d4a58"; ctx.font = `9.5px ${MONO}`; ctx.textAlign = "left";
      ctx.fillText("$" + Math.round(p), ML + CW + 5, y + 3.5);
    }
    cs.forEach((c, i) => {
      ctx.fillStyle = c.c >= c.o ? "rgba(34,197,94,.25)" : "rgba(239,68,68,.25)";
      ctx.fillRect(cx(i) - bw / 2, VT + (VB - VT) * (1 - c.v / maxV), bw, (VB - VT) * c.v / maxV);
    });
    cs.forEach((c, i) => {
      const up = c.c >= c.o, col = up ? "#22c55e" : "#ef4444", x2 = cx(i);
      ctx.strokeStyle = up ? "rgba(34,197,94,.65)" : "rgba(239,68,68,.65)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x2, py(c.h)); ctx.lineTo(x2, py(c.l)); ctx.stroke();
      ctx.fillStyle = col; ctx.globalAlpha = 0.85;
      ctx.fillRect(x2 - bw / 2, Math.min(py(c.o), py(c.c)), bw, Math.max(1.5, Math.abs(py(c.o) - py(c.c))));
      ctx.globalAlpha = 1;
    });
    if (position) {
      const ey = py(position.entry), cy2 = py(price);
      const inProfit = position.dir === "LONG" ? price > position.entry : price < position.entry;
      const zT = Math.min(ey, cy2), zB = Math.max(ey, cy2);
      ctx.save();
      ctx.fillStyle = inProfit ? "rgba(34,197,94,.06)" : "rgba(239,68,68,.06)";
      ctx.fillRect(ML, zT, CW, zB - zT);
      ctx.strokeStyle = inProfit ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)"; ctx.lineWidth = 1;
      for (let x3 = ML; x3 < ML + CW; x3 += 14) { ctx.beginPath(); ctx.moveTo(x3, zT); ctx.lineTo(x3 + 10, zB); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = "rgba(251,191,36,.5)"; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(ML, ey); ctx.lineTo(ML + CW, ey); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = "#1a1606"; ctx.strokeStyle = "#6b5320"; ctx.lineWidth = 1;
      rr(ctx, ML + 10, ey - 16, 160, 16, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fbbf24"; ctx.font = `9.5px ${MONO}`; ctx.textAlign = "left";
      ctx.fillText("🔒 SEALED ENTRY · $" + position.entry.toFixed(2), ML + 16, ey - 4);
    }
    if (encrypting) {
      const HX = "0123456789ABCDEF";
      ctx.globalAlpha = 0.45; ctx.font = `10px ${MONO}`; ctx.textAlign = "left";
      for (let row = 0; row < 8; row++) for (let col = 0; col < 14; col++) {
        const seed = (encFrame + row * 7 + col * 13) % 16;
        ctx.fillStyle = row % 2 === 0 ? "rgba(251,191,36,.6)" : "rgba(91,97,104,.5)";
        ctx.fillText("0x" + HX[seed] + HX[(seed + 5) % 16], ML + col * (CW / 14), CT + 20 + row * 32);
      }
      ctx.globalAlpha = 1;
    }
    const cy3 = py(price);
    ctx.strokeStyle = AMBER; ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(ML, cy3); ctx.lineTo(ML + CW, cy3); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = AMBER; rr(ctx, ML + CW + 1, cy3 - 10, MR - 2, 20, 5); ctx.fill();
    ctx.fillStyle = "#0c0a06"; ctx.font = `bold 10.5px ${MONO}`; ctx.textAlign = "center";
    ctx.fillText("$" + price.toFixed(2), ML + CW + 1 + (MR - 2) / 2, cy3 + 4);
  }, [candles, price, position, encrypting, encFrame]);

  useEffect(() => {
    const loop = () => {
      if (encrypting) setEncFrame(f => f + 1);
      drawChart();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [drawChart, encrypting]);

  async function handleOpen() {
    if (!size || !walletClient) return;
    setLoading(true); setStatusMsg(""); setStatusOk(false); setEncrypting(true);
    try {
      setStatusMsg("Initializing FHE…");
      const { createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
      const fhevm = await createInstance({ ...SepoliaConfig, network: walletClient as Parameters<typeof createInstance>[0]["network"] });
      setStatusMsg("Encrypting position…");
      const input = fhevm.createEncryptedInput(CIPHER_TRADE_ADDRESS, address);
      input.addBool(dir === "LONG"); input.add64(BigInt(Math.floor(Number(size))));
      const encrypted = await input.encrypt();
      setStatusMsg("Sending transaction…");
      await writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "openPosition", args: [encrypted.handles[0], encrypted.handles[1], encrypted.inputProof] });
      setOk("Position sealed on-chain. Direction and size are encrypted."); setSize(""); refetchOpen();
    } catch (e: unknown) { setErr("Error: " + (e instanceof Error ? e.message.slice(0, 100) : String(e))); }
    setEncrypting(false); setLoading(false);
  }

  async function handleClose() {
    setLoading(true); setStatusMsg("Closing…");
    try {
      await writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "closePosition" });
      setOk("Position closed. Awaiting KMS decryption and settlement."); refetchOpen();
    } catch (e: unknown) { setErr("Error: " + (e instanceof Error ? e.message.slice(0, 100) : String(e))); }
    setLoading(false);
  }

  async function handleStake() {
    setLoading(true);
    try {
      await writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: isStaked ? "unstake" : "stake" });
      setOk(isStaked ? "Unstaked." : "Staked. You now earn 18% performance fee."); refetchStake();
    } catch (e: unknown) { setErr("Error: " + (e instanceof Error ? e.message.slice(0, 100) : String(e))); }
    setLoading(false);
  }

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const change24 = ((last.c - prev.o) / prev.o * 100).toFixed(2);
  const isUp = last.c >= prev.o;
  const winRate = totalTrades > 0n ? Math.round(Number(wins) / Number(totalTrades) * 100) : 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>
      {/* left: chart area */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* pair strip */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#627eea,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>Ξ</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>ETH / USDT</div>
              <div style={{ fontSize: 11, color: MUTED }}>Simulated · Sepolia</div>
            </div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700 }}>${price.toFixed(2)}</div>
          <div style={{ fontSize: 13, fontFamily: MONO, color: isUp ? GREEN : RED_SOFT, background: isUp ? "rgba(34,197,94,.1)" : "rgba(239,68,68,.1)", padding: "4px 10px", borderRadius: 8 }}>
            {isUp ? "▲" : "▼"} {change24}%
          </div>
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            {["15m", "1H", "4H", "1D"].map(t => (
              <button key={t} onClick={() => setTf(t)} style={{ padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: MONO, border: "none", cursor: "pointer", background: tf === t ? "#1e2a36" : "transparent", color: tf === t ? "#eef2f6" : MUTED }}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* OHLC */}
        <div style={{ display: "flex", gap: 16, padding: "0 4px", fontSize: 11, fontFamily: MONO, color: MUTED }}>
          {[["O", last.o], ["H", last.h], ["L", last.l], ["C", last.c]].map(([k, v]) => (
            <span key={k as string}><span style={{ marginRight: 4 }}>{k}</span><span style={{ color: "#eef2f6" }}>${(v as number).toFixed(2)}</span></span>
          ))}
        </div>

        {/* canvas */}
        <div style={{ background: "#0c1017", border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", position: "relative" }}>
          <canvas ref={canvasRef} style={{ width: "100%", height: 380, display: "block" }} />
          {encrypting && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(8,9,12,.45)", backdropFilter: "blur(2px)" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 13, fontFamily: MONO, color: AMBER, marginBottom: 6 }}>Encrypting position…</div>
                <div style={{ fontSize: 11, color: MUTED }}>FHE sealing direction &amp; size</div>
              </div>
            </div>
          )}
        </div>

        {/* mempool strip */}
        <div style={{ background: INNER, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 14px", overflow: "hidden", position: "relative" }}>
          <style>{`@keyframes ctMarq{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}`}</style>
          <div style={{ display: "flex", gap: 28, animation: "ctMarq 18s linear infinite", whiteSpace: "nowrap", fontSize: 11, fontFamily: MONO, color: "#3d4a58" }}>
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} style={{ color: i % 3 === 0 ? "#fbbf24" : "#3d4a58" }}>
                0x{Math.random().toString(16).slice(2, 10).toUpperCase()} · ebool · euint64 · {["SEALED", "PENDING", "KMS_Q"][i % 3]}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* right: side panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* stats strip */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { label: "Fee tier", value: isStaked ? "18% staked" : "8% unstaked", color: isStaked ? AMBER : MUTED },
            { label: "Followers", value: (followerCount ?? 0n).toString() + " / 20", color: "#eef2f6" },
            { label: "Trades settled", value: totalTrades.toString(), color: "#eef2f6" },
            { label: "Win rate", value: totalTrades > 0n ? winRate + "%" : "—", color: GREEN },
          ].map(s => (
            <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 11, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* order form or position card */}
        {!isOpen ? (
          <div style={{ background: CARD2, border: `1px solid ${BORDER2}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Open encrypted position</div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 16, lineHeight: 1.5 }}>Direction and size are FHE-encrypted in your browser before broadcast.</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              {(["LONG", "SHORT"] as Dir[]).map(d => (
                <button key={d} onClick={() => setDir(d)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", border: dir === d ? "none" : `1px solid ${BORDER2}`, background: dir === d ? (d === "LONG" ? "#22c55e" : "#ef4444") : "transparent", color: dir === d ? "#fff" : MUTED, fontFamily: SANS }}>
                  {d === "LONG" ? "▲ LONG" : "▼ SHORT"}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
              {["100", "500", "1000", "2500"].map(v => (
                <button key={v} onClick={() => setSize(v)} style={{ padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, fontFamily: MONO, cursor: "pointer", border: `1px solid ${size === v ? AMBER : BORDER2}`, background: size === v ? "#241b0c" : INNER, color: size === v ? AMBER : MUTED }}>
                  {v}
                </button>
              ))}
            </div>
            <input type="number" value={size} onChange={e => setSize(e.target.value)} placeholder="Custom size (cUSDT)" style={{ width: "100%", background: INNER, border: `1px solid ${BORDER2}`, borderRadius: 9, padding: "11px 12px", color: "#eef2f6", fontSize: 13, fontFamily: MONO, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#241b0c", border: "1px solid #5e4a24", borderRadius: 9, padding: "9px 12px", marginBottom: 14, fontSize: 11, color: "#fbbf24" }}>
              <span>🔒</span><span>Encrypted client-side via Zama FHEVM</span>
            </div>
            <button onClick={handleOpen} disabled={loading || !size} style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none", background: size ? AMBER : "#1a2030", color: size ? "#0c0a06" : MUTED, fontSize: 14, fontWeight: 700, cursor: size ? "pointer" : "not-allowed", fontFamily: SANS, boxShadow: size ? "0 6px 24px -8px rgba(245,158,11,.55)" : "none" }}>
              {loading ? (statusMsg || "Processing…") : "Encrypt & open position →"}
            </button>
          </div>
        ) : (
          <div style={{ background: CARD2, border: `1px solid ${BORDER2}`, borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, boxShadow: "0 0 8px #4ade80" }} />
              <div style={{ fontSize: 14, fontWeight: 700 }}>Position sealed on-chain</div>
            </div>
            <div style={{ background: INNER, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
              {[["Direction", "🔒 encrypted", AMBER], ["Size", "🔒 encrypted", AMBER], ["Entry price", "$" + entryPrice.toFixed(2), "#eef2f6"]].map(([k, v, c]) => (
                <div key={k as string} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: MUTED }}>{k}</span>
                  <span style={{ fontFamily: MONO, color: c as string }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 14, lineHeight: 1.5 }}>Closing marks values as decryptable. KMS decrypts and admin settles P&L.</div>
            <button onClick={handleClose} disabled={loading} style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: "1px solid #4a1515", background: "#1f0a0a", color: RED_SOFT, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: SANS }}>
              {loading ? statusMsg : "Close position"}
            </button>
          </div>
        )}

        {/* stake card */}
        <div style={{ background: CARD2, border: `1px solid ${isStaked ? "#5e4a24" : BORDER2}`, borderRadius: 14, padding: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Staking</div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: isStaked ? AMBER : MUTED, background: isStaked ? "#241b0c" : INNER, border: `1px solid ${isStaked ? "#5e4a24" : BORDER}`, padding: "3px 9px", borderRadius: 7 }}>{isStaked ? "18% fee" : "8% fee"}</div>
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginBottom: 12, lineHeight: 1.5 }}>Stake 100 cUSDT to earn 18% performance fee and boost follower trust.</div>
          <button onClick={handleStake} disabled={loading || !!isOpen} style={{ width: "100%", padding: "11px 0", borderRadius: 9, border: `1px solid ${isStaked ? "#5e4a24" : BORDER2}`, background: isStaked ? "#241b0c" : INNER, color: isStaked ? AMBER : "#eef2f6", fontSize: 13, fontWeight: 600, cursor: isOpen ? "not-allowed" : "pointer", opacity: isOpen ? 0.5 : 1, fontFamily: SANS }}>
            {isStaked ? "Unstake" : "Stake 100 cUSDT"}
          </button>
          {isOpen && <div style={{ fontSize: 10, color: MUTED, marginTop: 6, textAlign: "center" }}>Close position first</div>}
        </div>

        {/* status */}
        {statusMsg && !loading && (
          <div style={{ fontSize: 12, fontFamily: MONO, color: statusOk ? GREEN : RED_SOFT, padding: "10px 14px", background: statusOk ? "#0f1f17" : "#1f0a0a", border: `1px solid ${statusOk ? "#1f4630" : "#4a1515"}`, borderRadius: 10, textAlign: "center" }}>
            {statusMsg}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISCOVER TAB
// ═══════════════════════════════════════════════════════════════════════════════
function DiscoverTab({ address }: { address: string }) {
  const [following, setFollowing] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("ct_following") || "[]")); } catch { return new Set(); }
  });
  const [followModal, setFollowModal] = useState<string | null>(null);
  const [allocation, setAllocation] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const { data: traderAddrs } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getTraders", query: {} }) as { data: readonly `0x${string}`[] | undefined };
  const { writeContractAsync } = useWriteContract();

  function toggleFollow(addr: string) {
    setFollowing(prev => {
      const next = new Set(prev);
      next.has(addr) ? next.delete(addr) : next.add(addr);
      localStorage.setItem("ct_following", JSON.stringify([...next]));
      return next;
    });
  }

  async function confirmFollow() {
    if (!followModal) return;
    setLoading(true);
    try {
      await writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "followTrader", args: [followModal as `0x${string}`, BigInt(allocation)] });
      toggleFollow(followModal); setFollowModal(null);
    } catch (e: unknown) { setStatusMsg("Error: " + (e instanceof Error ? e.message.slice(0, 80) : String(e))); }
    setLoading(false);
  }

  const traders = traderAddrs ?? [];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Discover Traders</div>
        <div style={{ fontSize: 13, color: MUTED }}>{traders.length} traders registered on Sepolia</div>
      </div>

      {traders.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 24px", color: MUTED }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#eef2f6", marginBottom: 8 }}>No traders registered yet</div>
          <div style={{ fontSize: 13 }}>Open an encrypted position in the Chart tab to appear here.</div>
        </div>
      )}

      {traders.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
          {traders.map((addr, i) => (
            <TraderCard key={addr} addr={addr} rank={i + 1} isFollowing={following.has(addr)} isSelf={addr.toLowerCase() === address.toLowerCase()} onFollow={() => setFollowModal(addr)} onUnfollow={() => toggleFollow(addr)} />
          ))}
        </div>
      )}

      {statusMsg && <div style={{ marginTop: 16, fontSize: 12, fontFamily: MONO, color: RED_SOFT, padding: "10px 14px", background: "#1f0a0a", border: "1px solid #4a1515", borderRadius: 10, textAlign: "center" }}>{statusMsg}</div>}

      {/* follow modal */}
      {followModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(6,9,13,.85)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ width: 420, maxWidth: "100%", background: "#0f151d", border: "1px solid #6b5320", borderRadius: 18, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 17 }}>{initial(followModal)}</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>Follow {fmt(followModal)}</div>
                <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>Sepolia testnet</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.55, margin: "12px 0 18px" }}>Your allocation is copied proportionally into each new position. You never see direction or size — settlement pays pro-rata minus the performance fee.</div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: MUTED }}>Allocation</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: MONO }}>{allocation} <span style={{ fontSize: 12, color: MUTED }}>cUSDT</span></div>
            </div>
            <input type="range" min={100} max={10000} step={100} value={allocation} onChange={e => setAllocation(Number(e.target.value))} style={{ width: "100%", marginBottom: 20 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setFollowModal(null)} style={{ flex: 1, padding: 12, background: "#131a22", border: `1px solid ${BORDER}`, color: "#aeb8c4", fontSize: 13, fontWeight: 600, borderRadius: 11, cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmFollow} disabled={loading} style={{ flex: 2, padding: 12, background: AMBER, border: "none", color: "#0c0a06", fontSize: 13, fontWeight: 700, borderRadius: 11, cursor: "pointer" }}>{loading ? "Confirming…" : "Confirm follow"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TraderCard({ addr, rank, isFollowing, isSelf, onFollow, onUnfollow }: { addr: string; rank: number; isFollowing: boolean; isSelf: boolean; onFollow: () => void; onUnfollow: () => void }) {
  const { data: stats } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [addr as `0x${string}`], query: {} }) as { data: [bigint, bigint, bigint] | undefined };
  const { data: posOpen } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "isPositionOpen", args: [addr as `0x${string}`], query: {} }) as { data: boolean | undefined };
  const { data: fCount } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [addr as `0x${string}`], query: {} }) as { data: bigint | undefined };

  const [total, wins, pnlBps] = stats ?? [0n, 0n, 0n];
  const winRate = total > 0n ? Math.round(Number(wins) / Number(total) * 100) : 0;
  const pnlPct = total > 0n ? (Number(pnlBps) / 100).toFixed(1) : "0.0";
  const isPos = Number(pnlBps) >= 0;

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg,${AMBER},#fbbf24)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 800, fontSize: 18 }}>{initial(addr)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>{fmt(addr)}</div>
            {posOpen && <div style={{ fontSize: 9, background: "rgba(34,197,94,.15)", color: GREEN, border: "1px solid rgba(34,197,94,.3)", padding: "2px 7px", borderRadius: 5 }}>LIVE</div>}
            {isSelf && <div style={{ fontSize: 9, background: "#241b0c", color: AMBER, border: "1px solid #5e4a24", padding: "2px 7px", borderRadius: 5 }}>YOU</div>}
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>Rank #{rank} · {(fCount ?? 0n).toString()} followers</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[["Trades", total.toString(), "#eef2f6"], ["Win rate", total > 0n ? winRate + "%" : "—", GREEN], ["Net P&L", (isPos ? "+" : "") + pnlPct + "%", isPos ? GREEN : RED_SOFT]].map(([k, v, c]) => (
          <div key={k as string} style={{ background: INNER, borderRadius: 9, padding: "10px 10px" }}>
            <div style={{ fontSize: 9, color: MUTED, marginBottom: 3 }}>{k}</div>
            <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: c as string }}>{v}</div>
          </div>
        ))}
      </div>
      {!isSelf && (
        <button onClick={isFollowing ? onUnfollow : onFollow} style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: isFollowing ? `1px solid ${BORDER}` : "none", background: isFollowing ? "transparent" : AMBER, color: isFollowing ? MUTED : "#0c0a06", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: SANS }}>
          {isFollowing ? "Following ✓" : "Follow trader"}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOWING TAB
// ═══════════════════════════════════════════════════════════════════════════════
function FollowingTab({ address }: { address: string }) {
  const [following] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("ct_following") || "[]"); } catch { return []; }
  });

  const { data: traderAddrs } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getTraders", query: {} }) as { data: readonly `0x${string}`[] | undefined };
  const followed = (traderAddrs ?? []).filter(a => following.includes(a.toLowerCase()) || following.includes(a));

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Following</div>
        <div style={{ fontSize: 13, color: MUTED }}>Traders you&apos;re copying · allocations mirror each new sealed position</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[["Copying", followed.length.toString(), "#eef2f6"], ["Your address", fmt(address), AMBER], ["Protocol", "Sepolia FHEVM", "#eef2f6"], ["Privacy", "ebool + euint64", GREEN]].map(([k, v, c]) => (
          <div key={k as string} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 16px" }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 6 }}>{k}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: c as string }}>{v}</div>
          </div>
        ))}
      </div>
      {followed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: MUTED }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#eef2f6", marginBottom: 6 }}>Not following anyone yet</div>
          <div style={{ fontSize: 13 }}>Go to Discover to follow a trader.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {followed.map(addr => <FollowedRow key={addr} addr={addr} />)}
        </div>
      )}
    </div>
  );
}

function FollowedRow({ addr }: { addr: string }) {
  const { data: stats } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [addr as `0x${string}`], query: {} }) as { data: [bigint, bigint, bigint] | undefined };
  const { data: posOpen } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "isPositionOpen", args: [addr as `0x${string}`], query: {} }) as { data: boolean | undefined };

  const [total, wins, pnlBps] = stats ?? [0n, 0n, 0n];
  const winRate = total > 0n ? Math.round(Number(wins) / Number(total) * 100) : 0;

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 800, fontSize: 16 }}>{initial(addr)}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 600 }}>{fmt(addr)}</div>
        <div style={{ fontSize: 11, color: MUTED }}>{total.toString()} trades · {winRate}% win</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, color: Number(pnlBps) >= 0 ? GREEN : RED_SOFT }}>{Number(pnlBps) >= 0 ? "+" : ""}{(Number(pnlBps) / 100).toFixed(1)}%</div>
        <div style={{ fontSize: 10, color: MUTED }}>net P&L</div>
      </div>
      {posOpen && <div style={{ fontSize: 10, background: "rgba(34,197,94,.15)", color: GREEN, border: "1px solid rgba(34,197,94,.3)", padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>LIVE 🔒</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO TAB
// ═══════════════════════════════════════════════════════════════════════════════
function PortfolioTab({ address }: { address: string }) {
  const { data: positionData } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getPosition", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: [bigint, bigint, boolean, boolean] | undefined };
  const { data: isOpen } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "isPositionOpen", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: boolean | undefined };
  const { data: stakedBalance } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "stakedBalance", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: bigint | undefined };
  const { data: traderStats } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: [bigint, bigint, bigint] | undefined };
  const { data: followerCount } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: bigint | undefined };
  const { data: history } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getTradeHistory", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: readonly { entryPrice: bigint; exitPrice: bigint; direction: boolean; size: bigint; pnlBps: bigint; timestamp: bigint }[] | undefined };

  const [total, wins, pnlBps] = traderStats ?? [0n, 0n, 0n];
  const winRate = total > 0n ? Math.round(Number(wins) / Number(total) * 100) : 0;
  const isStaked = !!(stakedBalance && stakedBalance > 0n);
  const entryPrice = positionData ? Number(positionData[1]) / 1e6 : 0;

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Portfolio</div>
        <div style={{ fontSize: 13, color: MUTED, fontFamily: MONO }}>{fmt(address)}</div>
      </div>

      {/* stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          ["Trades settled", total.toString(), "#eef2f6"],
          ["Win rate", total > 0n ? winRate + "%" : "—", GREEN],
          ["Net P&L", (Number(pnlBps) >= 0 ? "+" : "") + (Number(pnlBps) / 100).toFixed(1) + "%", Number(pnlBps) >= 0 ? GREEN : RED_SOFT],
          ["Followers", (followerCount ?? 0n).toString(), AMBER],
        ].map(([k, v, c]) => (
          <div key={k as string} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "18px 16px" }}>
            <div style={{ fontSize: 10, color: MUTED, marginBottom: 6 }}>{k}</div>
            <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800, color: c as string }}>{v}</div>
          </div>
        ))}
      </div>

      {/* active position + stake */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div style={{ background: CARD, border: `1px solid ${isOpen ? "rgba(34,197,94,.3)" : BORDER}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
            Active position
            {isOpen && <div style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN, boxShadow: "0 0 6px #4ade80" }} />}
          </div>
          {isOpen ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[["Direction", "🔒 encrypted"], ["Size", "🔒 encrypted"], ["Entry", "$" + entryPrice.toFixed(2)]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: MUTED }}>{k}</span>
                  <span style={{ fontFamily: MONO, color: k === "Entry" ? "#eef2f6" : AMBER }}>{v}</span>
                </div>
              ))}
            </div>
          ) : <div style={{ color: MUTED, fontSize: 13 }}>No open position</div>}
        </div>
        <div style={{ background: CARD, border: `1px solid ${isStaked ? "#5e4a24" : BORDER}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Stake</div>
          <div style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, color: isStaked ? AMBER : MUTED, marginBottom: 6 }}>
            {isStaked ? "100 cUSDT" : "—"}
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>{isStaked ? "Earning 18% performance fee" : "Stake to unlock 18% fee tier"}</div>
        </div>
      </div>

      {/* trade history */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Trade history</div>
        {!history || history.length === 0 ? (
          <div style={{ color: MUTED, fontSize: 13, textAlign: "center", padding: "30px 0" }}>No settled trades yet</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  {["#", "Direction", "Entry", "Exit", "Size", "P&L", "Date"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: MUTED, fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((tr, i) => {
                  const pnl = Number(tr.pnlBps) / 100;
                  const isWin = pnl > 0;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid ${INNER}` }}>
                      <td style={{ padding: "10px 12px", fontFamily: MONO, color: MUTED }}>{history.length - i}</td>
                      <td style={{ padding: "10px 12px" }}><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: tr.direction ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)", color: tr.direction ? GREEN : RED }}>{tr.direction ? "LONG" : "SHORT"}</span></td>
                      <td style={{ padding: "10px 12px", fontFamily: MONO }}>${(Number(tr.entryPrice) / 1e6).toFixed(2)}</td>
                      <td style={{ padding: "10px 12px", fontFamily: MONO }}>${(Number(tr.exitPrice) / 1e6).toFixed(2)}</td>
                      <td style={{ padding: "10px 12px", fontFamily: MONO }}>{tr.size.toString()}</td>
                      <td style={{ padding: "10px 12px", fontFamily: MONO, color: isWin ? GREEN : RED_SOFT, fontWeight: 700 }}>{isWin ? "+" : ""}{pnl.toFixed(1)}%</td>
                      <td style={{ padding: "10px 12px", color: MUTED }}>{new Date(Number(tr.timestamp) * 1000).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD TAB
// ═══════════════════════════════════════════════════════════════════════════════
function LeaderboardTab() {
  const [period, setPeriod] = useState<"all" | "30d" | "7d">("all");
  const { data: traderAddrs } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getTraders", query: {} }) as { data: readonly `0x${string}`[] | undefined };

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Leaderboard</div>
          <div style={{ fontSize: 13, color: MUTED }}>Ranked by net P&L · all trades settled on-chain</div>
        </div>
        <div style={{ display: "flex", gap: 6, background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 4 }}>
          {(["all", "30d", "7d"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", background: period === p ? "#1e2a36" : "transparent", color: period === p ? "#eef2f6" : MUTED }}>
              {p === "all" ? "All time" : p === "30d" ? "30D" : "7D"}
            </button>
          ))}
        </div>
      </div>

      {(!traderAddrs || traderAddrs.length === 0) ? (
        <div style={{ textAlign: "center", padding: "80px 24px", color: MUTED }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#eef2f6", marginBottom: 8 }}>No traders yet</div>
          <div style={{ fontSize: 13 }}>Be the first to open an encrypted position.</div>
        </div>
      ) : (
        <LeaderboardTable addrs={traderAddrs} />
      )}
    </div>
  );
}

function LeaderboardTable({ addrs }: { addrs: readonly `0x${string}`[] }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: INNER, borderBottom: `1px solid ${BORDER}` }}>
            {["Rank", "Trader", "Trades", "Win rate", "Net P&L", "Followers", "Status"].map(h => (
              <th key={h} style={{ padding: "12px 16px", textAlign: "left", color: MUTED, fontWeight: 600, fontSize: 11 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {addrs.map((addr, i) => <LeaderRow key={addr} addr={addr} rank={i + 1} />)}
        </tbody>
      </table>
    </div>
  );
}

function LeaderRow({ addr, rank }: { addr: string; rank: number }) {
  const { data: stats } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [addr as `0x${string}`], query: {} }) as { data: [bigint, bigint, bigint] | undefined };
  const { data: posOpen } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "isPositionOpen", args: [addr as `0x${string}`], query: {} }) as { data: boolean | undefined };
  const { data: fCount } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [addr as `0x${string}`], query: {} }) as { data: bigint | undefined };

  const [total, wins, pnlBps] = stats ?? [0n, 0n, 0n];
  const winRate = total > 0n ? Math.round(Number(wins) / Number(total) * 100) : 0;
  const pnl = Number(pnlBps) / 100;
  const isPos = pnl >= 0;

  const medalColor = rank === 1 ? "#fbbf24" : rank === 2 ? "#9ca3af" : rank === 3 ? "#b45309" : MUTED;

  return (
    <tr style={{ borderBottom: `1px solid ${INNER}`, background: rank <= 3 ? "rgba(245,158,11,.03)" : "transparent" }}>
      <td style={{ padding: "14px 16px", fontFamily: MONO, fontWeight: 700, color: medalColor, fontSize: rank <= 3 ? 16 : 13 }}>
        {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `#${rank}`}
      </td>
      <td style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 13 }}>{initial(addr)}</div>
          <span style={{ fontFamily: MONO, fontSize: 13 }}>{fmt(addr)}</span>
        </div>
      </td>
      <td style={{ padding: "14px 16px", fontFamily: MONO }}>{total.toString()}</td>
      <td style={{ padding: "14px 16px", fontFamily: MONO, color: GREEN }}>{total > 0n ? winRate + "%" : "—"}</td>
      <td style={{ padding: "14px 16px", fontFamily: MONO, fontWeight: 700, color: isPos ? GREEN : RED_SOFT }}>{isPos ? "+" : ""}{pnl.toFixed(1)}%</td>
      <td style={{ padding: "14px 16px", fontFamily: MONO }}>{(fCount ?? 0n).toString()}</td>
      <td style={{ padding: "14px 16px" }}>
        {posOpen
          ? <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: "rgba(34,197,94,.12)", color: GREEN, border: "1px solid rgba(34,197,94,.25)" }}>LIVE 🔒</span>
          : <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: INNER, color: MUTED }}>Idle</span>}
      </td>
    </tr>
  );
}
