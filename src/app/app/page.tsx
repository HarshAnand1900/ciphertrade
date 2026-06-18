"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useWriteContract, useWalletClient } from "wagmi";
import Link from "next/link";
import { CIPHER_TRADE_ADDRESS, CIPHER_TRADE_ABI } from "@/lib/contract";

// ─── tokens ───────────────────────────────────────────────────────────────────
const MONO = "var(--font-jetbrains-mono), monospace";
const SANS = "var(--font-space-grotesk), system-ui, sans-serif";
const AMBER = "#f59e0b";
const GREEN = "#4ade80";
const RED = "#ef4444";
const RED_SOFT = "#fca5a5";
const MUTED = "#7d8896";
const MUTED2 = "#5b6168";
const BG = "#08090c";
const CARD = "#0f151d";
const INNER = "#0a0e14";
const BORDER = "#1e2a36";
const BORDER2 = "#13181f";

type Tab = "chart" | "discover" | "following" | "portfolio" | "leaderboard";
type Dir = "LONG" | "SHORT";
interface Candle { o: number; h: number; l: number; c: number; v: number; t: number }

const TF_MAP: Record<string, string> = { "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d" };

function fmt(addr: string) { return addr.slice(0, 6) + "…" + addr.slice(-4); }
function initial(addr: string) { return addr.slice(2, 3).toUpperCase(); }

function genCandles(n: number): Candle[] {
  const cs: Candle[] = []; let price = 3000;
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const b = Math.random() > 0.47 ? 1 : -1;
    const move = (Math.random() * 28 + 2) * b;
    const close = Math.max(2400, Math.min(4000, price + move));
    const wick = Math.random() * 12;
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

// ─── App shell ────────────────────────────────────────────────────────────────
export default function AppPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("chart");
  const [livePrice, setLivePrice] = useState(3000);
  const [prevOpen, setPrevOpen] = useState(3000);
  const headerWsRef = useRef<WebSocket | null>(null);

  // lightweight WebSocket for header price ticker only
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket("wss://stream.binance.com:9443/ws/ethusdt@miniTicker");
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data);
          setLivePrice(parseFloat(d.c));
          setPrevOpen(parseFloat(d.o));
        } catch { /* ignore */ }
      };
      ws.onerror = () => ws.close();
      headerWsRef.current = ws;
    };
    connect();
    return () => headerWsRef.current?.close();
  }, []);

  const change24 = ((livePrice - prevOpen) / prevOpen * 100).toFixed(2);
  const isUp = livePrice >= prevOpen;

  const tabs: Tab[] = ["chart", "discover", "following", "portfolio", "leaderboard"];

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#eef2f6", fontFamily: SANS, display: "flex", flexDirection: "column" }}>
      {/* ── header ── */}
      <div style={{ height: 52, borderBottom: `1px solid ${BORDER2}`, background: "#0c1017", display: "flex", alignItems: "center", padding: "0 18px", gap: 0, flexShrink: 0 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", color: "inherit", marginRight: 20, flexShrink: 0 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 800, fontSize: 14, boxShadow: "0 0 14px rgba(245,158,11,.4)" }}>C</div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>CipherTrade</span>
        </Link>

        {isConnected && (
          <div style={{ display: "flex", background: "#131a22", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 3, gap: 2, flexShrink: 0 }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "5px 14px", borderRadius: 7, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: SANS,
                background: tab === t ? AMBER : "transparent",
                color: tab === t ? "#0c0a06" : "#aeb8c4",
              }}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <Link href="/docs" style={{ fontSize: 12, color: MUTED2, textDecoration: "none", fontFamily: MONO }}>docs</Link>
          <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600 }}>
            ${livePrice.toFixed(2)} <span style={{ fontSize: 11, color: isUp ? GREEN : RED_SOFT }}>{isUp ? "+" : ""}{change24}%</span>
          </div>
          <ConnectButton />
        </div>
      </div>

      {!isConnected && (
        <div style={{ textAlign: "center", padding: "140px 24px" }}>
          <div style={{ fontSize: 30, fontWeight: 800, marginBottom: 12 }}>Connect your wallet</div>
          <p style={{ color: "#aeb8c4", maxWidth: 380, margin: "0 auto 28px", lineHeight: 1.6 }}>Connect to open an encrypted position or copy a ranked trader on Sepolia.</p>
          <ConnectButton />
        </div>
      )}

      {isConnected && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: tab === "chart" ? "hidden" : "auto" }}>
          {tab === "chart" && <ChartTab address={address!} livePrice={livePrice} />}
          {tab === "discover" && <DiscoverTab address={address!} />}
          {tab === "following" && <FollowingTab address={address!} />}
          {tab === "portfolio" && <PortfolioTab address={address!} livePrice={livePrice} />}
          {tab === "leaderboard" && <LeaderboardTab />}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ChartTab({ address, livePrice }: { address: string; livePrice: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [candles, setCandles] = useState<Candle[]>(() => genCandles(80));
  const [tf, setTf] = useState("1H");
  const animRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const candlesRef = useRef<Candle[]>(candles);
  const priceRef = useRef(livePrice);

  useEffect(() => { candlesRef.current = candles; }, [candles]);
  useEffect(() => { priceRef.current = livePrice; }, [livePrice]);

  const fetchCandles = useCallback(async (interval: string) => {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=${interval}&limit=100`);
      const raw: [number, string, string, string, string, string][] = await res.json();
      const cs: Candle[] = raw.map(k => ({ o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], t: k[0] }));
      setCandles(cs);
    } catch { /* keep fake */ }
  }, []);

  const connectWs = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket("wss://stream.binance.com:9443/ws/ethusdt@miniTicker");
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        const p = parseFloat(d.c);
        setCandles(prev => {
          if (!prev.length) return prev;
          const next = [...prev];
          const last = { ...next[next.length - 1], c: p, h: Math.max(next[next.length - 1].h, p), l: Math.min(next[next.length - 1].l, p) };
          next[next.length - 1] = last;
          return next;
        });
      } catch { /* ignore */ }
    };
    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, []);

  useEffect(() => {
    fetchCandles(TF_MAP[tf]);
    connectWs();
    return () => { wsRef.current?.close(); };
  }, [tf, fetchCandles, connectWs]);

  // contract reads
  const { data: positionData } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getPosition", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: [bigint, bigint, boolean, boolean] | undefined };
  const { data: isOpen, refetch: refetchOpen } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "isPositionOpen", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: boolean | undefined; refetch: () => void };
  const { data: stakedBalance, refetch: refetchStake } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "stakedBalance", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: bigint | undefined; refetch: () => void };
  const { data: followerCount } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: bigint | undefined };

  const isStaked = !!(stakedBalance && stakedBalance > 0n);
  const entryPrice = positionData ? Number(positionData[1]) / 1e6 : 0;
  const fCount = Number(followerCount ?? 0n);

  // unrealized P&L
  const unrealizedPct = isOpen && entryPrice > 0 ? ((livePrice - entryPrice) / entryPrice * 100) : 0;
  const unrealizedBps = Math.round(unrealizedPct * 100);
  const pnlPositive = unrealizedPct >= 0;

  // form state
  const [dir, setDir] = useState<Dir>("LONG");
  const [size, setSize] = useState("2500");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusOk, setStatusOk] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const [encFrame, setEncFrame] = useState(0);

  const { writeContractAsync } = useWriteContract();
  const { data: walletClient } = useWalletClient();

  function setErr(m: string) { setStatusMsg(m); setStatusOk(false); }
  function setOk(m: string) { setStatusMsg(m); setStatusOk(true); }

  // draw
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
    const price = priceRef.current;
    const MT = 14, MR = 68, MB = 26, ML = 4, VOLH = Math.floor(H * 0.14);
    const CW = W - ML - MR, CH = H - MT - MB - VOLH - 6, CT = MT, CB = MT + CH, VT = CB + 6, VB = H - MB;
    const VISIBLE = 62;
    const cs = candlesRef.current.slice(-VISIBLE);
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
    if (isOpen && entryPrice > 0) {
      const ey = py(entryPrice), cy2 = py(price);
      const inProfit = price > entryPrice;
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
      rr(ctx, ML + 10, ey - 16, 172, 16, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fbbf24"; ctx.font = `9.5px ${MONO}`; ctx.textAlign = "left";
      ctx.fillText("🔒 SEALED ENTRY · $" + entryPrice.toFixed(2), ML + 16, ey - 4);
      ctx.fillStyle = "#6b5320";
      rr(ctx, ML + CW + 1, ey - 9, MR - 2, 17, 4); ctx.fill();
      ctx.fillStyle = "#fbbf24"; ctx.font = `bold 9.5px ${MONO}`; ctx.textAlign = "center";
      ctx.fillText("$" + entryPrice.toFixed(0), ML + CW + 1 + (MR - 2) / 2, ey + 4);
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
    // time labels
    ctx.fillStyle = "#3d4a58"; ctx.font = `9px ${MONO}`; ctx.textAlign = "center";
    [0, 15, 30, 45, 61].forEach(i => {
      if (i < cs.length) {
        const d = new Date(cs[i].t);
        ctx.fillText(`${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`, cx(i), H - MB + 14);
      }
    });
  }, [isOpen, entryPrice, encrypting, encFrame]);

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
    setLoading(true); setStatusMsg(""); setEncrypting(true);
    try {
      setStatusMsg("Initializing FHE…");
      const { createInstance, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");
      const fhevm = await createInstance({ ...SepoliaConfig, network: walletClient as Parameters<typeof createInstance>[0]["network"] });
      setStatusMsg("Encrypting…");
      const input = fhevm.createEncryptedInput(CIPHER_TRADE_ADDRESS, address);
      input.addBool(dir === "LONG"); input.add64(BigInt(Math.floor(Number(size))));
      const encrypted = await input.encrypt();
      setStatusMsg("Broadcasting…");
      await writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "openPosition", args: [encrypted.handles[0], encrypted.handles[1], encrypted.inputProof] });
      setOk("Position sealed on-chain."); setSize("2500"); refetchOpen();
    } catch (e: unknown) { setErr((e instanceof Error ? e.message.slice(0, 100) : String(e))); }
    setEncrypting(false); setLoading(false);
  }

  async function handleClose() {
    setLoading(true); setStatusMsg("Closing…");
    try {
      await writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "closePosition" });
      setOk("Position closed. Awaiting KMS settlement."); refetchOpen();
    } catch (e: unknown) { setErr((e instanceof Error ? e.message.slice(0, 100) : String(e))); }
    setLoading(false);
  }

  async function handleStake() {
    setLoading(true);
    try {
      await writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: isStaked ? "unstake" : "stake" });
      setOk(isStaked ? "Unstaked." : "Staked. 18% fee enabled."); refetchStake();
    } catch (e: unknown) { setErr((e instanceof Error ? e.message.slice(0, 100) : String(e))); }
    setLoading(false);
  }

  const last = candles[candles.length - 1] ?? { o: livePrice, h: livePrice, l: livePrice, c: livePrice, v: 0, t: 0 };
  const first24 = candles[0] ?? last;
  const high24 = Math.max(...candles.map(c => c.h));
  const low24 = Math.min(...candles.map(c => c.l));
  const vol24 = candles.reduce((s, c) => s + c.v, 0);
  const change24 = ((livePrice - first24.o) / first24.o * 100).toFixed(2);
  const isUp = livePrice >= first24.o;

  // fake cipher for mempool strip
  const cipherA = "0x2e7c5d9a" + Math.random().toString(16).slice(2, 6) + "…";
  const cipherB = "0x1f9e4c7a" + Math.random().toString(16).slice(2, 6) + "…";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      {/* pair strip */}
      <div style={{ height: 38, borderBottom: `1px solid ${BORDER2}`, background: "#0c1017", display: "flex", alignItems: "center", padding: "0 18px", gap: 0, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 18, flexShrink: 0 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: "linear-gradient(135deg,#627eea,#8fa6f3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>Ξ</div>
          <span style={{ fontWeight: 600, fontSize: 13 }}>ETH / cUSDT</span>
        </div>
        <div style={{ width: 1, height: 16, background: BORDER, marginRight: 18, flexShrink: 0 }} />
        {[
          { label: "24h Change", value: (isUp ? "+" : "") + change24 + "%", color: isUp ? GREEN : RED_SOFT },
          { label: "24h High", value: "$" + high24.toFixed(2), color: "#aeb8c4" },
          { label: "24h Low", value: "$" + low24.toFixed(2), color: "#aeb8c4" },
          { label: "24h Vol", value: "$" + (vol24 / 1e6).toFixed(1) + "M", color: "#aeb8c4" },
          { label: "Mark", value: "$" + livePrice.toFixed(2), color: AMBER },
        ].map(s => (
          <div key={s.label} style={{ marginRight: 20, flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: MUTED2, lineHeight: 1.2 }}>{s.label}</div>
            <div style={{ fontSize: 12, fontFamily: MONO, fontWeight: 600, color: s.color, lineHeight: 1.3 }}>{s.value}</div>
          </div>
        ))}
        <div style={{ marginLeft: "auto", fontSize: 10, color: AMBER, fontFamily: MONO, flexShrink: 0, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: AMBER, display: "inline-block" }} />
          🔒 All positions sealed on-chain
        </div>
      </div>

      {/* main grid */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 290px", gap: 0, minHeight: 0, overflow: "hidden" }}>
        {/* chart col */}
        <div style={{ display: "flex", flexDirection: "column", padding: "12px 12px 10px 16px", borderRight: `1px solid ${BORDER2}`, gap: 8, minWidth: 0, overflow: "hidden" }}>
          {/* TF + OHLC row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 3 }}>
              {["15m", "1H", "4H", "1D"].map(t => (
                <button key={t} onClick={() => setTf(t)} style={{ padding: "4px 11px", borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: MONO, border: "none", cursor: "pointer", background: tf === t ? "#1e2a36" : "transparent", color: tf === t ? "#eef2f6" : MUTED2 }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontFamily: MONO, color: MUTED2 }}>
              <span>O <span style={{ color: "#aeb8c4" }}>${last.o.toFixed(2)}</span></span>
              <span>H <span style={{ color: GREEN }}>${Math.max(last.h, livePrice).toFixed(2)}</span></span>
              <span>L <span style={{ color: RED_SOFT }}>${Math.min(last.l, livePrice).toFixed(2)}</span></span>
              <span>C <span style={{ color: isUp ? GREEN : RED_SOFT }}>${livePrice.toFixed(2)}</span></span>
            </div>
          </div>

          {/* canvas */}
          <div style={{ position: "relative", flex: 1, minHeight: 0, background: "#0c1017", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
            {encrypting && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(8,9,12,.82)", backdropFilter: "blur(3px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <div style={{ fontSize: 13, fontFamily: MONO, color: "#fbbf24", display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 13, height: 13, border: "2px solid #5e4a24", borderTopColor: AMBER, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                  Encrypting with FHE…
                </div>
              </div>
            )}
          </div>

          {/* mempool strip */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 10.5, fontFamily: MONO, color: MUTED2, flexShrink: 0, padding: "0 2px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: AMBER, opacity: .6, display: "inline-block" }} />
              Last tx: <span style={{ color: "#7d8896" }}>0x9c2b…f44d</span>
            </span>
            <span>dir=<span style={{ color: MUTED2 }}>{cipherA}</span></span>
            <span>size=<span style={{ color: MUTED2 }}>{cipherB}</span></span>
            <span style={{ marginLeft: "auto", color: GREEN, display: "flex", alignItems: "center", gap: 5 }}>● mempool sees ciphertext only</span>
          </div>
        </div>

        {/* side panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, overflowY: "auto" }}>
          {/* position card */}
          {isOpen ? (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 13, padding: 14, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#aeb8c4" }}>Your position</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: GREEN, background: "rgba(74,222,128,.08)", padding: "3px 9px", borderRadius: 20, fontWeight: 600, border: "1px solid rgba(74,222,128,.15)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, display: "inline-block" }} />OPEN
                </span>
              </div>
              <div style={{ display: "flex", gap: 7, marginBottom: 8 }}>
                <div style={{ flex: 1, background: INNER, borderRadius: 9, padding: 10 }}>
                  <div style={{ fontSize: 9, color: MUTED2, marginBottom: 3 }}>Direction</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: GREEN }}>▲ Long</div>
                  <div style={{ fontSize: 9, color: MUTED2, marginTop: 2, fontFamily: MONO }}>🔒 sealed</div>
                </div>
                <div style={{ flex: 1, background: INNER, borderRadius: 9, padding: 10 }}>
                  <div style={{ fontSize: 9, color: MUTED2, marginBottom: 3 }}>Size</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO }}>—</div>
                  <div style={{ fontSize: 9, color: MUTED2, marginTop: 2, fontFamily: MONO }}>🔒 sealed</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 7, marginBottom: 8 }}>
                <div style={{ flex: 1, background: INNER, borderRadius: 9, padding: 9 }}>
                  <div style={{ fontSize: 9, color: MUTED2, marginBottom: 2 }}>Entry</div>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO }}>${entryPrice.toFixed(2)}</div>
                </div>
                <div style={{ flex: 1, background: INNER, borderRadius: 9, padding: 9 }}>
                  <div style={{ fontSize: 9, color: MUTED2, marginBottom: 2 }}>Mark</div>
                  <div style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO, color: AMBER }}>${livePrice.toFixed(2)}</div>
                </div>
              </div>
              <div style={{ background: pnlPositive ? "rgba(34,197,94,.07)" : "rgba(239,68,68,.07)", borderRadius: 10, padding: 11, marginBottom: 11 }}>
                <div style={{ fontSize: 9, color: pnlPositive ? "rgba(74,222,128,.7)" : "rgba(252,165,165,.7)", marginBottom: 1 }}>Unrealized P&L</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: pnlPositive ? GREEN : RED_SOFT, fontFamily: MONO, lineHeight: 1.1 }}>{pnlPositive ? "+" : ""}{unrealizedPct.toFixed(2)}%</div>
                <div style={{ fontSize: 10, color: pnlPositive ? "rgba(74,222,128,.7)" : "rgba(252,165,165,.7)", marginTop: 1, fontFamily: MONO }}>{pnlPositive ? "+" : ""}{unrealizedBps} bps</div>
              </div>
              <button onClick={handleClose} disabled={loading} style={{ width: "100%", padding: 10, border: "1px solid rgba(252,165,165,.2)", background: "rgba(252,165,165,.06)", color: RED_SOFT, fontSize: 12, fontWeight: 600, borderRadius: 9, cursor: "pointer", fontFamily: SANS }}>
                {loading ? statusMsg || "Closing…" : "Close & settle"}
              </button>
            </div>
          ) : (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 13, padding: 14, flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>New position</div>
              <div style={{ fontSize: 10, color: MUTED2, fontFamily: MONO, marginBottom: 12 }}>encrypted client-side before broadcast</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 11 }}>
                <button onClick={() => setDir("LONG")} style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer", border: "none", background: dir === "LONG" ? "#22c55e" : "#131a22", color: dir === "LONG" ? "#fff" : MUTED, fontFamily: SANS }}>▲ Long</button>
                <button onClick={() => setDir("SHORT")} style={{ flex: 1, padding: "10px 0", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer", border: "none", background: dir === "SHORT" ? RED : "#131a22", color: dir === "SHORT" ? "#fff" : MUTED, fontFamily: SANS }}>▼ Short</button>
              </div>
              <div style={{ fontSize: 10, color: MUTED, marginBottom: 4 }}>Size (units)</div>
              <input type="number" value={size} onChange={e => setSize(e.target.value)} style={{ width: "100%", background: INNER, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px", color: "#eef2f6", fontSize: 16, fontWeight: 600, fontFamily: MONO, marginBottom: 6, boxSizing: "border-box", outline: "none" }} />
              <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                {["100", "500", "1000", "2500"].map(v => (
                  <button key={v} onClick={() => setSize(v)} style={{ flex: 1, padding: "6px 0", background: INNER, border: `1px solid ${size === v ? AMBER : BORDER}`, borderRadius: 7, color: size === v ? AMBER : "#aeb8c4", fontSize: 11, fontFamily: MONO, cursor: "pointer" }}>{v}</button>
                ))}
              </div>
              <div style={{ background: INNER, borderRadius: 8, padding: 10, marginBottom: 11, display: "flex", flexDirection: "column", gap: 6 }}>
                {[["Order value", "$" + (Number(size) || 0).toLocaleString()], ["Encrypted with", "FHE / tfhe-rs"]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: MUTED }}>{k}</span>
                    <span style={{ fontFamily: MONO, color: k === "Encrypted with" ? "#fbbf24" : "#eef2f6" }}>{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleOpen} disabled={loading || !size} style={{ width: "100%", padding: 12, border: "none", background: size ? AMBER : "#1a2030", color: size ? "#0c0a06" : MUTED, fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: size ? "pointer" : "not-allowed", fontFamily: SANS, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: size ? "0 0 18px rgba(245,158,11,.25)" : "none" }}>
                🔒 {loading ? (statusMsg || "Processing…") : "Encrypt & open"}
              </button>
            </div>
          )}

          {/* copying you */}
          {isOpen && fCount > 0 && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 13, padding: 13, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#aeb8c4" }}>Copying you</span>
                <span style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>{fCount} / 20</span>
              </div>
              <div style={{ height: 4, background: INNER, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${(fCount / 20) * 100}%`, height: "100%", background: AMBER, borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 10, color: MUTED2, fontFamily: MONO }}>Direction &amp; size hidden from all followers</div>
            </div>
          )}

          {/* stake */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 13, padding: 13, flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#aeb8c4" }}>Stake</span>
              <span style={{ fontSize: 14, fontWeight: 600, fontFamily: MONO }}>{isStaked ? "100" : "0"} <span style={{ fontSize: 9, color: MUTED }}>cUSDT</span></span>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 9 }}>
              {[{ pct: "8%", label: "Unstaked", active: !isStaked }, { pct: "18%", label: "Staked", active: isStaked }].map(t => (
                <div key={t.label} style={{ flex: 1, background: t.active ? (t.label === "Staked" ? "#241b0c" : INNER) : INNER, border: `1px solid ${t.active && t.label === "Staked" ? "#6b5320" : BORDER}`, borderRadius: 9, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: MONO, color: t.active ? (t.label === "Staked" ? AMBER : "#aeb8c4") : MUTED2 }}>{t.pct}</div>
                  <div style={{ fontSize: 9, marginTop: 1, color: t.active ? (t.label === "Staked" ? AMBER : "#aeb8c4") : MUTED2 }}>{t.label}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 10, color: MUTED2, marginBottom: 8, lineHeight: 1.45 }}>
              {isStaked ? "Staked · 18% performance fee · loss-sharing enabled" : "Stake 100 cUSDT to unlock 18% fee tier"}
            </div>
            <button onClick={handleStake} disabled={loading || !!isOpen} style={{ width: "100%", padding: 9, border: "1px solid #6b5320", background: "transparent", color: "#fbbf24", fontSize: 12, fontWeight: 600, borderRadius: 9, cursor: isOpen ? "not-allowed" : "pointer", opacity: isOpen ? 0.5 : 1, fontFamily: SANS }}>
              {isStaked ? "Unstake 100 cUSDT" : "Stake 100 cUSDT"}
            </button>
            {isOpen && <div style={{ fontSize: 10, color: MUTED2, marginTop: 5, textAlign: "center" }}>Close position first</div>}
          </div>

          {statusMsg && !loading && (
            <div style={{ fontSize: 11, fontFamily: MONO, color: statusOk ? GREEN : RED_SOFT, padding: "9px 12px", background: statusOk ? "#0f1f17" : "#1f0a0a", border: `1px solid ${statusOk ? "#1f4630" : "#4a1515"}`, borderRadius: 9, textAlign: "center" }}>{statusMsg}</div>
          )}
        </div>
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
    } catch { /* show error inline */ }
    setLoading(false);
  }

  const traders = traderAddrs ?? [];

  return (
    <div style={{ padding: "18px 22px", maxWidth: 1240, margin: "0 auto", width: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Discover traders</div>
          <div style={{ fontSize: 13, color: MUTED }}>Follow proven returns. Direction &amp; size stay encrypted — you copy the record, not the trade.</div>
        </div>
        <div style={{ fontSize: 11, color: "#fbbf24", background: "#241b0c", border: "1px solid #5e4a24", padding: "8px 14px", borderRadius: 9, fontFamily: MONO }}>Following {following.size} traders</div>
      </div>

      {traders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 24px", color: MUTED }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#eef2f6", marginBottom: 8 }}>No traders registered yet</div>
          <div style={{ fontSize: 13 }}>Open an encrypted position in the Chart tab to appear here.</div>
        </div>
      ) : (
        <>
          {/* featured */}
          <DiscoverFeatured addr={traders[0]} isFollowing={following.has(traders[0])} isSelf={traders[0].toLowerCase() === address.toLowerCase()} onFollow={() => setFollowModal(traders[0])} onUnfollow={() => toggleFollow(traders[0])} />
          {/* grid */}
          {traders.length > 1 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {traders.slice(1).map(addr => (
                <DiscoverCard key={addr} addr={addr} isFollowing={following.has(addr)} isSelf={addr.toLowerCase() === address.toLowerCase()} onFollow={() => setFollowModal(addr)} onUnfollow={() => toggleFollow(addr)} />
              ))}
            </div>
          )}
        </>
      )}

      {/* follow modal */}
      {followModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(6,9,13,.85)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ width: 420, maxWidth: "100%", background: CARD, border: "1px solid #6b5320", borderRadius: 18, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 17 }}>{initial(followModal)}</div>
              <div><div style={{ fontSize: 16, fontWeight: 600 }}>Follow {fmt(followModal)}</div><div style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>Sepolia testnet</div></div>
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

function Sparkline({ bars }: { bars: number[] }) {
  const max = Math.max(...bars), min = Math.min(...bars);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 36 }}>
      {bars.map((b, i) => {
        const h = max === min ? 50 : ((b - min) / (max - min)) * 80 + 20;
        const col = b > bars[0] ? "rgba(34,197,94,.7)" : "rgba(239,68,68,.5)";
        return <div key={i} style={{ flex: 1, height: `${h}%`, background: col, borderRadius: 2 }} />;
      })}
    </div>
  );
}

function DiscoverFeatured({ addr, isFollowing, isSelf, onFollow, onUnfollow }: { addr: string; isFollowing: boolean; isSelf: boolean; onFollow: () => void; onUnfollow: () => void }) {
  const { data: stats } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [addr as `0x${string}`], query: {} }) as { data: [bigint, bigint, bigint] | undefined };
  const { data: fCount } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [addr as `0x${string}`], query: {} }) as { data: bigint | undefined };
  const [total, wins, pnlBps] = stats ?? [0n, 0n, 0n];
  const pct = (Number(pnlBps) / 100).toFixed(1);
  const isPos = Number(pnlBps) >= 0;
  const bars = [30, 45, 38, 55, 62, 58, 72, 80, 88];

  return (
    <div style={{ background: CARD, border: "1px solid #6b5320", borderRadius: 16, padding: 22, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 240px", gap: 22, alignItems: "center" }}>
      <div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 20 }}>{initial(addr)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 600 }}>{fmt(addr)}</div>
            <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO, marginTop: 2 }}>{fmt(addr)} · {total.toString()} settled</div>
          </div>
          <div style={{ fontSize: 10, color: "#fbbf24", background: "#241b0c", border: "1px solid #5e4a24", padding: "4px 10px", borderRadius: 20, fontFamily: MONO }}>★ TOP RANKED</div>
        </div>
        <div style={{ display: "flex", gap: 9, marginBottom: 14 }}>
          {["Direction", "Size"].map(k => (
            <div key={k} style={{ flex: 1, display: "flex", alignItems: "center", padding: "9px 12px", background: INNER, borderRadius: 9, fontSize: 11, color: MUTED }}>
              {k}<span style={{ marginLeft: "auto", fontFamily: MONO, color: "#9aa6b4" }}>🔒 sealed</span>
            </div>
          ))}
        </div>
        <Sparkline bars={bars} />
      </div>
      <div style={{ borderLeft: `1px solid ${BORDER}`, paddingLeft: 22 }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: isPos ? GREEN : RED_SOFT, fontFamily: MONO, lineHeight: 1 }}>{isPos ? "+" : ""}{pct}%</div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>Net return</div>
        <div style={{ margin: "12px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: MUTED, marginBottom: 4 }}>
            <span>Followers</span><span style={{ color: "#aeb8c4" }}>{Number(fCount ?? 0n)} / 20</span>
          </div>
          <div style={{ height: 5, background: INNER, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${(Number(fCount ?? 0n) / 20) * 100}%`, height: "100%", background: AMBER, borderRadius: 3 }} />
          </div>
        </div>
        {!isSelf && (
          <button onClick={isFollowing ? onUnfollow : onFollow} style={{ width: "100%", padding: 12, background: isFollowing ? "transparent" : AMBER, color: isFollowing ? MUTED : "#0c0a06", border: isFollowing ? `1px solid ${BORDER}` : "none", fontSize: 14, fontWeight: 700, borderRadius: 11, cursor: "pointer", fontFamily: SANS }}>
            {isFollowing ? "Following ✓" : "Follow"}
          </button>
        )}
      </div>
    </div>
  );
}

function DiscoverCard({ addr, isFollowing, isSelf, onFollow, onUnfollow }: { addr: string; isFollowing: boolean; isSelf: boolean; onFollow: () => void; onUnfollow: () => void }) {
  const { data: stats } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [addr as `0x${string}`], query: {} }) as { data: [bigint, bigint, bigint] | undefined };
  const { data: fCount } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [addr as `0x${string}`], query: {} }) as { data: bigint | undefined };
  const [total, , pnlBps] = stats ?? [0n, 0n, 0n];
  const pct = (Number(pnlBps) / 100).toFixed(1);
  const isPos = Number(pnlBps) >= 0;
  const bars = [42, 50, 44, 56, 60, 52, 68, 62, 70];

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 17 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 13 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "#161d25", display: "flex", alignItems: "center", justifyContent: "center", color: "#aeb8c4", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{initial(addr)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmt(addr)}</div>
          <div style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginTop: 1 }}>🔒 sealed · {total.toString()} settled</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: isPos ? GREEN : RED_SOFT, fontFamily: MONO }}>{isPos ? "+" : ""}{pct}%</div>
          <div style={{ fontSize: 9, color: MUTED }}>30D</div>
        </div>
      </div>
      <div style={{ marginBottom: 12 }}><Sparkline bars={bars} /></div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>{Number(fCount ?? 0n)} / 20</div>
        {!isSelf && (
          <button onClick={isFollowing ? onUnfollow : onFollow} style={{ padding: "7px 16px", border: `1px solid ${isFollowing ? BORDER : "#6b5320"}`, background: "transparent", color: isFollowing ? MUTED : "#fbbf24", fontSize: 12, fontWeight: 600, borderRadius: 9, cursor: "pointer" }}>
            {isFollowing ? "Following ✓" : "Follow"}
          </button>
        )}
      </div>
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
    <div style={{ padding: "18px 22px", maxWidth: 1240, margin: "0 auto", width: "100%", overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total allocated", value: followed.length * 500 + " cUSDT", color: "#eef2f6" },
          { label: "Est. total P&L", value: "—", color: GREEN },
          { label: "Active positions", value: followed.length.toString(), color: "#eef2f6" },
          { label: "Your address", value: fmt(address), color: AMBER },
        ].map(s => (
          <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 15 }}>
            <div style={{ fontSize: 10, color: MUTED2, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: "#aeb8c4", marginBottom: 12 }}>Active copy positions</div>

      {followed.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: MUTED }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#eef2f6", marginBottom: 6 }}>Not following anyone yet</div>
          <div style={{ fontSize: 13 }}>Go to Discover to follow a trader.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {followed.map(addr => <FollowingRow key={addr} addr={addr} />)}
        </div>
      )}

      {followed.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#aeb8c4", marginBottom: 12 }}>Settled positions</div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", background: INNER, padding: "10px 16px" }}>
              {["TRADER", "ALLOC", "DIRECTION", "P&L", "DATE"].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 600, color: MUTED2, fontFamily: MONO }}>{h}</div>
              ))}
            </div>
            <div style={{ padding: "14px 16px", color: MUTED2, fontSize: 12, textAlign: "center" }}>No settled positions yet</div>
          </div>
        </>
      )}
    </div>
  );
}

function FollowingRow({ addr }: { addr: string }) {
  const { data: stats } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [addr as `0x${string}`], query: {} }) as { data: [bigint, bigint, bigint] | undefined };
  const { data: posOpen } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "isPositionOpen", args: [addr as `0x${string}`], query: {} }) as { data: boolean | undefined };
  const [, , pnlBps] = stats ?? [0n, 0n, 0n];

  return (
    <div style={{ background: CARD, border: `1px solid ${posOpen ? "rgba(34,197,94,.2)" : BORDER}`, borderRadius: 14, padding: 16, display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 0, alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginRight: 18 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{initial(addr)}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{fmt(addr)}</div>
          <div style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginTop: 1 }}>{addr.slice(0, 10)}…{addr.slice(-6)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[["Direction", "🔒 sealed"], ["Size", "🔒 sealed"], ["Your alloc", "500 cUSDT"], ["Since", "now"]].map(([k, v]) => (
          <div key={k} style={{ background: INNER, borderRadius: 8, padding: "8px 11px" }}>
            <div style={{ fontSize: 9, color: MUTED2, marginBottom: 1 }}>{k}</div>
            <div style={{ fontSize: 12, color: MUTED, fontFamily: MONO }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "right", margin: "0 18px" }}>
        <div style={{ fontSize: 9, color: MUTED2, marginBottom: 1 }}>Est. P&L</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: Number(pnlBps) >= 0 ? GREEN : RED_SOFT, fontFamily: MONO }}>{Number(pnlBps) >= 0 ? "+" : ""}{(Number(pnlBps) / 100).toFixed(1)}%</div>
        <div style={{ fontSize: 9, color: MUTED2, fontFamily: MONO, marginTop: 1 }}>🔒 sealed until settlement</div>
      </div>
      <button style={{ padding: "8px 14px", border: "1px solid #2a2030", background: "transparent", color: MUTED, fontSize: 12, fontWeight: 600, borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Unfollow</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTFOLIO TAB
// ═══════════════════════════════════════════════════════════════════════════════
function PortfolioTab({ address, livePrice }: { address: string; livePrice: number }) {
  const { data: positionData } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getPosition", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: [bigint, bigint, boolean, boolean] | undefined };
  const { data: isOpen, refetch: refetchOpen } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "isPositionOpen", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: boolean | undefined; refetch: () => void };
  const { data: stakedBalance } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "stakedBalance", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: bigint | undefined };
  const { data: traderStats } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: [bigint, bigint, bigint] | undefined };
  const { data: followerCount } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: bigint | undefined };
  const { data: history } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getTradeHistory", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: readonly { entryPrice: bigint; exitPrice: bigint; direction: boolean; size: bigint; pnlBps: bigint; timestamp: bigint }[] | undefined };

  const [total, wins, pnlBps] = traderStats ?? [0n, 0n, 0n];
  const winRate = total > 0n ? Math.round(Number(wins) / Number(total) * 100) : 0;
  const isStaked = !!(stakedBalance && stakedBalance > 0n);
  const entryPrice = positionData ? Number(positionData[1]) / 1e6 : 0;
  const unrealizedPct = isOpen && entryPrice > 0 ? ((livePrice - entryPrice) / entryPrice * 100) : 0;
  const pnlPos = unrealizedPct >= 0;
  const fCount = Number(followerCount ?? 0n);

  const { writeContractAsync } = useWriteContract();
  const [loading, setLoading] = useState(false);
  async function handleClose() {
    setLoading(true);
    try { await writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "closePosition" }); refetchOpen(); } catch { /* ignore */ }
    setLoading(false);
  }

  return (
    <div style={{ padding: "18px 22px", maxWidth: 1240, margin: "0 auto", width: "100%", overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Total copied", value: "$" + (fCount * 500).toLocaleString(), color: "#eef2f6" },
          { label: "Win rate", value: total > 0n ? winRate + "%" : "—", color: GREEN },
          { label: "Followers", value: fCount + "/20", color: AMBER },
          { label: "Net P&L", value: (Number(pnlBps) >= 0 ? "+" : "") + (Number(pnlBps) / 100).toFixed(1) + "%", color: Number(pnlBps) >= 0 ? GREEN : RED_SOFT },
        ].map(s => (
          <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 15 }}>
            <div style={{ fontSize: 10, color: MUTED2, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 22 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 15 }}>Your active position</div>
          {isOpen ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
                <div style={{ background: INNER, borderRadius: 9, padding: 12 }}>
                  <div style={{ fontSize: 9, color: MUTED2, marginBottom: 3 }}>Direction</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: GREEN }}>▲ Long</div>
                  <div style={{ fontSize: 9, color: MUTED2, marginTop: 2, fontFamily: MONO }}>🔒 sealed</div>
                </div>
                <div style={{ background: INNER, borderRadius: 9, padding: 12 }}>
                  <div style={{ fontSize: 9, color: MUTED2, marginBottom: 3 }}>Size</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: MONO }}>—</div>
                  <div style={{ fontSize: 9, color: MUTED2, marginTop: 2, fontFamily: MONO }}>🔒 sealed</div>
                </div>
                <div style={{ background: INNER, borderRadius: 9, padding: 12 }}>
                  <div style={{ fontSize: 9, color: MUTED2, marginBottom: 3 }}>Entry</div>
                  <div style={{ fontSize: 16, fontWeight: 600, fontFamily: MONO }}>${entryPrice.toFixed(2)}</div>
                </div>
                <div style={{ background: pnlPos ? "rgba(34,197,94,.07)" : "rgba(239,68,68,.07)", borderRadius: 9, padding: 12 }}>
                  <div style={{ fontSize: 9, color: pnlPos ? "rgba(74,222,128,.7)" : "rgba(252,165,165,.7)", marginBottom: 3 }}>Unr. P&L</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: pnlPos ? GREEN : RED_SOFT, fontFamily: MONO }}>{pnlPos ? "+" : ""}{unrealizedPct.toFixed(2)}%</div>
                  <div style={{ fontSize: 9, color: pnlPos ? "rgba(74,222,128,.7)" : "rgba(252,165,165,.7)", fontFamily: MONO }}>{pnlPos ? "+" : ""}{Math.round(unrealizedPct * 100)} bps</div>
                </div>
              </div>
              <button onClick={handleClose} disabled={loading} style={{ padding: "11px 24px", border: "1px solid rgba(252,165,165,.2)", background: "rgba(252,165,165,.06)", color: RED_SOFT, fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: "pointer", fontFamily: SANS }}>
                {loading ? "Closing…" : "Close & settle"}
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 28, color: MUTED2, fontSize: 13 }}>No open position</div>
          )}
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Stake</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ pct: "8%", label: "Unstaked", desc: "Base fee, no loss-sharing", active: !isStaked }, { pct: "18%", label: "Staked", desc: "Loss-sharing + trust boost", active: isStaked }].map(t => (
              <div key={t.label} style={{ flex: 1, background: t.active && t.label === "Staked" ? "#241b0c" : INNER, border: `1px solid ${t.active && t.label === "Staked" ? "#6b5320" : BORDER}`, borderRadius: 9, padding: "10px 12px" }}>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: MONO, color: t.active ? (t.label === "Staked" ? AMBER : "#aeb8c4") : MUTED2 }}>{t.pct}</div>
                <div style={{ fontSize: 10, marginTop: 2, color: t.active ? (t.label === "Staked" ? AMBER : "#aeb8c4") : MUTED2 }}>{t.label}</div>
                <div style={{ fontSize: 9.5, color: MUTED2, marginTop: 3, lineHeight: 1.3 }}>{t.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: MUTED2, lineHeight: 1.45 }}>{isStaked ? "Staked · 18% performance fee · loss-sharing enabled" : "Stake 100 cUSDT to unlock 18% fee tier"}</div>
          <button style={{ padding: 10, border: "1px solid #6b5320", background: "transparent", color: "#fbbf24", fontSize: 13, fontWeight: 600, borderRadius: 10, cursor: "pointer", fontFamily: SANS }}>
            {isStaked ? "Unstake 100 cUSDT" : "Stake 100 cUSDT"}
          </button>
        </div>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: "#aeb8c4", marginBottom: 12 }}>Settled trade history</div>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 1fr", background: INNER, padding: "10px 16px" }}>
          {["DATE", "DIR", "SIZE", "ENTRY", "EXIT", "P&L", "FEE PAID"].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 600, color: MUTED2, fontFamily: MONO }}>{h}</div>
          ))}
        </div>
        {!history || history.length === 0 ? (
          <div style={{ padding: "20px 16px", color: MUTED2, fontSize: 12, textAlign: "center" }}>No settled trades yet</div>
        ) : (
          [...history].reverse().map((tr, i) => {
            const pnl = Number(tr.pnlBps) / 100;
            const isWin = pnl > 0;
            const fee = Math.abs(pnl * (isStaked ? 0.18 : 0.08)).toFixed(2);
            return (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr 1fr", padding: "12px 16px", borderTop: `1px solid ${BORDER2}`, alignItems: "center" }}>
                <div style={{ fontSize: 11, color: MUTED2, fontFamily: MONO }}>{new Date(Number(tr.timestamp) * 1000).toLocaleDateString()}</div>
                <div><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: tr.direction ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)", color: tr.direction ? GREEN : RED }}>▲ {tr.direction ? "LONG" : "SHORT"}</span></div>
                <div style={{ fontSize: 12, fontFamily: MONO }}>{tr.size.toString()}</div>
                <div style={{ fontSize: 12, fontFamily: MONO, color: "#aeb8c4" }}>${(Number(tr.entryPrice) / 1e6).toFixed(2)}</div>
                <div style={{ fontSize: 12, fontFamily: MONO, color: "#aeb8c4" }}>${(Number(tr.exitPrice) / 1e6).toFixed(2)}</div>
                <div style={{ fontSize: 12, fontFamily: MONO, color: isWin ? GREEN : RED_SOFT, fontWeight: 600 }}>{isWin ? "+" : ""}{pnl.toFixed(1)}%</div>
                <div style={{ fontSize: 11, fontFamily: MONO, color: "#fbbf24" }}>{fee} paid</div>
              </div>
            );
          })
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
  const traders = traderAddrs ?? [];

  return (
    <div style={{ padding: "18px 22px", maxWidth: 1240, margin: "0 auto", width: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 5 }}>Leaderboard</div>
          <div style={{ fontSize: 13, color: MUTED }}>Ranked by verified on-chain track record. All positions were sealed during trading.</div>
        </div>
        <div style={{ display: "flex", background: "#131a22", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 3, gap: 2 }}>
          {(["all", "30d", "7d"] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: SANS, background: period === p ? "#1e2a36" : "transparent", color: period === p ? "#eef2f6" : MUTED }}>
              {p === "all" ? "All time" : p === "30d" ? "30D" : "7D"}
            </button>
          ))}
        </div>
      </div>

      {traders.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 24px", color: MUTED }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#eef2f6", marginBottom: 8 }}>No traders yet</div>
          <div style={{ fontSize: 13 }}>Be the first to open an encrypted position.</div>
        </div>
      ) : (
        <>
          {/* podium */}
          {traders.length >= 3 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.14fr 1fr", gap: 12, marginBottom: 22 }}>
              {[traders[1], traders[0], traders[2]].map((addr, i) => {
                const rank = [2, 1, 3][i];
                const colors: Record<number, { bg: string; border: string; rankColor: string; glow: string }> = {
                  1: { bg: "rgba(245,158,11,.06)", border: "#6b5320", rankColor: "#fbbf24", glow: "rgba(245,158,11,.15)" },
                  2: { bg: "rgba(156,163,175,.04)", border: "#374151", rankColor: "#9ca3af", glow: "rgba(156,163,175,.1)" },
                  3: { bg: "rgba(180,83,9,.04)", border: "#4b2e0a", rankColor: "#b45309", glow: "rgba(180,83,9,.1)" },
                };
                const c = colors[rank];
                return <PodiumCard key={addr} addr={addr} rank={rank} colors={c} />;
              })}
            </div>
          )}
          {/* table */}
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "52px 1.8fr 1fr 1fr 1fr 1fr 1fr 120px", background: INNER, padding: "10px 16px" }}>
              {["RANK", "TRADER", "SETTLED", "WIN RATE", "AVG", "RETURN", "FOLLOWERS", ""].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 600, color: MUTED2, fontFamily: MONO }}>{h}</div>
              ))}
            </div>
            {traders.map((addr, i) => <LeaderRow key={addr} addr={addr} rank={i + 1} />)}
          </div>
        </>
      )}
    </div>
  );
}

function PodiumCard({ addr, rank, colors }: { addr: string; rank: number; colors: { bg: string; border: string; rankColor: string; glow: string } }) {
  const { data: stats } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [addr as `0x${string}`], query: {} }) as { data: [bigint, bigint, bigint] | undefined };
  const [total, , pnlBps] = stats ?? [0n, 0n, 0n];
  const pct = (Number(pnlBps) / 100).toFixed(1);
  const isPos = Number(pnlBps) >= 0;

  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 20, textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 160, height: 100, background: colors.glow, filter: "blur(18px)" }} />
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO, color: colors.rankColor, marginBottom: 8, position: "relative" }}>#{rank}</div>
      <div style={{ width: 50, height: 50, borderRadius: 13, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 20, margin: "0 auto 10px", position: "relative" }}>{initial(addr)}</div>
      <div style={{ fontSize: 14, fontWeight: 600, position: "relative" }}>{fmt(addr)}</div>
      <div style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginTop: 2, marginBottom: 12, position: "relative" }}>{total.toString()} settled</div>
      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: isPos ? GREEN : RED_SOFT, lineHeight: 1, position: "relative" }}>{isPos ? "+" : ""}{pct}%</div>
      <div style={{ fontSize: 10, color: MUTED, marginTop: 3, marginBottom: 14, position: "relative" }}>net return</div>
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
  const avgPct = total > 0n ? (pnl / Number(total)).toFixed(1) : "0.0";
  const accentColors: Record<number, string> = { 1: "#6b5320", 2: "#374151", 3: "#4b2e0a" };
  const accent = accentColors[rank] ?? "transparent";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "52px 1.8fr 1fr 1fr 1fr 1fr 1fr 120px", padding: "13px 16px", borderTop: `1px solid ${BORDER2}`, alignItems: "center", borderLeft: `3px solid ${accent}` }}>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO, color: rank === 1 ? "#fbbf24" : rank === 2 ? "#9ca3af" : rank === 3 ? "#b45309" : MUTED }}>#{rank}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{initial(addr)}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{fmt(addr)}</div>
          <div style={{ fontSize: 10, color: MUTED, fontFamily: MONO }}>{addr.slice(0, 8)}…</div>
        </div>
      </div>
      <div style={{ fontSize: 12, fontFamily: MONO, color: "#aeb8c4" }}>{total.toString()}</div>
      <div style={{ fontSize: 12, fontFamily: MONO, color: "#fbbf24" }}>{total > 0n ? winRate + "%" : "—"}</div>
      <div style={{ fontSize: 12, fontFamily: MONO, color: "#aeb8c4" }}>{total > 0n ? (isPos ? "+" : "") + avgPct + "%" : "—"}</div>
      <div style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: isPos ? GREEN : RED_SOFT }}>{isPos ? "+" : ""}{pnl.toFixed(1)}%</div>
      <div style={{ fontSize: 12, fontFamily: MONO, color: "#aeb8c4" }}>{Number(fCount ?? 0n)} / 20</div>
      <div>
        {posOpen
          ? <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: "rgba(34,197,94,.12)", color: GREEN, border: "1px solid rgba(34,197,94,.25)" }}>LIVE 🔒</span>
          : <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: INNER, color: MUTED }}>Idle</span>}
      </div>
    </div>
  );
}
