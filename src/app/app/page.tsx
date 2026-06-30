"use client";

import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWalletClient, usePublicClient } from "wagmi";
import Link from "next/link";
import { CIPHER_TRADE_ADDRESS, CIPHER_TRADE_ABI } from "@/lib/contract";
import { getFhevm, preloadFhevm, toHex } from "@/lib/fhe";
import { decodeFunctionData, parseAbiItem } from "viem";

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

// ─── mock traders shown when contract has no registered traders ────────────────
const MOCK_TRADERS = [
  { addr: "0xA1c4b2e3f4d5c6e7f8a9b0c1d2e3f4b9F2", name: "DeltaNeutral", total: 210n, wins: 164n, pnlBps: 2410n, followers: 19n, posOpen: false },
  { addr: "0x7Bd1a2b3c4d5e6f7a8b9c0d1e2f3a4cE04", name: "Satoshi_Long",  total: 142n, wins: 101n, pnlBps: 1840n, followers: 12n, posOpen: true  },
  { addr: "0x3Fe9b2c3d4e5f6a7b8c9d0e1f2a3b4d11a", name: "VolHunter",     total: 88n,  wins: 54n,  pnlBps: 920n,  followers: 7n,  posOpen: false },
  { addr: "0x9Cc2a3b4c5d6e7f8a9b0c1d2e3f4a5b7ab8", name: "NightOwl",    total: 33n,  wins: 15n,  pnlBps: -230n, followers: 4n,  posOpen: false },
  { addr: "0xBf22a3b4c5d6e7f8a9b0c1d2e3f4a5b3019", name: "AlphaSeeker", total: 67n,  wins: 44n,  pnlBps: 1180n, followers: 9n,  posOpen: true  },
  { addr: "0x5Dc9a3b4c5d6e7f8a9b0c1d2e3f4a5b4ca7", name: "EchoChamber", total: 19n,  wins: 10n,  pnlBps: 410n,  followers: 3n,  posOpen: false },
];

function fmt(addr: string) { return addr.slice(0, 6) + "…" + addr.slice(-4); }
function initial(addr: string) { return addr.slice(2, 3).toUpperCase(); }

// Profile overlay: any trader row can call openProfile(addr) to open it.
const ProfileContext = createContext<(addr: string) => void>(() => {});
function useOpenProfile() { return useContext(ProfileContext); }

// Reads an on-chain username for an address, falling back to a mock name or short address.
// Only use this where a single standalone lookup is needed (e.g. ProfileOverlay).
// In list contexts (Leaderboard, Discover, Following) batch-read at the parent instead.
function useTraderName(addr?: string, mockName?: string): string {
  const { data } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "usernames", args: [addr as `0x${string}`], query: { enabled: !!addr && !mockName, staleTime: 60_000 } }) as { data: string | undefined };
  if (mockName) return mockName;
  if (data && data.length > 0) return data;
  return addr ? fmt(addr) : "";
}

function resolvedName(raw: string | undefined, addr: string): string {
  if (raw && raw.length > 0) return raw;
  return fmt(addr);
}




// ─── App shell ────────────────────────────────────────────────────────────────
export default function AppPage() {
  const { address, isConnected } = useAccount();
  const [tab, setTab] = useState<Tab>("chart");
  const [livePrice, setLivePrice] = useState(3000);
  const [prevOpen, setPrevOpen] = useState(3000);
  const [profileAddr, setProfileAddr] = useState<string | null>(null);
  const headerWsRef = useRef<WebSocket | null>(null);

  // warm up the FHE SDK/WASM in the background so the first trade is fast
  useEffect(() => { if (isConnected) preloadFhevm(); }, [isConnected]);

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
    <ProfileContext.Provider value={setProfileAddr}>
    <div style={{ minHeight: "100vh", background: BG, color: "#eef2f6", fontFamily: SANS, display: "flex", flexDirection: "column" }}>
      {profileAddr && <ProfileOverlay addr={profileAddr} livePrice={livePrice} onClose={() => setProfileAddr(null)} />}
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
          {tab === "discover" && <DiscoverTab address={address!} livePrice={livePrice} />}
          {tab === "following" && <FollowingTab address={address!} />}
          {tab === "portfolio" && <PortfolioTab address={address!} livePrice={livePrice} />}
          {tab === "leaderboard" && <LeaderboardTab />}
        </div>
      )}
    </div>
    </ProfileContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE OVERLAY — public track record for any trader (opened by addr/username)
// ═══════════════════════════════════════════════════════════════════════════════
function ProfileOverlay({ addr, livePrice, onClose }: { addr: string; livePrice: number; onClose: () => void }) {
  const name = useTraderName(addr);
  const { data: stats } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [addr as `0x${string}`], query: {} }) as { data: [bigint, bigint, bigint] | undefined };
  const { data: fCount } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [addr as `0x${string}`], query: {} }) as { data: bigint | undefined };
  const { data: posOpen } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "isPositionOpen", args: [addr as `0x${string}`], query: {} }) as { data: boolean | undefined };
  const { data: history } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getTradeHistory", args: [addr as `0x${string}`], query: {} }) as { data: readonly { entryPrice: bigint; exitPrice: bigint; direction: boolean; size: bigint; leverage: bigint; pnlBps: bigint; timestamp: bigint }[] | undefined };

  const [total, wins, pnlBps] = stats ?? [0n, 0n, 0n];
  const winRate = total > 0n ? Math.round(Number(wins) / Number(total) * 100) : 0;
  const net = Number(pnlBps) / 100;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(4,5,7,.7)", backdropFilter: "blur(4px)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 640, maxHeight: "86vh", overflowY: "auto", background: "#0d1218", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 54, height: 54, borderRadius: 14, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 24 }}>{name[0]?.toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{name}</div>
            <div style={{ fontSize: 11, color: MUTED2, fontFamily: MONO }}>{addr}</div>
          </div>
          {posOpen && <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, background: "rgba(34,197,94,.12)", color: GREEN, border: "1px solid rgba(34,197,94,.25)" }}>LIVE 🔒</span>}
          <button onClick={onClose} style={{ background: INNER, border: `1px solid ${BORDER}`, color: MUTED2, borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 16 }}>×</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20 }}>
          {[
            { label: "Settled", value: total.toString(), color: "#eef2f6" },
            { label: "Win rate", value: total > 0n ? winRate + "%" : "—", color: "#fbbf24" },
            { label: "Net P&L", value: (net >= 0 ? "+" : "") + net.toFixed(1) + "%", color: net >= 0 ? GREEN : RED_SOFT },
            { label: "Followers", value: Number(fCount ?? 0n) + "/20", color: AMBER },
          ].map(s => (
            <div key={s.label} style={{ background: INNER, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 9, color: MUTED2, marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 19, fontWeight: 700, fontFamily: MONO, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 13, fontWeight: 600, color: "#aeb8c4", marginBottom: 10 }}>Public track record</div>
        {!history || history.length === 0 ? (
          <div style={{ padding: "20px 0", color: MUTED2, fontSize: 12, textAlign: "center" }}>No settled trades yet</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[...history].reverse().map((tr, i) => {
              const pnl = Number(tr.pnlBps) / 100;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: INNER, borderRadius: 8, padding: "9px 12px", fontSize: 12, fontFamily: MONO }}>
                  <span style={{ color: tr.direction ? GREEN : RED, minWidth: 52 }}>{tr.direction ? "▲ LONG" : "▼ SHORT"}</span>
                  <span style={{ color: MUTED2 }}>{tr.size.toString()}u · {tr.leverage.toString()}×</span>
                  <span style={{ color: MUTED2 }}>${(Number(tr.entryPrice) / 1e6).toFixed(0)} → ${(Number(tr.exitPrice) / 1e6).toFixed(0)}</span>
                  <span style={{ marginLeft: "auto", color: pnl >= 0 ? GREEN : RED_SOFT, fontWeight: 700 }}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: 16, fontSize: 10.5, color: MUTED2, fontFamily: MONO, textAlign: "center" }}>
          Live positions stay encrypted · only settled trades are public · mark ${livePrice.toFixed(0)}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ENCRYPTION PROOF — pulls your real openPosition tx and shows what the chain stored
// ═══════════════════════════════════════════════════════════════════════════════
function EncryptionProof({ address, onClose }: { address: string; onClose: () => void }) {
  const publicClient = usePublicClient();
  const [state, setState] = useState<"loading" | "none" | "ready">("loading");
  const [txHash, setTxHash] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [txArgs, setTxArgs] = useState<any[]>([]);

  useEffect(() => {
    if (!publicClient) { setState("none"); return; }
    let cancelled = false;
    (async () => {
      try {
        const latest = await publicClient.getBlockNumber();
        // Don't use args filter — many Sepolia RPCs ignore topic filters silently.
        // Instead fetch all PositionOpened events for the contract and filter client-side.
        const spans = [1000n, 3000n, 8000n, 20000n];
        let found: { hash: `0x${string}`; } | null = null;
        for (const span of spans) {
          if (cancelled) return;
          const from = latest > span ? latest - span : 0n;
          try {
            const allLogs = await publicClient.getLogs({
              address: CIPHER_TRADE_ADDRESS as `0x${string}`,
              event: parseAbiItem("event PositionOpened(address indexed trader, uint256 entryPrice)"),
              fromBlock: from,
              toBlock: latest,
            });
            const mine = allLogs.filter(l => (l.args as { trader?: string }).trader?.toLowerCase() === address.toLowerCase());
            if (mine.length) { found = { hash: mine[mine.length - 1].transactionHash! }; break; }
          } catch { /* RPC rejected range, widen */ }
        }
        if (cancelled) return;
        if (!found) { setState("none"); return; }
        const tx = await publicClient.getTransaction({ hash: found.hash });
        const decoded = decodeFunctionData({ abi: CIPHER_TRADE_ABI, data: tx.input });
        if (cancelled) return;
        setTxHash(found.hash);
        setTxArgs(decoded.args as unknown as unknown[]);
        setState("ready");
      } catch { if (!cancelled) setState("none"); }
    })();
    return () => { cancelled = true; };
  }, [publicClient, address]);

  const short = (h: string) => (h?.length > 30 ? h.slice(0, 20) + "…" + h.slice(-8) : h ?? "");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(4,5,7,.75)", backdropFilter: "blur(4px)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 680, background: "#0d1218", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 24 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>🔒 Proof of encryption</div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: INNER, border: `1px solid ${BORDER}`, color: MUTED2, borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
        <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.55, marginBottom: 18 }}>
          This is the <b style={{ color: "#eef2f6" }}>actual data your last trade wrote to the public blockchain</b>, read back live. Direction, size and leverage are unreadable ciphertext — the values you typed appear nowhere.
        </div>

        {state === "loading" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: MUTED2, fontSize: 13, padding: "24px 0" }}>
            <span style={{ width: 14, height: 14, border: "2px solid #2a3540", borderTopColor: AMBER, borderRadius: "50%", display: "inline-block", animation: "spin .8s linear infinite" }} />
            Scanning chain for your transaction…
          </div>
        )}
        {state === "none" && (
          <div style={{ color: MUTED2, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
            No openPosition transaction found in recent blocks.<br />
            <span style={{ fontSize: 11 }}>Open a position first, then re-open this panel.</span>
          </div>
        )}
        {state === "ready" && (
          <>
            {[
              { label: "Direction (long/short)", val: txArgs[0] as string, enc: true },
              { label: "Size (units)", val: txArgs[1] as string, enc: true },
              { label: "Leverage (1×–20×)", val: txArgs[2] as string, enc: true },
              { label: "Entry price (public by design)", val: "$" + (Number(txArgs[4]) / 1e6).toFixed(2), enc: false },
            ].map(r => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 12, background: INNER, borderRadius: 9, padding: "11px 14px", marginBottom: 8 }}>
                <div style={{ minWidth: 190 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{r.label}</div>
                  <div style={{ fontSize: 10, color: r.enc ? "#fbbf24" : GREEN, fontFamily: MONO, marginTop: 2 }}>{r.enc ? "🔒 ENCRYPTED CIPHERTEXT" : "● public uint256"}</div>
                </div>
                <div style={{ flex: 1, fontFamily: MONO, fontSize: 11, color: r.enc ? "#5b6168" : "#eef2f6", wordBreak: "break-all", textAlign: "right" }}>{r.enc ? short(r.val) : r.val}</div>
              </div>
            ))}
          </>
        )}

        {/* Always show explorer links */}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          {txHash ? (
            <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer"
              style={{ flex: 1, display: "block", padding: "9px 0", fontSize: 12, fontFamily: MONO, color: AMBER, textAlign: "center", textDecoration: "none", background: "#1a150a", border: "1px solid #5e4a24", borderRadius: 9 }}>
              View tx on Etherscan ↗
            </a>
          ) : (
            <div style={{ flex: 1, padding: "9px 0", fontSize: 12, fontFamily: MONO, color: MUTED2, textAlign: "center", background: INNER, border: `1px solid ${BORDER}`, borderRadius: 9 }}>
              {state === "loading" ? "Loading tx…" : "Tx not found"}
            </div>
          )}
          <a href={`https://sepolia.etherscan.io/address/${CIPHER_TRADE_ADDRESS}#code`} target="_blank" rel="noreferrer"
            style={{ flex: 1, display: "block", padding: "9px 0", fontSize: 12, fontFamily: MONO, color: MUTED, textAlign: "center", textDecoration: "none", background: INNER, border: `1px solid ${BORDER}`, borderRadius: 9 }}>
            View contract ↗
          </a>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHART TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ChartTab({ address, livePrice }: { address: string; livePrice: number }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [tf, setTf] = useState("1H");
  const wsRef = useRef<WebSocket | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seriesRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entryLineRef = useRef<any>(null);
  const freshRef = useRef(false);          // true only right after a full REST load
  const candlesRef = useRef<Candle[]>([]);
  useEffect(() => { candlesRef.current = candles; }, [candles]);

  const fetchCandles = useCallback(async (interval: string) => {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=${interval}&limit=100`);
      const raw: [number, string, string, string, string, string][] = await res.json();
      const cs: Candle[] = raw.map(k => ({ o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], t: k[0] }));
      freshRef.current = true;
      setCandles(cs);
    } catch { /* keep fake */ }
  }, []);

  const connectWs = useCallback(() => {
    if (wsRef.current) wsRef.current.close();
    const ws = new WebSocket("wss://stream.binance.com:9443/ws/ethusdt@kline_" + TF_MAP[tf]);
    ws.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        const k = d.k;
        if (!k) return;
        const bar = { time: Math.floor(k.t / 1000) as number, open: +k.o, high: +k.h, low: +k.l, close: +k.c };
        seriesRef.current?.update(bar);
        setCandles(prev => {
          if (!prev.length) return prev;
          const next = [...prev];
          const last = { ...next[next.length - 1], c: +k.c, h: +k.h, l: +k.l };
          next[next.length - 1] = last;
          return next;
        });
      } catch { /* ignore */ }
    };
    ws.onerror = () => ws.close();
    wsRef.current = ws;
  }, [tf]);

  useEffect(() => {
    fetchCandles(TF_MAP[tf]);
    connectWs();
    return () => { wsRef.current?.close(); };
  }, [tf, fetchCandles, connectWs]);

  // contract reads
  const { data: positionData, refetch: refetchPosition } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getPosition", args: [address as `0x${string}`], query: { enabled: !!address, staleTime: 10_000 } }) as { data: [bigint, bigint, boolean, boolean] | undefined; refetch: () => void };
  const { data: isOpen, refetch: refetchOpen } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "isPositionOpen", args: [address as `0x${string}`], query: { enabled: !!address, staleTime: 10_000 } }) as { data: boolean | undefined; refetch: () => void };
  const { data: stakedFlag, refetch: refetchStake } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "staked", args: [address as `0x${string}`], query: { enabled: !!address, staleTime: 30_000 } }) as { data: boolean | undefined; refetch: () => void };
  const { data: followerCount } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [address as `0x${string}`], query: { enabled: !!address, staleTime: 30_000 } }) as { data: bigint | undefined };
  const { data: tpslSet, refetch: refetchTpsl } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "hasTPSL", args: [address as `0x${string}`], query: { enabled: !!address && !!isOpen, staleTime: 15_000 } }) as { data: boolean | undefined; refetch: () => void };

  const refetchAll = useCallback(() => { refetchOpen(); refetchStake(); refetchPosition(); refetchTpsl(); }, [refetchOpen, refetchStake, refetchPosition, refetchTpsl]);
  const isStaked = !!stakedFlag;
  const entryPrice = positionData ? Number(positionData[1]) / 1e6 : 0;
  const fCount = Number(followerCount ?? 0n);

  // form state
  const [dir, setDir] = useState<Dir>("LONG");
  const [size, setSize] = useState("2500");
  const [lev, setLev] = useState(2);
  // TP/SL — stored in localStorage so user can see what they set after encryption
  const tpslKey = `ct_tpsl_${address}`;
  const [savedTpSl, setSavedTpSl] = useState<{ tp: string; sl: string } | null>(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem(`ct_tpsl_${address}`) || "null"); } catch { return null; }
  });
  const [tp, setTp] = useState(savedTpSl?.tp ?? "");
  const [sl, setSl] = useState(savedTpSl?.sl ?? "");
  // The trader's own view of their (encrypted) position params, from localStorage.
  const posParamsKey = `ct_posparams_${address}`;
  // posMeta is either { dir,size,lev } (you opened it) or { copied,leader } (you
  // mirrored someone — its values are encrypted even to you).
  const [posMeta, setOpenParams] = useState<{ dir?: Dir; size?: number; lev?: number; copied?: boolean; leader?: string } | null>(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem(`ct_posparams_${address}`) || "null"); } catch { return null; }
  });
  const openParams = posMeta && posMeta.dir ? (posMeta as { dir: Dir; size: number; lev: number }) : null;
  const copiedFrom = posMeta && posMeta.copied ? posMeta.leader ?? null : null;
  // Whether we can show a real P&L for the user's own position. A mirrored/copied
  // position is sealed even to its owner, so we must NOT show a long-assumed number.
  const canSeeOwn = !!openParams;
  // unrealized P&L — direction-aware (short inverts), leverage-scaled to match settlement
  const posIsLong = openParams ? openParams.dir === "LONG" : true;
  const posLev = openParams?.lev ?? 1;
  const rawMovePct = isOpen && entryPrice > 0 ? ((livePrice - entryPrice) / entryPrice * 100) : 0;
  const unrealizedPct = (posIsLong ? rawMovePct : -rawMovePct) * posLev;
  const unrealizedBps = Math.round(unrealizedPct * 100);
  const pnlPositive = unrealizedPct >= 0;

  const [showTpSl, setShowTpSl] = useState(false);
  const [editTpSl, setEditTpSl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusOk, setStatusOk] = useState(false);
  const [encrypting, setEncrypting] = useState(false);
  const [showProof, setShowProof] = useState(false);

  const { writeContractAsync } = useWriteContract();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  function setErr(m: string) { setStatusMsg(m); setStatusOk(false); }
  function setOk(m: string) { setStatusMsg(m); setStatusOk(true); }

  // init lightweight-charts
  useEffect(() => {
    if (!chartContainerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;
    let ro: ResizeObserver | null = null;
    import("lightweight-charts").then(({ createChart, CrosshairMode, CandlestickSeries }) => {
      const el = chartContainerRef.current;
      if (!el) return;
      const w = el.offsetWidth || 600;
      const h = el.offsetHeight || 400;
      chart = createChart(el, {
        width: w, height: h,
        layout: { background: { color: "#0c1017" }, textColor: "#5b6168" },
        grid: { vertLines: { color: "#161e28" }, horzLines: { color: "#161e28" } },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: "#1e2a36", textColor: "#5b6168" },
        timeScale: { borderColor: "#1e2a36", timeVisible: true, secondsVisible: false },
        handleScroll: true, handleScale: true,
      });
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e", downColor: "#ef4444",
        borderUpColor: "#22c55e", borderDownColor: "#ef4444",
        wickUpColor: "#22c55e", wickDownColor: "#ef4444",
      });
      chartRef.current = chart;
      seriesRef.current = series;
      // if candles already loaded before the chart was ready, paint them once
      if (candlesRef.current.length) {
        series.setData(candlesRef.current.map(c => ({ time: Math.floor(c.t / 1000) as number, open: c.o, high: c.h, low: c.l, close: c.c })));
        chart.timeScale().fitContent();
        freshRef.current = false;
      }
      ro = new ResizeObserver(() => {
        const c = chartContainerRef.current;
        if (c && chart) chart.applyOptions({ width: c.offsetWidth, height: c.offsetHeight });
      });
      ro.observe(el);
    });
    return () => { ro?.disconnect(); chart?.remove(); chartRef.current = null; seriesRef.current = null; };
  }, []);

  // push candles into chart ONLY on a fresh REST load (timeframe change / first load).
  // WS price ticks update the last candle in-place via series.update() and must NOT
  // reset the user's pan/zoom — so we skip setData/fitContent for those.
  useEffect(() => {
    if (!seriesRef.current || !candles.length || !freshRef.current) return;
    freshRef.current = false;
    const bars = candles.map(c => ({ time: Math.floor(c.t / 1000) as number, open: c.o, high: c.h, low: c.l, close: c.c }));
    seriesRef.current.setData(bars);
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tpLineRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slLineRef = useRef<any>(null);

  // entry price line
  useEffect(() => {
    if (!seriesRef.current) return;
    if (entryLineRef.current) { seriesRef.current.removePriceLine(entryLineRef.current); entryLineRef.current = null; }
    if (isOpen && entryPrice > 0) {
      entryLineRef.current = seriesRef.current.createPriceLine({
        price: entryPrice, color: "#fbbf24", lineWidth: 1, lineStyle: 1,
        axisLabelVisible: true, title: "🔒 Entry",
      });
    }
  }, [isOpen, entryPrice]);

  // TP/SL price lines on chart
  useEffect(() => {
    if (!seriesRef.current) return;
    if (tpLineRef.current) { try { seriesRef.current.removePriceLine(tpLineRef.current); } catch { /**/ } tpLineRef.current = null; }
    if (slLineRef.current) { try { seriesRef.current.removePriceLine(slLineRef.current); } catch { /**/ } slLineRef.current = null; }
    if (isOpen && savedTpSl) {
      const tpVal = Number(savedTpSl.tp);
      const slVal = Number(savedTpSl.sl);
      if (tpVal > 0) tpLineRef.current = seriesRef.current.createPriceLine({ price: tpVal, color: "#4ade80", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "🔒 TP" });
      if (slVal > 0) slLineRef.current = seriesRef.current.createPriceLine({ price: slVal, color: "#f87171", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "🔒 SL" });
    }
  }, [isOpen, savedTpSl]);

  async function handleOpen() {
    if (!size || !walletClient) return;
    setLoading(true); setStatusMsg("Initializing FHE…"); setEncrypting(true);
    try {
      // Let the browser paint the loading state BEFORE the synchronous FHE WASM
      // work blocks the main thread — otherwise the button feels frozen on first click.
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const fhevm = await getFhevm(); // cached/preloaded singleton
      setStatusMsg("Encrypting…");
      const input = fhevm.createEncryptedInput(CIPHER_TRADE_ADDRESS, address);
      input.addBool(dir === "LONG"); input.add64(BigInt(Math.floor(Number(size)))); input.add64(BigInt(lev));
      const encrypted = await input.encrypt();
      setStatusMsg("Broadcasting…");
      // snapshot the live ETH price (6 decimals) as the on-chain entry price
      const price6 = BigInt(Math.round(livePrice * 1e6));
      const hash = await writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "openPosition", args: [toHex(encrypted.handles[0]), toHex(encrypted.handles[1]), toHex(encrypted.handles[2]), toHex(encrypted.inputProof), price6] });
      setStatusMsg("Confirming…");
      await publicClient?.waitForTransactionReceipt({ hash });
      // Store the trader's own view of their params (display only; settlement
      // decrypts the real ciphertext server-side and never trusts this).
      const params = { dir, size: Math.floor(Number(size)), lev };
      localStorage.setItem(posParamsKey, JSON.stringify(params));
      setOpenParams(params);
      setOk("Position sealed on-chain."); refetchAll();
    } catch (e: unknown) { setErr((e instanceof Error ? e.message.slice(0, 100) : String(e))); }
    setEncrypting(false); setLoading(false);
  }

  async function handleClose() {
    setLoading(true); setStatusMsg("Closing…");
    try {
      const price6 = BigInt(Math.round(livePrice * 1e6));
      const hash = await writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "closePosition", args: [price6] });
      setStatusMsg("Confirming…");
      await publicClient?.waitForTransactionReceipt({ hash });
      localStorage.removeItem(tpslKey);
      setSavedTpSl(null); setTp(""); setSl("");
      // Auto-settle: the server decrypts the REAL on-chain ciphertext (direction,
      // size, leverage) and submits it. We only pass the trader address — no
      // plaintext is trusted from the browser.
      setStatusMsg("Settling…");
      try {
        await fetch("/api/settle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trader: address }),
        });
      } catch { /* settle errors are non-fatal; KMS can settle later */ }
      localStorage.removeItem(posParamsKey);
      setOpenParams(null);
      setOk("Position closed & settled."); refetchAll();
    } catch (e: unknown) { setErr((e instanceof Error ? e.message.slice(0, 100) : String(e))); }
    setLoading(false);
  }

  async function handleStake() {
    setLoading(true);
    try {
      const hash = await writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: isStaked ? "unstake" : "stake" });
      await publicClient?.waitForTransactionReceipt({ hash });
      setOk(isStaked ? "Unstaked." : "Staked. 18% fee enabled."); refetchStake();
    } catch (e: unknown) { setErr((e instanceof Error ? e.message.slice(0, 100) : String(e))); }
    setLoading(false);
  }

  async function handleSetTpSl() {
    if (!tp || !sl || !walletClient) return;
    setLoading(true); setStatusMsg(""); setEncrypting(true);
    try {
      setStatusMsg("Encrypting TP/SL…");
      // Let the browser paint the loading state BEFORE the synchronous FHE WASM
      // work blocks the main thread — otherwise the tab feels unresponsive.
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const fhevm = await getFhevm();
      const input = fhevm.createEncryptedInput(CIPHER_TRADE_ADDRESS, address);
      input.add64(BigInt(Math.round(Number(tp) * 1e6)));
      input.add64(BigInt(Math.round(Number(sl) * 1e6)));
      const encrypted = await input.encrypt();
      setStatusMsg("Broadcasting…");
      const hash = await writeContractAsync({
        address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "setTPSL",
        args: [toHex(encrypted.handles[0]), toHex(encrypted.handles[1]), toHex(encrypted.inputProof)],
      });
      setStatusMsg("Confirming…");
      await publicClient?.waitForTransactionReceipt({ hash });
      // Persist locally so user can see their own encrypted targets
      const saved = { tp, sl };
      localStorage.setItem(tpslKey, JSON.stringify(saved));
      setSavedTpSl(saved);
      setOk("🔒 TP/SL sealed on-chain."); refetchTpsl(); setShowTpSl(false); setEditTpSl(false);
    } catch (e: unknown) { setErr((e instanceof Error ? e.message.slice(0, 100) : String(e))); }
    setEncrypting(false); setLoading(false);
  }

  const last = candles[candles.length - 1] ?? { o: livePrice, h: livePrice, l: livePrice, c: livePrice, v: 0, t: 0 };
  const first24 = candles[0] ?? last;
  const high24 = Math.max(...candles.map(c => c.h));
  const low24 = Math.min(...candles.map(c => c.l));
  const vol24 = candles.reduce((s, c) => s + c.v, 0);
  const change24 = ((livePrice - first24.o) / first24.o * 100).toFixed(2);
  const isUp = livePrice >= first24.o;

  // REAL on-chain ciphertext handle for the mempool strip (the encrypted size euint64).
  // When no position is open we show a placeholder.
  const sizeHandle = positionData?.[0] ? (positionData[0] as unknown as string) : null;
  const cipherSize = sizeHandle && sizeHandle !== "0x0000000000000000000000000000000000000000000000000000000000000000"
    ? sizeHandle.slice(0, 14) + "…" + sizeHandle.slice(-6)
    : "— no open position";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
      {showProof && <EncryptionProof address={address} onClose={() => setShowProof(false)} />}
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
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {["15m", "1H", "4H", "1D"].map(t => (
                <button key={t} onClick={() => setTf(t)} style={{ padding: "4px 11px", borderRadius: 7, fontSize: 12, fontWeight: 600, fontFamily: MONO, border: "none", cursor: "pointer", background: tf === t ? "#1e2a36" : "transparent", color: tf === t ? "#eef2f6" : MUTED2 }}>
                  {t}
                </button>
              ))}
              <div style={{ width: 1, height: 14, background: BORDER, margin: "0 3px" }} />
              <button onClick={() => setShowProof(true)} style={{ background: "#241b0c", border: "1px solid #5e4a24", color: "#fbbf24", fontFamily: MONO, fontSize: 10.5, padding: "3px 9px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: AMBER, display: "inline-block", animation: "pulse-glow 2s ease-in-out infinite" }} />
                🔒 Proof of encryption
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, fontFamily: MONO, color: MUTED2 }}>
              <span>O <span style={{ color: "#aeb8c4" }}>${last.o.toFixed(2)}</span></span>
              <span>H <span style={{ color: GREEN }}>${Math.max(last.h, livePrice).toFixed(2)}</span></span>
              <span>L <span style={{ color: RED_SOFT }}>${Math.min(last.l, livePrice).toFixed(2)}</span></span>
              <span>C <span style={{ color: isUp ? GREEN : RED_SOFT }}>${livePrice.toFixed(2)}</span></span>
            </div>
          </div>

          {/* chart */}
          <div style={{ position: "relative", flex: 1, minHeight: 320, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <div ref={chartContainerRef} style={{ width: "100%", height: "100%", minHeight: 320 }} />
            {encrypting && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(8,9,12,.82)", backdropFilter: "blur(3px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <div style={{ fontSize: 13, fontFamily: MONO, color: "#fbbf24", display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 13, height: 13, border: "2px solid #5e4a24", borderTopColor: AMBER, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />
                  Encrypting with FHE…
                </div>
              </div>
            )}
          </div>

          {/* mempool strip — shows the REAL encrypted size handle stored on-chain */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 10.5, fontFamily: MONO, color: MUTED2, flexShrink: 0, padding: "0 2px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: AMBER, opacity: .6, display: "inline-block" }} />
              encrypted size euint64:
            </span>
            <span>size=<span style={{ color: "#7d8896" }}>{cipherSize}</span></span>
            <span style={{ marginLeft: "auto", color: GREEN, display: "flex", alignItems: "center", gap: 5 }}>● chain stores ciphertext only</span>
          </div>
        </div>

        {/* side panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12, overflowY: "auto" }}>
          {/* position card */}
          {isOpen ? (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 13, padding: 14, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "#aeb8c4" }}>{copiedFrom ? "Mirrored position" : "Your position"}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: GREEN, background: "rgba(74,222,128,.08)", padding: "3px 9px", borderRadius: 20, fontWeight: 600, border: "1px solid rgba(74,222,128,.15)" }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, display: "inline-block" }} />OPEN
                </span>
              </div>
              {copiedFrom && (
                <div style={{ fontSize: 10, color: "#fbbf24", background: "#241b0c", border: "1px solid #5e4a24", borderRadius: 8, padding: "7px 10px", marginBottom: 8, fontFamily: MONO, lineHeight: 1.4 }}>
                  🔒 Copied from {fmt(copiedFrom)} — direction, size &amp; P&L are encrypted even to you, revealed only at settlement.
                </div>
              )}
              <div style={{ display: "flex", gap: 7, marginBottom: 8 }}>
                <div style={{ flex: 1, background: INNER, borderRadius: 9, padding: 10 }}>
                  <div style={{ fontSize: 9, color: MUTED2, marginBottom: 3 }}>Direction</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: canSeeOwn ? (posIsLong ? GREEN : RED_SOFT) : MUTED }}>{canSeeOwn ? (posIsLong ? "▲ Long" : "▼ Short") : "🔒 Sealed"}</div>
                  <div style={{ fontSize: 9, color: MUTED2, marginTop: 2, fontFamily: MONO }}>{canSeeOwn ? "🔒 sealed to others" : "encrypted"}</div>
                </div>
                <div style={{ flex: 1, background: INNER, borderRadius: 9, padding: 10 }}>
                  <div style={{ fontSize: 9, color: MUTED2, marginBottom: 3 }}>Size {canSeeOwn && openParams ? `· ${openParams.lev}×` : ""}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO }}>{canSeeOwn && openParams ? openParams.size.toLocaleString() : "🔒"}</div>
                  <div style={{ fontSize: 9, color: MUTED2, marginTop: 2, fontFamily: MONO }}>{canSeeOwn ? "🔒 sealed to others" : "encrypted"}</div>
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
              {canSeeOwn ? (
                <div style={{ background: pnlPositive ? "rgba(34,197,94,.07)" : "rgba(239,68,68,.07)", borderRadius: 10, padding: 11, marginBottom: 11 }}>
                  <div style={{ fontSize: 9, color: pnlPositive ? "rgba(74,222,128,.7)" : "rgba(252,165,165,.7)", marginBottom: 1 }}>Unrealized P&L</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: pnlPositive ? GREEN : RED_SOFT, fontFamily: MONO, lineHeight: 1.1 }}>{pnlPositive ? "+" : ""}{unrealizedPct.toFixed(2)}%</div>
                  <div style={{ fontSize: 10, color: pnlPositive ? "rgba(74,222,128,.7)" : "rgba(252,165,165,.7)", marginTop: 1, fontFamily: MONO }}>{pnlPositive ? "+" : ""}{unrealizedBps} bps</div>
                </div>
              ) : (
                <div style={{ background: "rgba(245,158,11,.06)", border: "1px solid #5e4a24", borderRadius: 10, padding: 11, marginBottom: 11 }}>
                  <div style={{ fontSize: 9, color: "rgba(251,191,36,.7)", marginBottom: 2 }}>Unrealized P&L</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#fbbf24", fontFamily: MONO, lineHeight: 1.1 }}>🔒 Sealed</div>
                  <div style={{ fontSize: 10, color: MUTED2, marginTop: 2, fontFamily: MONO }}>computed on close — even you can&apos;t peek</div>
                </div>
              )}
              {/* TP/SL card */}
              {(!tpslSet && !savedTpSl) || editTpSl ? (
                <div style={{ marginBottom: 11 }}>
                  {(!showTpSl && !editTpSl) ? (
                    <button onClick={() => setShowTpSl(true)} style={{ width: "100%", padding: "8px 0", border: "1px solid #1e3a2a", background: "rgba(34,197,94,.05)", color: GREEN, fontSize: 11, fontWeight: 600, borderRadius: 9, cursor: "pointer", fontFamily: SANS }}>
                      🔒 Set encrypted TP/SL
                    </button>
                  ) : (
                    <div style={{ background: INNER, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 11 }}>
                      <div style={{ fontSize: 10, color: GREEN, fontWeight: 600, marginBottom: 5 }}>🔒 {editTpSl ? "Edit" : "Encrypt"} Take-Profit / Stop-Loss</div>
                      <div style={{ fontSize: 9, color: MUTED2, marginBottom: 8, lineHeight: 1.4 }}>Sealed on-chain — copiers &amp; front-runners can never see your targets.</div>
                      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: GREEN, marginBottom: 3 }}>Take Profit $</div>
                          <input type="number" value={tp} onChange={e => setTp(e.target.value)} placeholder={(livePrice * 1.05).toFixed(0)} style={{ width: "100%", background: "#0a120a", border: "1px solid #1e3a2a", borderRadius: 7, padding: "7px 9px", color: "#eef2f6", fontSize: 13, fontFamily: MONO, boxSizing: "border-box" }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 9, color: RED_SOFT, marginBottom: 3 }}>Stop Loss $</div>
                          <input type="number" value={sl} onChange={e => setSl(e.target.value)} placeholder={(livePrice * 0.95).toFixed(0)} style={{ width: "100%", background: "#120a0a", border: "1px solid #3a1e1e", borderRadius: 7, padding: "7px 9px", color: "#eef2f6", fontSize: 13, fontFamily: MONO, boxSizing: "border-box" }} />
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { setShowTpSl(false); setEditTpSl(false); }} style={{ flex: 1, padding: "7px 0", background: "transparent", border: `1px solid ${BORDER}`, color: MUTED2, fontSize: 11, borderRadius: 8, cursor: "pointer" }}>Cancel</button>
                        <button onClick={handleSetTpSl} disabled={loading || !tp || !sl} style={{ flex: 2, padding: "7px 0", background: (!tp || !sl) ? "#131a22" : "rgba(34,197,94,.12)", border: "1px solid #1e3a2a", color: GREEN, fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          {loading ? <><span style={{ width: 10, height: 10, border: "2px solid #1a3a20", borderTopColor: GREEN, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />{statusMsg || "Encrypting…"}</> : "🔒 Seal TP/SL"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ background: "rgba(34,197,94,.04)", border: "1px solid #1e3a2a", borderRadius: 9, padding: "9px 11px", marginBottom: 11 }}>
                  <div style={{ display: "flex", alignItems: "center", marginBottom: savedTpSl ? 7 : 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: GREEN }}>🔒 TP/SL sealed on-chain</span>
                    <button onClick={() => { setTp(savedTpSl?.tp ?? ""); setSl(savedTpSl?.sl ?? ""); setEditTpSl(true); setShowTpSl(true); }} style={{ marginLeft: "auto", fontSize: 10, color: MUTED2, background: "transparent", border: "none", cursor: "pointer", fontFamily: MONO }}>Edit ✎</button>
                  </div>
                  {savedTpSl && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <div style={{ flex: 1, background: "#0a120a", borderRadius: 7, padding: "6px 8px" }}>
                        <div style={{ fontSize: 8, color: GREEN, marginBottom: 1 }}>TP (you set)</div>
                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO, color: GREEN }}>${Number(savedTpSl.tp).toLocaleString()}</div>
                      </div>
                      <div style={{ flex: 1, background: "#120a0a", borderRadius: 7, padding: "6px 8px" }}>
                        <div style={{ fontSize: 8, color: RED_SOFT, marginBottom: 1 }}>SL (you set)</div>
                        <div style={{ fontSize: 13, fontWeight: 600, fontFamily: MONO, color: RED_SOFT }}>${Number(savedTpSl.sl).toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 9, color: MUTED2, marginTop: 5, fontFamily: MONO }}>encrypted on-chain · invisible to copiers</div>
                </div>
              )}
              <button onClick={handleClose} disabled={loading} style={{ width: "100%", padding: 10, border: "1px solid rgba(252,165,165,.2)", background: "rgba(252,165,165,.06)", color: RED_SOFT, fontSize: 12, fontWeight: 600, borderRadius: 9, cursor: loading ? "not-allowed" : "pointer", fontFamily: SANS, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                {loading ? <><span style={{ width: 12, height: 12, border: "2px solid rgba(252,165,165,.2)", borderTopColor: RED_SOFT, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite", flexShrink: 0 }} />{statusMsg || "Closing…"}</> : "Close & settle"}
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
              {/* leverage — also encrypted */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: MUTED }}>Leverage 🔒</span>
                <span style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, color: AMBER }}>{lev}×</span>
              </div>
              <input type="range" min={1} max={20} step={1} value={lev} onChange={e => setLev(Number(e.target.value))} style={{ width: "100%", marginBottom: 4, accentColor: AMBER }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: MUTED2, fontFamily: MONO, marginBottom: 12 }}>
                <span>1×</span><span>10×</span><span>20×</span>
              </div>
              <div style={{ background: INNER, borderRadius: 8, padding: 10, marginBottom: 11, display: "flex", flexDirection: "column", gap: 6 }}>
                {[["Order value", "$" + (Number(size) || 0).toLocaleString()], ["Notional", "$" + ((Number(size) || 0) * lev).toLocaleString()], ["Encrypted with", "FHE / tfhe-rs"]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: MUTED }}>{k}</span>
                    <span style={{ fontFamily: MONO, color: k === "Encrypted with" ? "#fbbf24" : "#eef2f6" }}>{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={handleOpen} disabled={loading || !size} className="ct-encrypt-btn" style={{ width: "100%", padding: 12, border: "none", background: loading ? "#2a1e00" : size ? AMBER : "#1a2030", color: loading ? AMBER : size ? "#0c0a06" : MUTED, fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: (loading || !size) ? "not-allowed" : "pointer", fontFamily: SANS, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, boxShadow: (!loading && size) ? "0 0 18px rgba(245,158,11,.25)" : "none" }}>
                {loading
                  ? <><span style={{ width: 13, height: 13, border: "2px solid #5e4a00", borderTopColor: AMBER, borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite", flexShrink: 0 }} />{statusMsg || "Processing…"}</>
                  : <>🔒 Encrypt &amp; open</>}
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

// Search a trader by username and open their profile.
function UsernameSearch() {
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const publicClient = usePublicClient();
  const openProfile = useOpenProfile();

  async function go() {
    const name = q.trim();
    if (name.length < 3 || !publicClient) return;
    setBusy(true); setErr("");
    try {
      const addr = await publicClient.readContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "resolveUsername", args: [name] }) as `0x${string}`;
      if (!addr || addr === "0x0000000000000000000000000000000000000000") setErr("not found");
      else { openProfile(addr); setQ(""); }
    } catch { setErr("error"); }
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <input value={q} onChange={e => { setQ(e.target.value.replace(/[^A-Za-z0-9_]/g, "")); setErr(""); }} onKeyDown={e => e.key === "Enter" && go()} placeholder="open @username" style={{ width: 150, padding: "7px 11px", background: INNER, border: `1px solid ${err ? "#4a1515" : BORDER}`, borderRadius: 8, color: "#eef2f6", fontSize: 12, fontFamily: MONO }} />
      <button onClick={go} disabled={busy || q.trim().length < 3} style={{ padding: "7px 12px", background: INNER, border: `1px solid ${BORDER}`, color: "#aeb8c4", fontSize: 12, borderRadius: 8, cursor: "pointer", fontFamily: MONO }}>{busy ? "…" : err || "↗"}</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DISCOVER TAB
// ═══════════════════════════════════════════════════════════════════════════════
function DiscoverTab({ address, livePrice }: { address: string; livePrice: number }) {
  const [following, setFollowing] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem("ct_following") || "[]")); } catch { return new Set(); }
  });
  const [followModal, setFollowModal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: traderAddrs } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getTraders", query: { staleTime: 30_000 } }) as { data: readonly `0x${string}`[] | undefined };
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [followErr, setFollowErr] = useState("");

  const liveTraders2 = traderAddrs ?? [];
  const usingMock2 = liveTraders2.length === 0;
  // Batch: 3 slots per trader [traderStats, getFollowerCount, usernames]
  const { data: discoverBatch } = useReadContracts({
    contracts: liveTraders2.flatMap(a => ([
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [a] } as const,
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [a] } as const,
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "usernames", args: [a] } as const,
    ])),
    query: { enabled: !usingMock2, staleTime: 30_000 },
  });

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
    setLoading(true); setFollowErr("");
    try {
      // Homomorphic copy: opens a sealed mirror of the leader's encrypted position
      // for the follower at the current entry price. No value is ever decrypted.
      const price6 = BigInt(Math.round(livePrice * 1e6));
      const hash = await writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "copyTrade", args: [followModal as `0x${string}`, 1n, price6] });
      await publicClient?.waitForTransactionReceipt({ hash });
      // Mark this as a mirrored position the follower CANNOT introspect — its
      // direction/size are encrypted even to them. The Chart/Portfolio tabs read
      // this to show a sealed view instead of a misleading long-assumed P&L.
      localStorage.setItem(`ct_posparams_${address}`, JSON.stringify({ copied: true, leader: followModal }));
      toggleFollow(followModal); setFollowModal(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setFollowErr(
        msg.includes("no open position") ? "trader has no open position to copy"
        : msg.includes("close your position") ? "close your own position before copying"
        : msg.includes("cannot copy yourself") ? "you can't copy your own position"
        : "copy failed"
      );
    }
    setLoading(false);
  }

  const liveTraders = liveTraders2;
  const usingMock = usingMock2;
  const traders = usingMock ? MOCK_TRADERS.map(t => t.addr as `0x${string}`) : liveTraders;

  return (
    <div style={{ padding: "18px 22px", maxWidth: 1240, margin: "0 auto", width: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Discover traders</div>
          <div style={{ fontSize: 13, color: MUTED }}>Follow proven returns. Direction &amp; size stay encrypted — you copy the record, not the trade.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <UsernameSearch />
          {usingMock && <div style={{ fontSize: 10, color: MUTED2, background: INNER, border: `1px solid ${BORDER}`, padding: "6px 10px", borderRadius: 7, fontFamily: MONO }}>demo data</div>}
          <div style={{ fontSize: 11, color: "#fbbf24", background: "#241b0c", border: "1px solid #5e4a24", padding: "8px 14px", borderRadius: 9, fontFamily: MONO }}>Following {following.size} traders</div>
        </div>
      </div>

      <>
        {/* featured */}
        <DiscoverFeatured addr={traders[0]} isFollowing={following.has(traders[0])} isSelf={traders[0].toLowerCase() === address.toLowerCase()} onFollow={() => setFollowModal(traders[0])} onUnfollow={() => toggleFollow(traders[0])} mockData={usingMock ? MOCK_TRADERS[0] : undefined}
          prefetchedStats={discoverBatch?.[0]?.result as [bigint,bigint,bigint] | undefined}
          prefetchedFCount={discoverBatch?.[1]?.result as bigint | undefined}
          prefetchedUsername={discoverBatch?.[2]?.result as string | undefined}
        />
        {/* grid */}
        {traders.length > 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
            {traders.slice(1).map((addr, i) => (
              <DiscoverCard key={addr} addr={addr} isFollowing={following.has(addr)} isSelf={addr.toLowerCase() === address.toLowerCase()} onFollow={() => setFollowModal(addr)} onUnfollow={() => toggleFollow(addr)} mockData={usingMock ? MOCK_TRADERS[i + 1] : undefined}
                prefetchedStats={discoverBatch?.[(i + 1) * 3]?.result as [bigint,bigint,bigint] | undefined}
                prefetchedFCount={discoverBatch?.[(i + 1) * 3 + 1]?.result as bigint | undefined}
                prefetchedUsername={discoverBatch?.[(i + 1) * 3 + 2]?.result as string | undefined}
              />
            ))}
          </div>
        )}
      </>

      {/* follow modal */}
      {followModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(6,9,13,.85)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20 }}>
          <div style={{ width: 420, maxWidth: "100%", background: CARD, border: "1px solid #6b5320", borderRadius: 18, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 17 }}>{initial(followModal)}</div>
              <div><div style={{ fontSize: 16, fontWeight: 600 }}>Follow {fmt(followModal)}</div><div style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>Sepolia testnet</div></div>
            </div>
            <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.55, margin: "12px 0 16px" }}>This opens a <b style={{ color: "#eef2f6" }}>1:1 sealed mirror</b> of their position — their encrypted direction, size &amp; leverage are copied straight into yours under FHE. You never see the values, and neither does the mempool. You close &amp; settle it on your own entry/exit.</div>
            <div style={{ background: INNER, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px", marginBottom: 18, display: "flex", flexDirection: "column", gap: 8 }}>
              {[["Mirror", "1:1 of leader's sealed position"], ["Entry price", "$" + livePrice.toFixed(2)], ["Visible to you", "🔒 nothing until settlement"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: MUTED }}>{k}</span>
                  <span style={{ fontFamily: MONO, color: "#eef2f6" }}>{v}</span>
                </div>
              ))}
            </div>
            {followErr && <div style={{ fontSize: 11, color: RED_SOFT, fontFamily: MONO, marginBottom: 12, textAlign: "center" }}>{followErr}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setFollowModal(null)} style={{ flex: 1, padding: 12, background: "#131a22", border: `1px solid ${BORDER}`, color: "#aeb8c4", fontSize: 13, fontWeight: 600, borderRadius: 11, cursor: "pointer" }}>Cancel</button>
              <button onClick={confirmFollow} disabled={loading} style={{ flex: 2, padding: 12, background: AMBER, border: "none", color: "#0c0a06", fontSize: 13, fontWeight: 700, borderRadius: 11, cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>{loading ? <><span style={{ width: 12, height: 12, border: "2px solid #5e4a00", borderTopColor: "#0c0a06", borderRadius: "50%", display: "inline-block", animation: "spin .7s linear infinite" }} />Mirroring…</> : "🔒 Copy position"}</button>
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

type MockTrader = typeof MOCK_TRADERS[0];
function DiscoverFeatured({ addr, isFollowing, isSelf, onFollow, onUnfollow, mockData, prefetchedStats, prefetchedFCount, prefetchedUsername }: { addr: string; isFollowing: boolean; isSelf: boolean; onFollow: () => void; onUnfollow: () => void; mockData?: MockTrader; prefetchedStats?: [bigint,bigint,bigint]; prefetchedFCount?: bigint; prefetchedUsername?: string }) {
  const [total, , pnlBps] = mockData ? [mockData.total, mockData.wins, mockData.pnlBps] : (prefetchedStats ?? [0n, 0n, 0n]);
  const fCount = mockData ? mockData.followers : (prefetchedFCount ?? 0n);
  const pct = (Number(pnlBps) / 100).toFixed(1);
  const isPos = Number(pnlBps) >= 0;
  const bars = [30, 45, 38, 55, 62, 58, 72, 80, 88];
  const displayName = mockData?.name ?? resolvedName(prefetchedUsername, addr);
  const openProfile = useOpenProfile();

  return (
    <div style={{ background: CARD, border: "1px solid #6b5320", borderRadius: 16, padding: 22, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 240px", gap: 22, alignItems: "center" }}>
      <div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
          <div onClick={() => openProfile(addr)} style={{ width: 46, height: 46, borderRadius: 12, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 20, cursor: "pointer" }}>{displayName[0]?.toUpperCase()}</div>
          <div style={{ flex: 1 }}>
            <div onClick={() => openProfile(addr)} style={{ fontSize: 17, fontWeight: 600, cursor: "pointer" }}>{displayName}</div>
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

function DiscoverCard({ addr, isFollowing, isSelf, onFollow, onUnfollow, mockData, prefetchedStats, prefetchedFCount, prefetchedUsername }: { addr: string; isFollowing: boolean; isSelf: boolean; onFollow: () => void; onUnfollow: () => void; mockData?: MockTrader; prefetchedStats?: [bigint,bigint,bigint]; prefetchedFCount?: bigint; prefetchedUsername?: string }) {
  const [total, , pnlBps] = mockData ? [mockData.total, mockData.wins, mockData.pnlBps] : (prefetchedStats ?? [0n, 0n, 0n]);
  const fCount = mockData ? mockData.followers : (prefetchedFCount ?? 0n);
  const pct = (Number(pnlBps) / 100).toFixed(1);
  const isPos = Number(pnlBps) >= 0;
  const bars = [42, 50, 44, 56, 60, 52, 68, 62, 70];
  const displayName = mockData?.name ?? resolvedName(prefetchedUsername, addr);
  const openProfile = useOpenProfile();

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 17 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 13 }}>
        <div onClick={() => openProfile(addr)} style={{ width: 38, height: 38, borderRadius: 10, background: "#161d25", display: "flex", alignItems: "center", justifyContent: "center", color: "#aeb8c4", fontWeight: 700, fontSize: 15, flexShrink: 0, cursor: "pointer" }}>{displayName[0]?.toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div onClick={() => openProfile(addr)} style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" }}>{displayName}</div>
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
  const { data: traderAddrs } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getTraders", query: { staleTime: 30_000 } }) as { data: readonly `0x${string}`[] | undefined };
  const followed = (traderAddrs ?? []).filter(a => following.includes(a.toLowerCase()) || following.includes(a));

  // Batch: 3 slots per followed trader [traderStats, isPositionOpen, usernames]
  const { data: followBatch } = useReadContracts({
    contracts: followed.flatMap(a => ([
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [a] } as const,
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "isPositionOpen", args: [a] } as const,
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "usernames", args: [a] } as const,
    ])),
    query: { enabled: followed.length > 0, staleTime: 30_000 },
  });

  return (
    <div style={{ padding: "18px 22px", maxWidth: 1240, margin: "0 auto", width: "100%", overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Mirrored traders", value: followed.length.toString(), color: "#eef2f6" },
          { label: "Est. total P&L", value: "🔒 on settle", color: "#fbbf24" },
          { label: "Mirror type", value: "1:1 sealed", color: "#eef2f6" },
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
          {followed.map((addr, i) => <FollowingRow key={addr} addr={addr}
            prefetchedStats={followBatch?.[i * 3]?.result as [bigint,bigint,bigint] | undefined}
            prefetchedPosOpen={followBatch?.[i * 3 + 1]?.result as boolean | undefined}
            prefetchedUsername={followBatch?.[i * 3 + 2]?.result as string | undefined}
          />)}
        </div>
      )}

      {followed.length > 0 && (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#aeb8c4", marginBottom: 12 }}>Settled positions</div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", background: INNER, padding: "10px 16px" }}>
              {["TRADER", "SIZE / LEV", "DIRECTION", "P&L", "DATE"].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 600, color: MUTED2, fontFamily: MONO }}>{h}</div>
              ))}
            </div>
            <FollowedSettled traders={followed} />
          </div>
        </>
      )}
    </div>
  );
}

// Settled trades from the traders you follow (their public, revealed track record).
function FollowedSettled({ traders }: { traders: readonly string[] }) {
  const { data } = useReadContracts({
    contracts: traders.flatMap(a => ([
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getTradeHistory", args: [a as `0x${string}`] } as const,
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "usernames", args: [a as `0x${string}`] } as const,
    ])),
    query: { enabled: traders.length > 0, staleTime: 30_000 },
  });

  type Row = { addr: string; entryPrice: bigint; exitPrice: bigint; direction: boolean; size: bigint; leverage: bigint; pnlBps: bigint; timestamp: bigint };
  const rows: Row[] = [];
  const usernameMap: Record<string, string> = {};
  traders.forEach((a, i) => {
    const hist = data?.[i * 2]?.result as readonly Omit<Row, "addr">[] | undefined;
    const username = data?.[i * 2 + 1]?.result as string | undefined;
    if (username) usernameMap[a] = username;
    hist?.forEach(h => rows.push({ addr: a, ...h }));
  });
  rows.sort((x, y) => Number(y.timestamp) - Number(x.timestamp));

  if (rows.length === 0) return <div style={{ padding: "14px 16px", color: MUTED2, fontSize: 12, textAlign: "center" }}>No settled positions from followed traders yet</div>;

  return (
    <>
      {rows.slice(0, 20).map((r, i) => {
        const pnl = Number(r.pnlBps) / 100;
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr", padding: "12px 16px", borderTop: `1px solid ${BORDER2}`, alignItems: "center", fontSize: 12, fontFamily: MONO }}>
            <FollowedName addr={r.addr} prefetchedUsername={usernameMap[r.addr]} />
            <div style={{ color: "#aeb8c4" }}>{r.size.toString()} <span style={{ color: AMBER }}>{r.leverage.toString()}×</span></div>
            <div><span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 5, background: r.direction ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)", color: r.direction ? GREEN : RED }}>{r.direction ? "LONG" : "SHORT"}</span></div>
            <div style={{ color: pnl >= 0 ? GREEN : RED_SOFT, fontWeight: 700 }}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%</div>
            <div style={{ color: MUTED2 }}>{new Date(Number(r.timestamp) * 1000).toLocaleDateString()}</div>
          </div>
        );
      })}
    </>
  );
}

function FollowedName({ addr, prefetchedUsername }: { addr: string; prefetchedUsername?: string }) {
  const openProfile = useOpenProfile();
  return <div onClick={() => openProfile(addr)} style={{ color: "#eef2f6", cursor: "pointer" }}>{resolvedName(prefetchedUsername, addr)}</div>;
}

function FollowingRow({ addr, prefetchedStats, prefetchedPosOpen, prefetchedUsername }: { addr: string; prefetchedStats?: [bigint,bigint,bigint]; prefetchedPosOpen?: boolean; prefetchedUsername?: string }) {
  const [, , pnlBps] = prefetchedStats ?? [0n, 0n, 0n];
  const posOpen = prefetchedPosOpen;
  const displayName = resolvedName(prefetchedUsername, addr);
  const openProfile = useOpenProfile();

  return (
    <div style={{ background: CARD, border: `1px solid ${posOpen ? "rgba(34,197,94,.2)" : BORDER}`, borderRadius: 14, padding: 16, display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 0, alignItems: "center" }}>
      <div onClick={() => openProfile(addr)} style={{ display: "flex", alignItems: "center", gap: 11, marginRight: 18, cursor: "pointer" }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{displayName[0]?.toUpperCase()}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{displayName}</div>
          <div style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginTop: 1 }}>{addr.slice(0, 10)}…{addr.slice(-6)}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[["Direction", "🔒 sealed"], ["Size", "🔒 sealed"], ["Copy", "1:1 mirror"], ["Since", "now"]].map(([k, v]) => (
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
  const { data: stakedFlag, refetch: refetchStake } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "staked", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: boolean | undefined; refetch: () => void };
  const { data: claimedFaucet, refetch: refetchFaucet } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "claimedFaucet", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: boolean | undefined; refetch: () => void };
  const { data: balHandle, refetch: refetchBal } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "confidentialBalanceOf", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: `0x${string}` | undefined; refetch: () => void };
  const { data: traderStats } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: [bigint, bigint, bigint] | undefined };
  const { data: followerCount } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: bigint | undefined };
  const { data: history } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getTradeHistory", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: readonly { entryPrice: bigint; exitPrice: bigint; direction: boolean; size: bigint; leverage: bigint; pnlBps: bigint; timestamp: bigint }[] | undefined };
  const { data: myUsername, refetch: refetchUsername } = useReadContract({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "usernames", args: [address as `0x${string}`], query: { enabled: !!address } }) as { data: string | undefined; refetch: () => void };

  const [total, wins, pnlBps] = traderStats ?? [0n, 0n, 0n];
  const winRate = total > 0n ? Math.round(Number(wins) / Number(total) * 100) : 0;
  const isStaked = !!stakedFlag;
  const entryPrice = positionData ? Number(positionData[1]) / 1e6 : 0;
  // The trader's own view of their (encrypted) position, from localStorage — kept
  // consistent with the Chart tab. A copied/mirrored position is sealed even to its
  // owner, so we must not show a long-assumed P&L for it.
  const posMeta = (() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem(`ct_posparams_${address}`) || "null") as { dir?: Dir; size?: number; lev?: number; copied?: boolean; leader?: string } | null; } catch { return null; }
  })();
  const openParams = posMeta && posMeta.dir ? (posMeta as { dir: Dir; size: number; lev: number }) : null;
  const copiedFrom = posMeta && posMeta.copied ? posMeta.leader ?? null : null;
  const canSeeOwn = !!openParams;
  const posIsLong = openParams ? openParams.dir === "LONG" : true;
  const posLev = openParams?.lev ?? 1;
  const rawMovePct = isOpen && entryPrice > 0 ? ((livePrice - entryPrice) / entryPrice * 100) : 0;
  const unrealizedPct = (posIsLong ? rawMovePct : -rawMovePct) * posLev;
  const pnlPos = unrealizedPct >= 0;
  const fCount = Number(followerCount ?? 0n);

  const { writeContractAsync } = useWriteContract();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [loading, setLoading] = useState(false);
  const [wrapAmt, setWrapAmt] = useState("100");
  const [cBalance, setCBalance] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  useEffect(() => { if (myUsername) setNameInput(myUsername); }, [myUsername]);

  async function tx(fn: () => Promise<`0x${string}`>, after?: () => void) {
    setLoading(true);
    try {
      const hash = await fn();
      await publicClient?.waitForTransactionReceipt({ hash });
      after?.();
    } catch { /* ignore */ }
    setLoading(false);
  }

  const handleClose = () => tx(
    () => writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "closePosition", args: [BigInt(Math.round(livePrice * 1e6))] }),
    () => { refetchOpen(); refetchBal(); setCBalance(null); }
  );
  const handleFaucet = () => tx(
    () => writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "faucet" }),
    () => { refetchFaucet(); refetchBal(); setCBalance(null); }
  );
  const handleSetUsername = () => tx(
    () => writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "setUsername", args: [nameInput.trim()] }),
    () => { refetchUsername(); }
  );
  const handleWrap = () => tx(
    () => writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "wrap", args: [BigInt(Math.round(Number(wrapAmt || "0") * 1e6))] }),
    () => { refetchBal(); setCBalance(null); }
  );
  const handleStake = () => tx(
    () => writeContractAsync({ address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: isStaked ? "unstake" : "stake" }),
    () => { refetchStake(); refetchBal(); setCBalance(null); }
  );

  // client-side decrypt of the user's own confidential cUSDT balance
  async function revealBalance() {
    if (!balHandle || !walletClient || balHandle === "0x0000000000000000000000000000000000000000000000000000000000000000") { setCBalance(0); return; }
    setRevealing(true);
    try {
      const fhevm = await getFhevm();
      const keypair = fhevm.generateKeypair();
      const start = Math.floor(Date.now() / 1000);
      const days = 7;
      const eip712 = fhevm.createEIP712(keypair.publicKey, [CIPHER_TRADE_ADDRESS], start, days);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sig = await walletClient.signTypedData({
        account: address as `0x${string}`,
        domain: eip712.domain,
        types: { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        primaryType: "UserDecryptRequestVerification",
        message: eip712.message,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
      const res = await fhevm.userDecrypt(
        [{ handle: balHandle, contractAddress: CIPHER_TRADE_ADDRESS }],
        keypair.privateKey, keypair.publicKey, sig.replace("0x", ""),
        [CIPHER_TRADE_ADDRESS], address, start, days,
      );
      setCBalance(Number(res[balHandle]) / 1e6);
    } catch { setCBalance(null); }
    setRevealing(false);
  }

  return (
    <div style={{ padding: "18px 22px", maxWidth: 1240, margin: "0 auto", width: "100%", overflowY: "auto" }}>
      {/* Profile / username */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 14, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ width: 46, height: 46, borderRadius: 12, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 20 }}>
          {(myUsername?.[0] ?? address.slice(2, 3)).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 11, color: MUTED2, marginBottom: 4 }}>Public username — others can open your profile by this</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input value={nameInput} onChange={e => setNameInput(e.target.value.replace(/[^A-Za-z0-9_]/g, "").slice(0, 20))} placeholder="set a username (3–20 chars)" style={{ flex: 1, maxWidth: 320, padding: "9px 12px", background: INNER, border: `1px solid ${BORDER}`, borderRadius: 9, color: "#eef2f6", fontSize: 14, fontFamily: MONO }} />
            <button onClick={handleSetUsername} disabled={loading || nameInput.trim().length < 3 || nameInput.trim() === myUsername} style={{ padding: "9px 18px", border: "1px solid #6b5320", background: "transparent", color: "#fbbf24", fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: loading ? "not-allowed" : "pointer", fontFamily: SANS, opacity: nameInput.trim().length < 3 || nameInput.trim() === myUsername ? 0.5 : 1 }}>
              {loading ? "…" : myUsername ? "Update" : "Claim"}
            </button>
          </div>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: MUTED2 }}>{address.slice(0, 6)}…{address.slice(-4)}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
        {[
          { label: "Copiers", value: fCount.toString(), color: "#eef2f6" },
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

      {/* Confidential cUSDT wallet */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 16, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ minWidth: 200 }}>
          <div style={{ fontSize: 11, color: MUTED2, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>🔒 Confidential cUSDT balance</div>
          <div style={{ fontSize: 28, fontWeight: 700, fontFamily: MONO, color: AMBER }}>
            {cBalance === null ? "•••••• cUSDT" : cBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " cUSDT"}
          </div>
          <button onClick={revealBalance} disabled={revealing} style={{ marginTop: 6, padding: "4px 10px", fontSize: 11, fontFamily: MONO, border: `1px solid ${BORDER}`, background: INNER, color: "#aeb8c4", borderRadius: 7, cursor: "pointer" }}>
            {revealing ? "Decrypting…" : cBalance === null ? "🔓 Reveal (decrypt)" : "↻ Refresh"}
          </button>
        </div>
        <div style={{ width: 1, height: 56, background: BORDER }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          {!claimedFaucet ? (
            <button onClick={handleFaucet} disabled={loading} style={{ width: "100%", padding: 11, border: "1px solid #6b5320", background: "linear-gradient(135deg,#f59e0b,#fbbf24)", color: "#0c0a06", fontSize: 13, fontWeight: 700, borderRadius: 10, cursor: loading ? "not-allowed" : "pointer", fontFamily: SANS }}>
              {loading ? "…" : "🎁 Claim 300 cUSDT sign-up grant"}
            </button>
          ) : (
            <div>
              <div style={{ fontSize: 11, color: MUTED2, marginBottom: 6 }}>Convert Sepolia USDT → cUSDT</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={wrapAmt} onChange={e => setWrapAmt(e.target.value.replace(/[^0-9.]/g, ""))} style={{ flex: 1, padding: "9px 12px", background: INNER, border: `1px solid ${BORDER}`, borderRadius: 9, color: "#eef2f6", fontSize: 14, fontFamily: MONO }} />
                <button onClick={handleWrap} disabled={loading} style={{ padding: "9px 18px", border: "1px solid #6b5320", background: "transparent", color: "#fbbf24", fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: loading ? "not-allowed" : "pointer", fontFamily: SANS, whiteSpace: "nowrap" }}>
                  {loading ? "…" : "Wrap →"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, marginBottom: 22 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 15 }}>Your active position</div>
          {isOpen ? (
            <>
              {copiedFrom && (
                <div style={{ fontSize: 11, color: "#fbbf24", background: "#241b0c", border: "1px solid #5e4a24", borderRadius: 8, padding: "8px 11px", marginBottom: 12, fontFamily: MONO, lineHeight: 1.4 }}>
                  🔒 Mirrored from {fmt(copiedFrom)} — direction, size &amp; P&L are encrypted even to you, revealed only at settlement.
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 14 }}>
                <div style={{ background: INNER, borderRadius: 9, padding: 12 }}>
                  <div style={{ fontSize: 9, color: MUTED2, marginBottom: 3 }}>Direction</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: canSeeOwn ? (posIsLong ? GREEN : RED_SOFT) : MUTED }}>{canSeeOwn ? (posIsLong ? "▲ Long" : "▼ Short") : "🔒 Sealed"}</div>
                  <div style={{ fontSize: 9, color: MUTED2, marginTop: 2, fontFamily: MONO }}>{canSeeOwn ? "🔒 sealed to others" : "encrypted"}</div>
                </div>
                <div style={{ background: INNER, borderRadius: 9, padding: 12 }}>
                  <div style={{ fontSize: 9, color: MUTED2, marginBottom: 3 }}>Size {canSeeOwn && openParams ? `· ${openParams.lev}×` : ""}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: MONO }}>{canSeeOwn && openParams ? openParams.size.toLocaleString() : "🔒"}</div>
                  <div style={{ fontSize: 9, color: MUTED2, marginTop: 2, fontFamily: MONO }}>{canSeeOwn ? "🔒 sealed to others" : "encrypted"}</div>
                </div>
                <div style={{ background: INNER, borderRadius: 9, padding: 12 }}>
                  <div style={{ fontSize: 9, color: MUTED2, marginBottom: 3 }}>Entry</div>
                  <div style={{ fontSize: 16, fontWeight: 600, fontFamily: MONO }}>${entryPrice.toFixed(2)}</div>
                </div>
                {canSeeOwn ? (
                  <div style={{ background: pnlPos ? "rgba(34,197,94,.07)" : "rgba(239,68,68,.07)", borderRadius: 9, padding: 12 }}>
                    <div style={{ fontSize: 9, color: pnlPos ? "rgba(74,222,128,.7)" : "rgba(252,165,165,.7)", marginBottom: 3 }}>Unr. P&L</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: pnlPos ? GREEN : RED_SOFT, fontFamily: MONO }}>{pnlPos ? "+" : ""}{unrealizedPct.toFixed(2)}%</div>
                    <div style={{ fontSize: 9, color: pnlPos ? "rgba(74,222,128,.7)" : "rgba(252,165,165,.7)", fontFamily: MONO }}>{pnlPos ? "+" : ""}{Math.round(unrealizedPct * 100)} bps</div>
                  </div>
                ) : (
                  <div style={{ background: "rgba(245,158,11,.06)", border: "1px solid #5e4a24", borderRadius: 9, padding: 12 }}>
                    <div style={{ fontSize: 9, color: "rgba(251,191,36,.7)", marginBottom: 3 }}>Unr. P&L</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#fbbf24", fontFamily: MONO }}>🔒 Sealed</div>
                    <div style={{ fontSize: 9, color: MUTED2, fontFamily: MONO }}>on close</div>
                  </div>
                )}
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
          <button onClick={handleStake} disabled={loading || isOpen} style={{ padding: 10, border: "1px solid #6b5320", background: "transparent", color: "#fbbf24", fontSize: 13, fontWeight: 600, borderRadius: 10, cursor: loading || isOpen ? "not-allowed" : "pointer", opacity: loading || isOpen ? 0.5 : 1, fontFamily: SANS }}>
            {loading ? "…" : isStaked ? "Unstake 100 cUSDT" : "Stake 100 cUSDT"}
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
                <div style={{ fontSize: 12, fontFamily: MONO }}>{tr.size.toString()} <span style={{ color: AMBER }}>{tr.leverage.toString()}×</span></div>
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
  const liveTraders = traderAddrs ?? [];
  const usingMock = liveTraders.length === 0;

  // One batch for ALL per-trader data — avoids N×4 individual hook calls in child rows.
  // 5 slots per trader: [stats, history, isPositionOpen, followerCount, username]
  const { data: batch } = useReadContracts({
    contracts: liveTraders.flatMap(a => ([
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "traderStats", args: [a] } as const,
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getTradeHistory", args: [a] } as const,
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "isPositionOpen", args: [a] } as const,
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "getFollowerCount", args: [a] } as const,
      { address: CIPHER_TRADE_ADDRESS, abi: CIPHER_TRADE_ABI, functionName: "usernames", args: [a] } as const,
    ])),
    query: { enabled: !usingMock, staleTime: 30_000 },
  });

  const now = Date.now() / 1000;
  const cutoff = period === "7d" ? now - 7 * 86400 : period === "30d" ? now - 30 * 86400 : 0;

  // ranked list (best net P&L first). For a period, sum only that window's trades.
  const ranked: { addr: `0x${string}`; netPnlBps: number; stats?: [bigint,bigint,bigint]; posOpen?: boolean; fCount?: bigint; username?: string; mock?: MockTrader }[] = usingMock
    ? [...MOCK_TRADERS].sort((a, b) => Number(b.pnlBps) - Number(a.pnlBps)).map(m => ({ addr: m.addr as `0x${string}`, netPnlBps: Number(m.pnlBps), mock: m }))
    : liveTraders.map((a, i) => {
        const stats = batch?.[i * 5]?.result as [bigint, bigint, bigint] | undefined;
        const hist = batch?.[i * 5 + 1]?.result as readonly { pnlBps: bigint; timestamp: bigint }[] | undefined;
        const posOpen = batch?.[i * 5 + 2]?.result as boolean | undefined;
        const fCount = batch?.[i * 5 + 3]?.result as bigint | undefined;
        const username = batch?.[i * 5 + 4]?.result as string | undefined;
        const net = period === "all" || !hist
          ? Number(stats?.[2] ?? 0n)
          : hist.filter(h => Number(h.timestamp) >= cutoff).reduce((s, h) => s + Number(h.pnlBps), 0);
        return { addr: a, netPnlBps: net, stats, posOpen, fCount, username };
      }).sort((a, b) => b.netPnlBps - a.netPnlBps);

  const traders = ranked.map(r => r.addr);
  const mockFor = (i: number) => ranked[i]?.mock;

  return (
    <div style={{ padding: "18px 22px", maxWidth: 1240, margin: "0 auto", width: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 5 }}>Leaderboard</div>
          <div style={{ fontSize: 13, color: MUTED }}>Ranked by verified on-chain track record. All positions were sealed during trading.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {usingMock && <div style={{ fontSize: 10, color: MUTED2, background: INNER, border: `1px solid ${BORDER}`, padding: "6px 10px", borderRadius: 7, fontFamily: MONO }}>demo data</div>}
          <div style={{ display: "flex", background: "#131a22", border: `1px solid ${BORDER}`, borderRadius: 9, padding: 3, gap: 2 }}>
            {(["all", "30d", "7d"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: SANS, background: period === p ? "#1e2a36" : "transparent", color: period === p ? "#eef2f6" : MUTED }}>
                {p === "all" ? "All time" : p === "30d" ? "30D" : "7D"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {false ? (
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
              {[ranked[1], ranked[0], ranked[2]].map((r, i) => {
                const rank = [2, 1, 3][i];
                const colors: Record<number, { bg: string; border: string; rankColor: string; glow: string }> = {
                  1: { bg: "rgba(245,158,11,.06)", border: "#6b5320", rankColor: "#fbbf24", glow: "rgba(245,158,11,.15)" },
                  2: { bg: "rgba(156,163,175,.04)", border: "#374151", rankColor: "#9ca3af", glow: "rgba(156,163,175,.1)" },
                  3: { bg: "rgba(180,83,9,.04)", border: "#4b2e0a", rankColor: "#b45309", glow: "rgba(180,83,9,.1)" },
                };
                const c = colors[rank];
                if (!r) return null;
                return <PodiumCard key={r.addr} addr={r.addr} rank={rank} colors={c}
                  mockData={r.mock}
                  prefetchedStats={r.stats}
                  prefetchedUsername={r.username}
                />;
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
            {ranked.map((r, i) => <LeaderRow key={r.addr} addr={r.addr} rank={i + 1} mockData={r.mock}
              prefetchedStats={r.stats}
              prefetchedPosOpen={r.posOpen}
              prefetchedFCount={r.fCount}
              prefetchedUsername={r.username}
            />)}
          </div>
        </>
      )}
    </div>
  );
}

function PodiumCard({ addr, rank, colors, mockData, prefetchedStats, prefetchedUsername }: { addr: string; rank: number; colors: { bg: string; border: string; rankColor: string; glow: string }; mockData?: MockTrader; prefetchedStats?: [bigint,bigint,bigint]; prefetchedUsername?: string }) {
  const [total, , pnlBps] = mockData ? [mockData.total, 0n, mockData.pnlBps] : (prefetchedStats ?? [0n, 0n, 0n]);
  const pct = (Number(pnlBps) / 100).toFixed(1);
  const isPos = Number(pnlBps) >= 0;
  const displayName = mockData?.name ?? resolvedName(prefetchedUsername, addr);
  const openProfile = useOpenProfile();

  return (
    <div onClick={() => openProfile(addr)} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 20, textAlign: "center", position: "relative", overflow: "hidden", cursor: "pointer" }}>
      <div style={{ position: "absolute", top: -40, left: "50%", transform: "translateX(-50%)", width: 160, height: 100, background: colors.glow, filter: "blur(18px)" }} />
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO, color: colors.rankColor, marginBottom: 8, position: "relative" }}>#{rank}</div>
      <div style={{ width: 50, height: 50, borderRadius: 13, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 20, margin: "0 auto 10px", position: "relative" }}>{displayName[0]}</div>
      <div style={{ fontSize: 14, fontWeight: 600, position: "relative" }}>{displayName}</div>
      <div style={{ fontSize: 10, color: MUTED, fontFamily: MONO, marginTop: 2, marginBottom: 12, position: "relative" }}>{total.toString()} settled</div>
      <div style={{ fontSize: 32, fontWeight: 700, fontFamily: MONO, color: isPos ? GREEN : RED_SOFT, lineHeight: 1, position: "relative" }}>{isPos ? "+" : ""}{pct}%</div>
      <div style={{ fontSize: 10, color: MUTED, marginTop: 3, marginBottom: 14, position: "relative" }}>net return</div>
    </div>
  );
}

function LeaderRow({ addr, rank, mockData, prefetchedStats, prefetchedPosOpen, prefetchedFCount, prefetchedUsername }: { addr: string; rank: number; mockData?: MockTrader; prefetchedStats?: [bigint,bigint,bigint]; prefetchedPosOpen?: boolean; prefetchedFCount?: bigint; prefetchedUsername?: string }) {
  const [total, wins, pnlBps] = mockData ? [mockData.total, mockData.wins, mockData.pnlBps] : (prefetchedStats ?? [0n, 0n, 0n]);
  const posOpen = mockData ? mockData.posOpen : prefetchedPosOpen;
  const fCount = mockData ? mockData.followers : prefetchedFCount;
  const displayName = mockData?.name ?? resolvedName(prefetchedUsername, addr);
  const openProfile = useOpenProfile();
  const winRate = total > 0n ? Math.round(Number(wins) / Number(total) * 100) : 0;
  const pnl = Number(pnlBps) / 100;
  const isPos = pnl >= 0;
  const avgPct = total > 0n ? (pnl / Number(total)).toFixed(1) : "0.0";
  const accentColors: Record<number, string> = { 1: "#6b5320", 2: "#374151", 3: "#4b2e0a" };
  const accent = accentColors[rank] ?? "transparent";

  return (
    <div onClick={() => openProfile(addr)} style={{ display: "grid", gridTemplateColumns: "52px 1.8fr 1fr 1fr 1fr 1fr 1fr 120px", padding: "13px 16px", borderTop: `1px solid ${BORDER2}`, alignItems: "center", borderLeft: `3px solid ${accent}`, cursor: "pointer" }}>
      <div style={{ fontSize: 14, fontWeight: 700, fontFamily: MONO, color: rank === 1 ? "#fbbf24" : rank === 2 ? "#9ca3af" : rank === 3 ? "#b45309" : MUTED }}>#{rank}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0c0a06", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{displayName[0]}</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{displayName}</div>
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
