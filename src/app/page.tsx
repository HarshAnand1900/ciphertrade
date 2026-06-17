"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const SANS = "var(--font-space-grotesk), system-ui, sans-serif";
const MONO = "var(--font-jetbrains-mono), monospace";
const AMBER = "#f59e0b";
const GREEN = "#4ade80";
const RED = "#fca5a5";
const MUTED = "#7d8896";

const KEYFRAMES = `
@keyframes ctPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
@keyframes ctFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-9px);}}
@keyframes ctDrift{0%{background-position:0 0;}100%{background-position:54px 54px;}}
@keyframes ctGlow{0%,100%{opacity:.5;}50%{opacity:.9;}}
@keyframes ctShimmer{0%,100%{background-position:0% 50%;}50%{background-position:100% 50%;}}
@keyframes ctTitleFade{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:none;}}
@keyframes ctMarquee{0%{transform:translateX(0);}100%{transform:translateX(-50%);}}
html{scroll-behavior:smooth;}
::selection{background:#f59e0b;color:#fff;}
`;

export default function Landing() {
  const [price, setPrice] = useState(1043.5);
  const [heroPhase, setHeroPhase] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [stats] = useState([0, 0, 0, 0]);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const priceTimer = setInterval(() => {
      setPrice((p) => {
        let n = p + (Math.random() * 6 - 3);
        if (n < 982) n = 982;
        if (n > 1086) n = 1086;
        return Math.round(n * 100) / 100;
      });
    }, 1700);

    const heroTimer = setInterval(() => setHeroPhase((h) => (h + 1) % 6), 1900);

    const countTimer = 0; // stat count-up removed — using static tech facts

    let io: IntersectionObserver | undefined;
    const revealTimer = setTimeout(() => {
      if (!("IntersectionObserver" in window)) return;
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              (en.target as HTMLElement).style.opacity = "1";
              (en.target as HTMLElement).style.transform = "none";
              io!.unobserve(en.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
      );
      const root = rootRef.current || document;
      root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((node, i) => {
        node.style.opacity = "0";
        node.style.transform = "translateY(26px)";
        node.style.transition =
          "opacity .7s cubic-bezier(.2,.7,.3,1), transform .7s cubic-bezier(.2,.7,.3,1)";
        node.style.transitionDelay = (i % 4) * 0.06 + "s";
        io!.observe(node);
      });
    }, 60);

    // ── 3D point cloud + cipher glyph rain ──
    let rafId = 0;
    const canvas = canvasRef.current;
    let cleanupCanvas = () => {};
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let W = 0, H = 0;
        const resize = () => {
          const r = canvas.getBoundingClientRect();
          W = r.width; H = r.height;
          canvas.width = W * dpr; canvas.height = H * dpr;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener("resize", resize);

        // Fibonacci sphere — two nested shells
        type Pt3 = { x: number; y: number; z: number; pulse: number };
        const pts: Pt3[] = Array.from({ length: 78 }, (_, i) => {
          const t = i / 78, phi = Math.acos(1 - 2 * t), theta = Math.PI * (1 + Math.sqrt(5)) * i;
          const r = i % 2 === 0 ? 1 : 0.62;
          return { x: Math.sin(phi) * Math.cos(theta) * r, y: Math.sin(phi) * Math.sin(theta) * r, z: Math.cos(phi) * r, pulse: Math.random() * Math.PI * 2 };
        });

        // Cipher glyph rain
        const HEX = "0123456789ABCDEF";
        type Glyph = { x: number; y: number; speed: number; size: number; alpha: number; chars: string[]; charTimer: number; charInterval: number };
        const GLYPHS: Glyph[] = Array.from({ length: 28 }, (_, i) => ({
          x: (i / 28) * 1.1 - 0.05, y: Math.random(),
          speed: 0.00015 + Math.random() * 0.00025,
          size: 9 + Math.floor(Math.random() * 9),
          alpha: 0.08 + Math.random() * 0.16,
          chars: Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => "0x" + Array.from({ length: 4 }, () => HEX[Math.floor(Math.random() * 16)]).join("")),
          charTimer: 0, charInterval: 18 + Math.floor(Math.random() * 40),
        }));

        const onMouseMove = (e: MouseEvent) => {
          const r = canvas.getBoundingClientRect();
          mouseRef.current.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
          mouseRef.current.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
        };
        window.addEventListener("mousemove", onMouseMove);

        let frame = 0;
        const loop = () => {
          frame++;
          const time = frame * 0.0042;
          ctx.clearRect(0, 0, W, H);
          const mx = mouseRef.current.x, my = mouseRef.current.y;
          const cx = W * 0.62, cy = H * 0.42;
          const scale = Math.min(W, H) * 0.46;
          const FOG = 520;

          // glyph rain
          for (const g of GLYPHS) {
            g.y -= g.speed;
            if (g.y < -0.05) { g.y = 1.08; g.x = Math.random(); }
            g.charTimer++;
            if (g.charTimer >= g.charInterval) {
              g.charTimer = 0;
              const ri = Math.floor(Math.random() * g.chars.length);
              g.chars[ri] = "0x" + Array.from({ length: 4 }, () => HEX[Math.floor(Math.random() * 16)]).join("");
            }
            ctx.font = g.size + 'px "JetBrains Mono",monospace';
            const px = g.x * W, py = g.y * H;
            for (let ci = 0; ci < g.chars.length; ci++) {
              const lineY = py + ci * g.size * 1.5;
              const fade = 1 - Math.abs(lineY / H - 0.5) * 1.8;
              if (fade <= 0) continue;
              ctx.fillStyle = `rgba(251,191,36,${(g.alpha * fade).toFixed(3)})`;
              ctx.fillText(g.chars[ci], px, lineY);
            }
          }

          // 3D projection
          const ay = time + mx * 0.5, ax = 0.32 + my * 0.28;
          const cosY = Math.cos(ay), sinY = Math.sin(ay), cosX = Math.cos(ax), sinX = Math.sin(ax);
          type Proj = { sx: number; sy: number; depth: number; persp: number; pulse: number };
          const proj: Proj[] = pts.map(p => {
            const x1 = p.x * cosY - p.z * sinY, z1 = p.x * sinY + p.z * cosY;
            const y1 = p.y * cosX - z1 * sinX, z2 = p.y * sinX + z1 * cosX;
            const persp = FOG / (FOG + z2 * scale + scale * 0.4);
            return { sx: cx + x1 * scale * persp, sy: cy + y1 * scale * persp, depth: z2, persp, pulse: p.pulse };
          });

          const LINK = scale * 0.62;
          for (let i = 0; i < proj.length; i++) {
            for (let j = i + 1; j < proj.length; j++) {
              const dx = proj[i].sx - proj[j].sx, dy = proj[i].sy - proj[j].sy;
              const d = Math.hypot(dx, dy);
              if (d < LINK) {
                const a = (1 - d / LINK) * 0.55 * Math.min(proj[i].persp, proj[j].persp);
                ctx.strokeStyle = `rgba(245,158,11,${a.toFixed(3)})`;
                ctx.lineWidth = 0.7;
                ctx.beginPath(); ctx.moveTo(proj[i].sx, proj[i].sy); ctx.lineTo(proj[j].sx, proj[j].sy); ctx.stroke();
              }
            }
          }

          proj.sort((a, b) => a.depth - b.depth);
          for (const p of proj) {
            const depthT = (p.depth + 1) / 2;
            const tw = 0.6 + 0.4 * Math.sin(time * 9 + p.pulse);
            const rad = (1.1 + depthT * 2.6) * p.persp;
            const alpha = (0.18 + depthT * 0.6) * tw;
            const grad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, rad * 4);
            grad.addColorStop(0, `rgba(251,191,36,${(alpha * 0.5).toFixed(3)})`);
            grad.addColorStop(1, "rgba(251,191,36,0)");
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(p.sx, p.sy, rad * 4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `rgba(253,224,134,${Math.min(1, alpha + 0.15).toFixed(3)})`;
            ctx.beginPath(); ctx.arc(p.sx, p.sy, rad, 0, Math.PI * 2); ctx.fill();
          }

          rafId = requestAnimationFrame(loop);
        };
        loop();

        cleanupCanvas = () => {
          window.removeEventListener("resize", resize);
          window.removeEventListener("mousemove", onMouseMove);
        };
      }
    }

    return () => {
      clearInterval(priceTimer);
      clearInterval(heroTimer);
      clearInterval(countTimer);
      clearTimeout(revealTimer);
      if (io) io.disconnect();
      cancelAnimationFrame(rafId);
      cleanupCanvas();
    };
  }, []);

  // ── derived values ──
  const tickPct = (price / 1000 - 1) * 100;
  const tickPos = tickPct >= 0;
  const tickStr = (tickPos ? "+" : "−") + Math.abs(tickPct).toFixed(2) + "%";

  const ph = heroPhase;
  const sealed = ph === 2 || ph === 3;
  const encrypting = ph === 1;
  const settling = ph === 4;
  const revealed = ph === 5;
  const choosing = ph === 0;
  const sealStr = "🔒 ••••";
  const blurOn = sealed || encrypting;

  const heroSizeVal = sealed || encrypting ? sealStr : settling ? "🔓 ••••" : "2,500";
  const heroDirVal = sealed || encrypting ? sealStr : settling ? "🔓 ••••" : "▲ LONG";

  let heroPnlVal, heroPnlColor, heroPnlBg, heroPnlBorder, heroPnlBlur, heroPnlSub;
  if (revealed) {
    heroPnlVal = "+18.40%";
    heroPnlColor = GREEN;
    heroPnlBg = "linear-gradient(135deg,#13301f,#0f241a)";
    heroPnlBorder = "#1f4630";
    heroPnlBlur = "none";
    heroPnlSub = "+1840 bps settled";
  } else if (settling) {
    heroPnlVal = "🔓 ••••";
    heroPnlColor = "#9aa6b4";
    heroPnlBg = "#0f141a";
    heroPnlBorder = "#232c37";
    heroPnlBlur = "blur(4px)";
    heroPnlSub = "decrypting via KMS";
  } else {
    heroPnlVal = sealStr;
    heroPnlColor = "#9aa6b4";
    heroPnlBg = "#0f141a";
    heroPnlBorder = "#232c37";
    heroPnlBlur = blurOn ? "blur(4px)" : "none";
    heroPnlSub = encrypting ? "encrypting…" : choosing ? "awaiting open" : "sealed on-chain";
  }

  const stageMap: Record<number, { title: string; tag: string; dot: string }> = {
    0: { title: "Open a position", tag: "DRAFT", dot: "#fbbf24" },
    1: { title: "Encrypting…", tag: "FHE", dot: "#facc15" },
    2: { title: "Position sealed", tag: "OPEN", dot: GREEN },
    3: { title: "Followers copying", tag: "OPEN", dot: GREEN },
    4: { title: "Settling…", tag: "DECRYPT", dot: "#facc15" },
    5: { title: "Revealed", tag: "SETTLED", dot: GREEN },
  };
  const stage = stageMap[ph];

  const tags = ["7B", "3F", "9C", "D4", "A1", "—"];
  const filledCount = ph >= 3 ? 5 : ph === 2 ? 2 : 0;
  const followerSlots = tags.map((tg, i) => {
    const on = i < filledCount;
    return {
      label: on ? tg : "+",
      bg: on ? "#241b0c" : "#0c1015",
      border: on ? "#5e4a24" : "#1a212a",
      color: on ? "#fbbf24" : "#3a444f",
    };
  });

  void stats; // stats state kept for future use

  const steps = [
    { num: "01", icon: "✍️", title: "Open or follow", body: "Pick a direction and size, or allocate cUSDT to a ranked trader you want to copy." },
    { num: "02", icon: "🔒", title: "Encrypt client-side", body: "Direction and size are encrypted in your browser. Only ciphertext is ever broadcast." },
    { num: "03", icon: "⚙️", title: "Match under FHE", body: "The contract copies, sizes and tracks positions while every value stays unreadable." },
    { num: "04", icon: "🔓", title: "Settle & reveal", body: "On close, the KMS decrypts the result. P&L pays out pro-rata, minus the performance fee." },
  ];

  const fhePoints = [
    { title: "Nothing leaks to the mempool", body: "Encrypted inputs mean front-runners see ciphertext, never your direction or size." },
    { title: "Computation on ciphertext", body: "Matching, sizing and P&L are computed without ever decrypting on-chain." },
    { title: "You hold the keys", body: "Only you can decrypt your own position; followers see results, never the trade." },
  ];

  const rawRows = [
    { label: "Direction", raw: "▲ LONG", col: GREEN },
    { label: "Size", raw: "2,500 u", col: "#eef2f6" },
    { label: "Entry", raw: "$1,000.00", col: "#eef2f6" },
    { label: "Exit", raw: "$1,184.00", col: "#eef2f6" },
    { label: "Realized P&L", raw: "+18.40%", col: GREEN },
  ];
  const revealRows = rawRows.map((r) => ({
    label: r.label,
    value: reveal ? r.raw : "🔒 ••••••",
    color: reveal ? r.col : MUTED,
    blur: reveal ? "none" : "blur(5px)",
  }));

  const barColor = (positive: boolean, t: number) => {
    const g = ["#1d3a2a", "#1d3a2a", "#235038", "#235038", "#2e6b49", "#34a063", "#3cc878", "#4ade80", "#4ade80"];
    const r = ["#3a2226", "#3a2226", "#4a2a2e", "#4a2a2e", "#5a3236", "#6a3a3e", "#7a4248", "#cf6b73", "#cf6b73"];
    return positive ? g[t] : r[t];
  };
  const LB = [
    { initial: "D", name: "DeltaNeutral", settled: 210, ret: 24.1, followers: 19, featured: true, raw: [45, 58, 52, 70, 64, 78, 86, 92, 98] },
    { initial: "S", name: "Satoshi_Long", settled: 142, ret: 18.4, followers: 12, featured: false, raw: [40, 55, 46, 68, 60, 82, 74, 88, 96] },
    { initial: "V", name: "VolHunter", settled: 88, ret: 9.2, followers: 7, featured: false, raw: [50, 42, 60, 48, 66, 58, 72, 76, 80] },
  ];
  const leaderboard = LB.map((t) => {
    const pos = t.ret >= 0;
    return {
      ...t,
      ret: (pos ? "+" : "−") + Math.abs(t.ret).toFixed(1) + "%",
      retColor: pos ? GREEN : RED,
      avatarBg: t.featured ? "linear-gradient(135deg,#f59e0b,#fbbf24)" : "#1e2630",
      cardBorder: t.featured ? "#6b5320" : "#232c37",
      bars: t.raw.map((h, i) => ({ h: h + "%", c: barColor(pos, i) })),
    };
  });

  const feeTiers = [
    { pct: "8%", label: "Unstaked", note: "Lower fee, no loss-sharing", bg: "#0f141a", border: "#232c37", color: "#aeb8c4" },
    { pct: "18%", label: "Staked", note: "Loss-sharing + trust score", bg: "#241b0c", border: "#6b5320", color: "#fbbf24" },
  ];

  const dirBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "11px 0",
    textAlign: "center",
    borderRadius: 11,
    fontSize: 13,
    fontWeight: 700,
    border: active ? "none" : "1px solid #232c37",
    background: active ? "#22c55e" : "transparent",
    color: active ? "#fff" : MUTED,
    transition: "all .4s",
  });

  const eyebrow: React.CSSProperties = {
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 2,
    color: "#fbbf24",
    textTransform: "uppercase",
    marginBottom: 16,
  };

  return (
    <div ref={rootRef} style={{ background: "#08090c", color: "#eef2f6", overflowX: "hidden", fontFamily: SANS }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(14px)", background: "rgba(8,9,12,.72)", borderBottom: "1px solid #14181f" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="#top" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, boxShadow: "0 0 18px rgba(245,158,11,.5)" }}>C</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>CipherTrade</div>
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: 30 }} className="ct-navlinks">
            <a href="#how" style={{ fontSize: 14, color: "#aeb8c4", textDecoration: "none" }}>How it works</a>
            <a href="#encrypt" style={{ fontSize: 14, color: "#aeb8c4", textDecoration: "none" }}>What stays sealed</a>
            <a href="#traders" style={{ fontSize: 14, color: "#aeb8c4", textDecoration: "none" }}>Traders</a>
            <Link href="/docs" style={{ fontSize: 14, color: "#aeb8c4", textDecoration: "none" }}>Docs</Link>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 12, color: "#9aa6b4" }} className="ct-navprice">
              <span style={{ fontSize: 10, color: MUTED }}>ETH/cUSDT</span>
              <span style={{ color: "#eef2f6", fontWeight: 600 }}>${price.toFixed(2)}</span>
              <span style={{ color: tickPos ? GREEN : RED }}>{tickStr}</span>
            </div>
            <Link href="/app" style={{ padding: "10px 20px", background: AMBER, color: "#fff", fontSize: 14, fontWeight: 600, borderRadius: 10, boxShadow: "0 0 20px rgba(245,158,11,.35)", textDecoration: "none" }}>Launch app</Link>
          </div>
        </div>
      </div>

      {/* HERO */}
      <div id="top" style={{ position: "relative" }}>
        {/* particle network canvas */}
        <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0, opacity: 0.6 }} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#0e141c 1px,transparent 1px),linear-gradient(90deg,#0e141c 1px,transparent 1px)", backgroundSize: "54px 54px", animation: "ctDrift 22s linear infinite", opacity: 0.35, maskImage: "radial-gradient(ellipse 90% 70% at 50% 0%,#000 30%,transparent 75%)", WebkitMaskImage: "radial-gradient(ellipse 90% 70% at 50% 0%,#000 30%,transparent 75%)" }} />
        <div style={{ position: "absolute", top: -180, left: "50%", transform: "translateX(-50%)", width: 900, height: 600, background: "radial-gradient(ellipse at center,rgba(245,158,11,.26),transparent 65%)", filter: "blur(20px)", animation: "ctGlow 7s ease-in-out infinite" }} />

        <div className="ct-hero" style={{ position: "relative", zIndex: 1, maxWidth: 1200, margin: "0 auto", padding: "84px 28px 90px", display: "grid", gridTemplateColumns: "1fr 480px", gap: 56, alignItems: "center" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 9, fontFamily: MONO, fontSize: 12, color: "#fbbf24", border: "1px solid #5e4a24", background: "rgba(36,27,12,0.85)", backdropFilter: "blur(8px)", padding: "7px 14px", borderRadius: 30, letterSpacing: 0.5, marginBottom: 30 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: AMBER, animation: "ctPulse 2s infinite" }} />FULLY HOMOMORPHIC ENCRYPTION · ETHEREUM
            </div>
            <h1 style={{ fontSize: 66, lineHeight: 1.02, fontWeight: 800, letterSpacing: -2.5, margin: "0 0 26px", animation: "ctTitleFade .8s cubic-bezier(.2,.7,.3,1) both", textShadow: "0 0 100px rgba(245,158,11,.08)" }} className="ct-h1">
              Confidential<br />copy&#8209;trading,<br />
              <span style={{ background: "linear-gradient(110deg,#f59e0b 0%,#fbbf24 30%,#fde68a 55%,#f59e0b 100%)", backgroundSize: "200% auto", animation: "ctShimmer 5s ease-in-out infinite", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", display: "inline-block" }}>powered by FHE.</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.65, color: "#bcc8d4", maxWidth: 470, margin: "0 0 36px", letterSpacing: "0.01em" }}>
              Copy proven traders without ever seeing their hand. Direction and size stay encrypted on-chain — you follow the track record, not the trade.
            </p>
            <div style={{ display: "flex", gap: 14, marginBottom: 34, flexWrap: "wrap" }}>
              <Link href="/app" style={{ padding: "15px 30px", background: AMBER, color: "#fff", fontSize: 15, fontWeight: 600, borderRadius: 12, boxShadow: "0 8px 30px -6px rgba(245,158,11,.6)", textDecoration: "none" }}>Start copying →</Link>
              <a href="#how" style={{ padding: "15px 28px", background: "#12181f", border: "1px solid #232c37", color: "#eef2f6", fontSize: 15, fontWeight: 600, borderRadius: 12, textDecoration: "none" }}>See how it works</a>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 22, fontSize: 13, color: MUTED, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: GREEN }}>●</span> Non-custodial</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: GREEN }}>●</span> Encrypted end-to-end</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: GREEN }}>●</span> Settles on Ethereum</div>
            </div>
          </div>

          {/* live mini app */}
          <div style={{ animation: "ctFloat 8s ease-in-out infinite" }}>
            <div style={{ background: "#12181f", border: "1px solid #232c37", borderRadius: 20, padding: 20, boxShadow: "0 40px 90px -30px rgba(0,0,0,.8), 0 0 0 1px rgba(245,158,11,.06)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12 }}>C</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{stage.title}</div>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: "#fbbf24", border: "1px solid #5e4a24", background: "#241b0c", padding: "4px 9px", borderRadius: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: stage.dot, animation: "ctPulse 1.6s infinite" }} />{stage.tag}
                </div>
              </div>

              <div style={{ display: "flex", gap: 9, marginBottom: 14 }}>
                <div style={dirBtn(true)}>▲ Long</div>
                <div style={dirBtn(false)}>▼ Short</div>
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1, background: "#0f141a", borderRadius: 12, padding: 13 }}>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 5 }}>Size</div>
                  <div style={{ fontSize: 18, fontWeight: 600, fontFamily: MONO, filter: blurOn ? "blur(5px)" : "none", transition: "filter .5s", color: sealed || encrypting || settling ? "#9aa6b4" : "#eef2f6" }}>{heroSizeVal}</div>
                </div>
                <div style={{ flex: 1, background: "#0f141a", borderRadius: 12, padding: 13 }}>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 5 }}>Direction</div>
                  <div style={{ fontSize: 18, fontWeight: 600, fontFamily: MONO, filter: blurOn ? "blur(5px)" : "none", transition: "filter .5s", color: sealed || encrypting || settling ? "#9aa6b4" : GREEN }}>{heroDirVal}</div>
                </div>
              </div>

              <div style={{ background: heroPnlBg, border: "1px solid " + heroPnlBorder, borderRadius: 13, padding: "15px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", transition: "background .5s,border .5s", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, color: MUTED }}>Unrealized P&L</div>
                  <div style={{ fontSize: 26, fontWeight: 700, fontFamily: MONO, color: heroPnlColor, filter: heroPnlBlur, transition: "filter .5s", lineHeight: 1.1, marginTop: 2 }}>{heroPnlVal}</div>
                </div>
                <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO, textAlign: "right" }}>{heroPnlSub}</div>
              </div>

              <div style={{ background: "#0f141a", borderRadius: 13, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11 }}>
                  <div style={{ fontSize: 11, color: "#aeb8c4", fontWeight: 600 }}>Copying this position</div>
                  <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO }}>{filledCount} / 20</div>
                </div>
                <div style={{ display: "flex", gap: 7 }}>
                  {followerSlots.map((slot, i) => (
                    <div key={i} style={{ flex: 1, height: 30, borderRadius: 8, background: slot.bg, border: "1px solid " + slot.border, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 10, color: slot.color, transition: "all .4s" }}>{slot.label}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ENCRYPTED MEMPOOL TICKER */}
      {(() => {
        const txs = [
          { hash: "0x4f7a…c19e", cA: "0xd4f8b2a19c3e7f01", cB: "0x8b3a91c04e2d7f55" },
          { hash: "0x9c2b…f44d", cA: "0x2e7c5d9a0f4b3812", cB: "0x1f9e4c7a8b2d6051" },
          { hash: "0x1e8d…770a", cA: "0xa3c6e9021f7b4d58", cB: "0x6d0f2c9b4e8a1375" },
          { hash: "0x7b5f…3391", cA: "0x5f1e8d3a9c2b7064", cB: "0x3c9b6d1f0e7a4528" },
          { hash: "0xd390…ab12", cA: "0x0c4f7e1b9d3a8256", cB: "0x9a2e5c8b1f4d7063" },
          { hash: "0x3a61…9c4f", cA: "0xb7d4920e5f1c3a68", cB: "0xe1a47f8c2b9d5036" },
          { hash: "0x8e04…d7b2", cA: "0x6c8a1d4f0b9e3257", cB: "0x4b7c2e9a8f1d5030" },
          { hash: "0xf120…55c8", cA: "0x9e3c7b2d1f4a8056", cB: "0x7f1d4a9c0e8b3265" },
        ];
        const item = (tx: typeof txs[0]) => (
          <div key={tx.hash} style={{ display: "flex", alignItems: "center", gap: 9, padding: "0 28px", borderRight: "1px solid #1a1f26", whiteSpace: "nowrap" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: AMBER, opacity: 0.5 }} />
            <span style={{ fontFamily: MONO, fontSize: 11, color: "#5b6168" }}>mempool</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "#7d8896" }}>{tx.hash}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: AMBER }}>🔒 direction=</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "#5b6168" }}>{tx.cA}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: AMBER }}>size=</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: "#5b6168" }}>{tx.cB}</span>
          </div>
        );
        return (
          <div style={{ borderTop: "1px solid #1a1f26", borderBottom: "1px solid #1a1f26", background: "#0a0c10", padding: "13px 0", overflow: "hidden", position: "relative" }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: 80, height: "100%", background: "linear-gradient(90deg,#0a0c10,transparent)", zIndex: 2 }} />
            <div style={{ position: "absolute", right: 0, top: 0, width: 80, height: "100%", background: "linear-gradient(270deg,#0a0c10,transparent)", zIndex: 2 }} />
            <div style={{ display: "flex", gap: 0, animation: "ctMarquee 34s linear infinite", width: "max-content" }}>
              {txs.map(item)}{txs.map(item)}
            </div>
          </div>
        );
      })()}

      {/* TECH FACTS BAR */}
      <div style={{ borderTop: "1px solid #14181f", borderBottom: "1px solid #14181f", background: "#0a0c10" }}>
        <div className="ct-stats" style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24 }}>
          {[
            { value: "ebool", label: "Encrypted direction type on-chain", color: AMBER },
            { value: "euint64", label: "Encrypted size type on-chain", color: AMBER },
            { value: "0 bytes", label: "Position data visible in mempool", color: GREEN },
            { value: "Sepolia", label: "Live on Ethereum testnet now", color: "#eef2f6" },
          ].map((st, i) => (
            <div key={i} data-reveal style={{ textAlign: "center" }}>
              <div style={{ fontSize: 30, fontWeight: 700, fontFamily: MONO, color: st.color, letterSpacing: -1 }}>{st.value}</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 5 }}>{st.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PROBLEM */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "110px 28px 30px", textAlign: "center" }}>
        <div data-reveal style={eyebrow}>The problem</div>
        <h2 data-reveal style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1, lineHeight: 1.15, margin: "0 auto 22px", maxWidth: 760 }}>Copy-trading leaks the edge it&apos;s built on.</h2>
        <p data-reveal style={{ fontSize: 18, lineHeight: 1.6, color: "#aeb8c4", maxWidth: 640, margin: "0 auto" }}>
          Every public copy-trade platform broadcasts a trader&apos;s positions the moment they open. Front-runners pile in, slippage eats the fill, and the alpha is gone before followers ever profit. Transparency becomes the attack surface.
        </p>
      </div>

      {/* HOW IT WORKS */}
      <div id="how" style={{ maxWidth: 1200, margin: "0 auto", padding: "70px 28px 40px" }}>
        <div data-reveal style={{ textAlign: "center", marginBottom: 54 }}>
          <div style={eyebrow}>How it works</div>
          <h2 style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1, margin: 0 }}>Sealed in. Settled out.</h2>
        </div>
        <div className="ct-grid4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 18 }}>
          {steps.map((step) => (
            <div key={step.num} data-reveal style={{ background: "#12181f", border: "1px solid #232c37", borderRadius: 18, padding: "26px 22px" }}>
              <div style={{ fontFamily: MONO, fontSize: 12, color: AMBER, fontWeight: 600, marginBottom: 16 }}>{step.num}</div>
              <div style={{ width: 46, height: 46, borderRadius: 13, background: "#241b0c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 18 }}>{step.icon}</div>
              <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 9 }}>{step.title}</div>
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "#8b95a3" }}>{step.body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* WHAT STAYS ENCRYPTED */}
      <div id="encrypt" style={{ position: "relative", marginTop: 80, borderTop: "1px solid #14181f", background: "#0a0c10" }}>
        <div className="ct-grid2" style={{ maxWidth: 1200, margin: "0 auto", padding: "90px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <div data-reveal style={eyebrow}>Fully homomorphic encryption</div>
            <h2 data-reveal style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1, lineHeight: 1.12, margin: "0 0 22px" }}>The chain computes on data it can&apos;t read.</h2>
            <p data-reveal style={{ fontSize: 17, lineHeight: 1.6, color: "#aeb8c4", margin: "0 0 30px" }}>
              FHE lets the contract match orders, size allocations and tally P&L while every sensitive value stays ciphertext. No mempool leak, no validator peek — math runs directly on the encrypted numbers.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {fhePoints.map((pt) => (
                <div key={pt.title} data-reveal style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: "#241b0c", border: "1px solid #5e4a24", display: "flex", alignItems: "center", justifyContent: "center", color: "#fbbf24", fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{pt.title}</div>
                    <div style={{ fontSize: 13.5, color: "#8b95a3", lineHeight: 1.5 }}>{pt.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div data-reveal style={{ background: "#12181f", border: "1px solid #232c37", borderRadius: 20, padding: 26, boxShadow: "0 40px 90px -40px rgba(0,0,0,.7)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Position record</div>
              <button onClick={() => setReveal((r) => !r)} style={{ fontFamily: MONO, fontSize: 11, color: "#fbbf24", background: "#241b0c", border: "1px solid #5e4a24", padding: "7px 13px", borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: reveal ? GREEN : "#facc15" }} />{reveal ? "Sealed view" : "Decrypt (you only)"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "#232c37", border: "1px solid #232c37", borderRadius: 14, overflow: "hidden" }}>
              {revealRows.map((row) => (
                <div key={row.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", background: "#0f141a" }}>
                  <span style={{ fontSize: 13, color: MUTED }}>{row.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, fontFamily: MONO, color: row.color, filter: row.blur, transition: "filter .45s,color .45s" }}>{row.value}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, fontSize: 11.5, color: "#5b6168", lineHeight: 1.5, fontFamily: MONO }}>
              {reveal ? "// decrypted locally with your key — never exposed on-chain" : "// stored as ciphertext · only your key can reveal these"}
            </div>
          </div>
        </div>
      </div>

      {/* LEADERBOARD */}
      <div id="traders" style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 28px 40px" }}>
        <div data-reveal style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 40, flexWrap: "wrap", gap: 18 }}>
          <div>
            <div style={eyebrow}>The leaderboard</div>
            <h2 style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1, margin: 0 }}>Follow track records,<br />not trades.</h2>
          </div>
          <Link href="/app" style={{ padding: "13px 24px", background: "#12181f", border: "1px solid #232c37", color: "#eef2f6", fontSize: 14, fontWeight: 600, borderRadius: 11, textDecoration: "none" }}>View all traders →</Link>
        </div>
        <div className="ct-grid3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18 }}>
          {leaderboard.map((t) => (
            <div key={t.name} data-reveal style={{ background: "#12181f", border: "1px solid " + t.cardBorder, borderRadius: 18, padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 18 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: t.avatarBg, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 17 }}>{t.initial}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: MUTED, fontFamily: MONO, marginTop: 2 }}>🔒 sealed · {t.settled} settled</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: t.retColor, fontFamily: MONO }}>{t.ret}</div>
                  <div style={{ fontSize: 10, color: MUTED }}>30D</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 40, marginBottom: 18 }}>
                {t.bars.map((b, i) => (
                  <div key={i} style={{ flex: 1, height: b.h, background: b.c, borderRadius: 2 }} />
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 12, color: MUTED, fontFamily: MONO }}>{t.followers} / 20 copying</div>
                <Link href="/app" style={{ padding: "9px 20px", border: "1px solid #6b5320", color: "#fbbf24", fontSize: 13, fontWeight: 600, borderRadius: 10, textDecoration: "none" }}>Follow</Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* STAKING / FEES */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "90px 28px 40px" }}>
        <div data-reveal className="ct-stake" style={{ background: "linear-gradient(135deg,#101822,#0c1118)", border: "1px solid #232c37", borderRadius: 24, padding: 48, display: "grid", gridTemplateColumns: "1fr 360px", gap: 48, alignItems: "center", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -120, right: -80, width: 400, height: 400, background: "radial-gradient(circle,rgba(245,158,11,.16),transparent 65%)", filter: "blur(10px)" }} />
          <div style={{ position: "relative" }}>
            <div style={eyebrow}>Earn as a lead trader</div>
            <h2 style={{ fontSize: 36, fontWeight: 700, letterSpacing: -1, lineHeight: 1.15, margin: "0 0 16px" }}>Get copied. Keep the fees.</h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#aeb8c4", maxWidth: 460, margin: 0 }}>
              Open up to 20 follower slots. Stake cUSDT to unlock loss-sharing, a higher trust score, and an 18% performance fee on every profitable settlement you generate.
            </p>
          </div>
          <div style={{ position: "relative", display: "flex", gap: 14 }}>
            {feeTiers.map((tier) => (
              <div key={tier.label} style={{ flex: 1, background: tier.bg, border: "1px solid " + tier.border, borderRadius: 16, padding: "22px 18px", textAlign: "center" }}>
                <div style={{ fontSize: 34, fontWeight: 700, fontFamily: MONO, color: tier.color }}>{tier.pct}</div>
                <div style={{ fontSize: 13, color: "#aeb8c4", marginTop: 6, fontWeight: 600 }}>{tier.label}</div>
                <div style={{ fontSize: 11.5, color: MUTED, marginTop: 8, lineHeight: 1.45 }}>{tier.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FINAL CTA */}
      <div style={{ position: "relative", marginTop: 70, borderTop: "1px solid #14181f" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(#0e141c 1px,transparent 1px),linear-gradient(90deg,#0e141c 1px,transparent 1px)", backgroundSize: "54px 54px", opacity: 0.5, maskImage: "radial-gradient(ellipse 70% 80% at 50% 50%,#000 20%,transparent 70%)", WebkitMaskImage: "radial-gradient(ellipse 70% 80% at 50% 50%,#000 20%,transparent 70%)" }} />
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 700, height: 400, background: "radial-gradient(ellipse,rgba(245,158,11,.18),transparent 65%)", filter: "blur(10px)", animation: "ctGlow 7s ease-in-out infinite" }} />
        <div data-reveal style={{ position: "relative", maxWidth: 760, margin: "0 auto", padding: "110px 28px 120px", textAlign: "center" }}>
          <h2 style={{ fontSize: 52, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.08, margin: "0 0 22px" }}>Trade the alpha.<br />Never expose it.</h2>
          <p style={{ fontSize: 18, color: "#aeb8c4", margin: "0 0 36px" }}>Open a sealed position or start copying a proven trader in under a minute.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/app" style={{ padding: "16px 34px", background: AMBER, color: "#fff", fontSize: 16, fontWeight: 600, borderRadius: 13, boxShadow: "0 10px 36px -8px rgba(245,158,11,.65)", textDecoration: "none" }}>Launch CipherTrade →</Link>
            <Link href="/docs" style={{ padding: "16px 30px", background: "#12181f", border: "1px solid #232c37", color: "#eef2f6", fontSize: 16, fontWeight: 600, borderRadius: 13, textDecoration: "none" }}>Read the docs</Link>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: "1px solid #14181f", background: "#0a0c10" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14 }}>C</div>
            <div style={{ fontSize: 14, color: "#aeb8c4" }}>CipherTrade — confidential copy-trading on Ethereum</div>
          </div>
          <div style={{ display: "flex", gap: 26, fontSize: 13, color: MUTED }}>
            <a href="#how" style={{ color: MUTED, textDecoration: "none" }}>How it works</a>
            <Link href="/docs" style={{ color: MUTED, textDecoration: "none" }}>Docs</Link>
            <Link href="/app" style={{ color: MUTED, textDecoration: "none" }}>Launch app</Link>
            <span style={{ fontFamily: MONO }}>© 2026</span>
          </div>
        </div>
      </div>

      {/* responsive */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 900px){
          .ct-hero{grid-template-columns:1fr !important;}
          .ct-h1{font-size:46px !important;}
          .ct-grid2,.ct-grid3,.ct-grid4,.ct-stake{grid-template-columns:1fr !important;}
          .ct-stats{grid-template-columns:repeat(2,1fr) !important;}
          .ct-navlinks,.ct-navprice{display:none !important;}
        }
      ` }} />
    </div>
  );
}
