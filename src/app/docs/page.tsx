"use client";

import Link from "next/link";
import { useState } from "react";

const SANS = "var(--font-space-grotesk), system-ui, sans-serif";
const MONO = "var(--font-jetbrains-mono), monospace";
const AMBER = "#f59e0b";
const GREEN = "#4ade80";
const MUTED = "#7d8896";

const KEYFRAMES = `
@keyframes ctPulse{0%,100%{opacity:.4;}50%{opacity:1;}}
html{scroll-behavior:smooth;}
::selection{background:#f59e0b;color:#fff;}
.doc-sidebar a:hover{color:#eef2f6 !important;}
`;

const toc = [
  { label: "Overview", href: "#overview" },
  { label: "Position lifecycle", href: "#lifecycle" },
  { label: "What FHE does", href: "#fhe" },
  { label: "Settlement", href: "#settlement" },
  { label: "Fees & staking", href: "#economics" },
  { label: "Known limitations", href: "#limitations" },
  { label: "FAQ", href: "#faq" },
];

const tldr = [
  "A trader's direction and size are encrypted in the browser before anything is broadcast.",
  "The contract copies, sizes and tracks positions while every value stays ciphertext.",
  "Front-runners and validators only ever see encrypted blobs — no mempool leak.",
  "On close, a KMS decrypts the real sealed values and writes the verified result to on-chain history.",
];

const lifeData = [
  {
    label: "1 · Encrypt", icon: "🔒", tag: "CLIENT-SIDE", title: "Encrypt the order",
    body: "You choose a direction and size. Both are encrypted locally into ciphertext handles. The plaintext never leaves your device.",
    code: [
      { prefix: "// browser ", text: "encrypt(direction, size)" },
      { prefix: "→ ", text: "euint64 size  = 0x9f2a…c1" },
      { prefix: "→ ", text: "ebool  isLong = 0x4d7b…0a" },
    ],
  },
  {
    label: "2 · Open", icon: "⚙️", tag: "ON-CHAIN", title: "Open the sealed position",
    body: "The ciphertext handles are submitted on-chain. The contract records the position and opens follower slots — all without ever reading the values.",
    code: [
      { prefix: "", text: "openPosition(size, isLong)" },
      { prefix: "// state ", text: "positions[id] = sealed" },
      { prefix: "// event ", text: "PositionOpened(id) 🔒" },
    ],
  },
  {
    label: "3 · Copy", icon: "👥", tag: "FHE COMPUTE", title: "Followers mirror under FHE",
    body: "Copying opens a 1:1 sealed mirror: the lead's encrypted direction, size and leverage are copied straight into the follower's own position — as independent ciphertexts, so neither side is ever decrypted. The follower closes and settles it on their own entry/exit.",
    code: [
      { prefix: "", text: "copyTrade(leader, price)" },
      { prefix: "// copy ", text: "dir = FHE.and(lead.dir, true)" },
      { prefix: "→ ", text: "positions[follower] = sealed 🔒" },
    ],
  },
  {
    label: "4 · Settle", icon: "🔓", tag: "KMS DECRYPT", title: "Settle & reveal",
    body: "On close the values are marked decryptable. The KMS posts the cleartext result, P&L is computed, and payouts settle pro-rata in one transaction.",
    code: [
      { prefix: "", text: "requestDecrypt(pnl)" },
      { prefix: "// KMS  ", text: "pnl = +18.40%" },
      { prefix: "→ ", text: "payout(followers, fee) ✓" },
    ],
  },
];

const fheFlow = [
  { icon: "📝", title: "Plaintext", value: "size = 2500", bg: "#0f141a", border: "#1b222b", titleColor: "#eef2f6", note: "Only in your browser" },
  { icon: "🔒", title: "Ciphertext", value: "0x9f2a…c1", bg: "#241b0c", border: "#5e4a24", titleColor: AMBER, note: "Broadcast on-chain" },
  { icon: "⚙️", title: "FHE compute", value: "mul · add · cmp", bg: "#241b0c", border: "#5e4a24", titleColor: AMBER, note: "Runs on ciphertext" },
  { icon: "🔓", title: "Decrypt", value: "+18.40%", bg: "#0f1f17", border: "#1f4630", titleColor: GREEN, note: "KMS, on settle only" },
];

const fheFacts = [
  { title: "No mempool leak", body: "Pending transactions carry ciphertext, so there is nothing for front-runners to copy." },
  { title: "Validators stay blind", body: "Block producers order encrypted calls without ever learning what they contain." },
  { title: "Correct by construction", body: "Homomorphic ops guarantee the encrypted result equals the plaintext computation." },
  { title: "You own decryption", body: "Only your key (or an explicit settlement request) can turn a handle back into a number." },
];

const rawSettle = [
  { label: "Direction", raw: "▲ LONG", col: GREEN },
  { label: "Size", raw: "2,500 u", col: "#eef2f6" },
  { label: "Exit price", raw: "$1,184.00", col: "#eef2f6" },
  { label: "Realized P&L", raw: "+18.40%", col: GREEN },
];

const econRows = [
  { param: "Performance fee", unstaked: "8%", staked: "18%" },
  { param: "Loss-sharing", unstaked: "—", staked: "Yes" },
  { param: "Trust score", unstaked: "Base", staked: "Boosted" },
  { param: "Follower slots", unstaked: "20", staked: "20" },
];

const limitations = [
  { tag: "PROTOTYPE", title: "Positions are uncollateralized", body: "This testnet build does not lock margin equal to a position's size, so settled P&L is not backed by collateral. A losing trade that exceeds the trader's cUSDT balance is capped at their balance rather than reverting. Margin-locking against the confidential cUSDT balance is the natural next step for a mainnet version." },
  { tag: "TRUST", title: "Settlement runs through an admin key", body: "Closing marks the ciphertext publicly decryptable; an off-chain settler then decrypts the real values and submits them. It never trusts the browser, but it is a liveness dependency — if the settler is offline, history populates once it runs. A fully on-chain decryption-oracle callback removes this." },
  { tag: "SCOPE", title: "TP/SL is sealed, not auto-executed", body: "Encrypted take-profit / stop-loss targets are stored on-chain and hidden from copiers, but the contract does not yet auto-close when price crosses them. They are confidential markers, not automated triggers." },
  { tag: "PRIVACY", title: "The copy link is public", body: "Direction, size, leverage and P&L stay encrypted, but the fact that you copied a given trader is visible on-chain — the contract must read the lead's position by address to mirror it. CipherTrade hides the trade, not the relationship." },
  { tag: "TESTNET", title: "cUSDT is a mock token", body: "wrap()/faucet() mint confidential cUSDT out of thin air for testing — there's no real USDT backing it. A mainnet version would wrap a real ERC-20 with a locked deposit." },
];

const faqData = [
  { q: "Can I see the trader I'm copying?", a: "No — and that's the point. You see their verified track record (settled count, 30-day return, win rate) but never their live direction or size. You're betting on the record, not reverse-engineering the trade." },
  { q: "How does copying work if the trade is hidden?", a: "Copying opens a 1:1 sealed mirror of the lead's position — their encrypted direction, size and leverage are copied straight into your own position as independent ciphertexts, without anyone decrypting them. You then close and settle that mirror on your own entry and exit, exactly like a normal position. You copy the sealed trade, not a number you can read." },
  { q: "What is cUSDT?", a: "A confidential USDT balance — your stake and allocations are held as encrypted token amounts, so even your position sizing stays private on-chain." },
  { q: "Is my own position visible to me?", a: "Yes. You can always decrypt your own position locally with your key. What stays hidden is the lead trader's position from followers, and everyone's positions from the public." },
];

export default function DocsPage() {
  const [lifeTab, setLifeTab] = useState(0);
  const [settleStep, setSettleStep] = useState(0);
  const [settleRunning, setSettleRunning] = useState(false);
  const [faqOpen, setFaqOpen] = useState(-1);

  const cur = lifeData[lifeTab];

  function runSettle() {
    if (settleRunning) return;
    if (settleStep >= 4) { setSettleStep(0); return; }
    setSettleRunning(true);
    setSettleStep(0);
    let step = 0;
    const t = setInterval(() => {
      step++;
      setSettleStep(step);
      if (step >= 4) { clearInterval(t); setSettleRunning(false); }
    }, 650);
  }

  const settleDone = settleStep >= 4;

  return (
    <div style={{ background: "#08090c", color: "#eef2f6", minHeight: "100vh", fontFamily: SANS }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* NAV */}
      <div style={{ position: "sticky", top: 0, zIndex: 40, backdropFilter: "blur(14px)", background: "rgba(8,9,12,.72)", borderBottom: "1px solid #14181f" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none" }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#f59e0b,#fbbf24)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 16, boxShadow: "0 0 18px rgba(245,158,11,.5)" }}>C</div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>CipherTrade <span style={{ color: MUTED, fontWeight: 400 }}>Docs</span></div>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
            <Link href="/" style={{ fontSize: 14, color: "#aeb8c4", textDecoration: "none" }}>Home</Link>
            <Link href="/#traders" style={{ fontSize: 14, color: "#aeb8c4", textDecoration: "none" }}>Traders</Link>
            <Link href="/app" style={{ padding: "10px 20px", background: AMBER, color: "#fff", fontSize: 14, fontWeight: 600, borderRadius: 10, boxShadow: "0 0 20px rgba(245,158,11,.35)", textDecoration: "none" }}>Launch app</Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 28px", display: "grid", gridTemplateColumns: "220px 1fr", gap: 56, alignItems: "start" }} className="docs-grid">

        {/* SIDEBAR */}
        <div className="doc-sidebar" style={{ position: "sticky", top: 90, paddingTop: 48 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: "#5b6168", textTransform: "uppercase", marginBottom: 16 }}>On this page</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, borderLeft: "1px solid #1b222b" }}>
            {toc.map((item) => (
              <a key={item.href} href={item.href} style={{ fontSize: 13.5, color: "#8b95a3", padding: "8px 0 8px 16px", marginLeft: -1, borderLeft: "2px solid transparent", textDecoration: "none" }}>{item.label}</a>
            ))}
          </div>
          <Link href="/app" style={{ display: "block", marginTop: 28, padding: "12px 16px", background: "#241b0c", border: "1px solid #5e4a24", borderRadius: 11, fontSize: 13, color: "#fbbf24", fontWeight: 600, textAlign: "center", textDecoration: "none" }}>Open the app →</Link>
        </div>

        {/* CONTENT */}
        <div style={{ padding: "48px 0 120px", maxWidth: 760 }}>

          {/* HEADER */}
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: AMBER, textTransform: "uppercase", marginBottom: 14 }}>Documentation</div>
          <h1 style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1.5, lineHeight: 1.08, margin: "0 0 18px" }}>How confidential copy-trading works</h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "#aeb8c4", margin: "0 0 40px" }}>
            CipherTrade runs copy-trading on Ethereum where the trades being copied are never revealed. This page explains the lifecycle, the cryptography, and the economics — end to end.
          </p>

          {/* TL;DR */}
          <div style={{ background: "linear-gradient(135deg,#101822,#0c1118)", border: "1px solid #5e4a24", borderRadius: 18, padding: 26, marginBottom: 56 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: AMBER, fontFamily: MONO, marginBottom: 14 }}>TL;DR</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
              {tldr.map((row, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ color: AMBER, fontSize: 14, marginTop: 2 }}>▸</span>
                  <span style={{ fontSize: 15, lineHeight: 1.5, color: "#cdd5de" }}>{row}</span>
                </div>
              ))}
            </div>
          </div>

          {/* §1 OVERVIEW */}
          <div id="overview" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 14, color: AMBER }}>01</span>Overview
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#aeb8c4", margin: "0 0 16px" }}>
              On a normal copy-trade platform, a lead trader&apos;s position is public the instant it opens. Followers copy it — but so do front-runners, who race the same trade and erode the fill before anyone profits. The transparency that makes copying possible is the same thing that destroys the edge.
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#aeb8c4", margin: 0 }}>
              CipherTrade closes that gap with <span style={{ color: "#eef2f6", fontWeight: 600 }}>fully homomorphic encryption (FHE)</span>. A trader&apos;s direction and size are encrypted before they ever leave the browser. The contract still copies the position, sizes each follower&apos;s allocation, and computes profit — but it does all of this on ciphertext. Nobody, including validators, sees the trade until the trader chooses to settle.
            </p>
          </div>

          {/* §2 LIFECYCLE */}
          <div id="lifecycle" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 22px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 14, color: AMBER }}>02</span>The position lifecycle
            </h2>
            <div style={{ background: "#0c1118", border: "1px solid #1b222b", borderRadius: 18, padding: 8, marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 6, padding: 8 }}>
                {lifeData.map((d, i) => (
                  <button key={i} onClick={() => setLifeTab(i)} style={{
                    flex: 1, padding: "11px 8px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: SANS,
                    border: i === lifeTab ? "1px solid #6b5320" : "1px solid transparent",
                    background: i === lifeTab ? "#241b0c" : "transparent",
                    color: i === lifeTab ? "#fbbf24" : MUTED, transition: "all .2s",
                  }}>{d.label}</button>
                ))}
              </div>
              <div style={{ padding: 24, background: "#0f141a", borderRadius: 13, margin: "0 8px 8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: "#241b0c", border: "1px solid #5e4a24", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>{cur.icon}</div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>{cur.title}</div>
                    <div style={{ fontSize: 12, color: AMBER, fontFamily: MONO }}>{cur.tag}</div>
                  </div>
                </div>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: "#aeb8c4", margin: "0 0 16px" }}>{cur.body}</p>
                <div style={{ background: "#0a0d12", border: "1px solid #1b222b", borderRadius: 10, padding: "14px 16px", fontFamily: MONO, fontSize: 13, color: "#8bd5c4", lineHeight: 1.7 }}>
                  {cur.code.map((line, i) => (
                    <div key={i}><span style={{ color: "#5b6168" }}>{line.prefix}</span>{line.text}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* §3 FHE */}
          <div id="fhe" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 14, color: AMBER }}>03</span>What FHE actually does
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#aeb8c4", margin: "0 0 24px" }}>
              Fully homomorphic encryption lets a contract run arithmetic directly on encrypted numbers. Add two ciphertexts and you get the encryption of their sum — without ever decrypting. CipherTrade uses this to keep the entire trade confidential while still settling correctly on-chain.
            </p>
            <div style={{ background: "#0c1118", border: "1px solid #1b222b", borderRadius: 18, padding: 28, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "stretch", gap: 14 }}>
                {fheFlow.map((node, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                    <div style={{ width: "100%", background: node.bg, border: "1px solid " + node.border, borderRadius: 13, padding: "16px 10px" }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>{node.icon}</div>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: node.titleColor }}>{node.title}</div>
                      <div style={{ fontFamily: MONO, fontSize: 10.5, color: MUTED, marginTop: 6, lineHeight: 1.4 }}>{node.value}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#5b6168", marginTop: 10, lineHeight: 1.4 }}>{node.note}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {fheFacts.map((f) => (
                <div key={f.title} style={{ background: "#0f141a", border: "1px solid #1b222b", borderRadius: 13, padding: 18 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{f.title}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.55, color: "#8b95a3" }}>{f.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* §4 SETTLEMENT */}
          <div id="settlement" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 14, color: AMBER }}>04</span>Settlement &amp; decryption
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#aeb8c4", margin: "0 0 22px" }}>
              When a position closes, its encrypted values are marked publicly decryptable. A Key Management Service (KMS) decrypts the <span style={{ color: "#eef2f6", fontWeight: 600 }}>real on-chain ciphertext</span> — not anything the browser claims — and the contract records the verified direction, size, leverage and P&amp;L to the trader&apos;s history, crediting their confidential balance. A copied position is its own sealed mirror, so each follower settles independently the exact same way.
            </p>
            <div style={{ background: "#0c1118", border: "1px solid #1b222b", borderRadius: 18, padding: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Try it — settle a sealed position</div>
                <button onClick={runSettle} style={{ fontFamily: MONO, fontSize: 12, color: "#fff", background: AMBER, border: "none", padding: "9px 16px", borderRadius: 9, cursor: "pointer", fontWeight: 600 }}>
                  {settleDone ? "Reset" : "Settle position"}
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "#1b222b", border: "1px solid #1b222b", borderRadius: 13, overflow: "hidden" }}>
                {rawSettle.map((r, i) => {
                  const shown = settleStep > i;
                  return (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", background: "#0f141a" }}>
                      <span style={{ fontSize: 13, color: MUTED }}>{r.label}</span>
                      <span style={{ fontSize: 14, fontWeight: 600, fontFamily: MONO, color: shown ? r.col : MUTED, filter: shown ? "none" : "blur(5px)", transition: "filter .45s,color .45s" }}>
                        {shown ? r.raw : "🔒 ••••••"}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 14, fontFamily: MONO, fontSize: 11.5, color: AMBER, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: settleDone ? GREEN : "#fbbf24", animation: "ctPulse 1.5s infinite", display: "inline-block" }} />
                {settleDone ? "decrypted — verified P&L written to on-chain history" : settleRunning ? "KMS decrypting the real on-chain ciphertext…" : "position sealed · click settle to decrypt"}
              </div>
            </div>
          </div>

          {/* §5 ECONOMICS */}
          <div id="economics" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 14, color: AMBER }}>05</span>Fees &amp; staking
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#aeb8c4", margin: "0 0 22px" }}>
              Lead traders earn a performance fee on profitable settlements. Staking cUSDT raises that fee and unlocks loss-sharing — your stake can absorb a slice of follower losses, which raises your trust score and ranking.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "#1b222b", border: "1px solid #1b222b", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", background: "#241b0c" }}>
                <div style={{ padding: "14px 18px", fontSize: 12, fontWeight: 600, color: AMBER, fontFamily: MONO }}>PARAMETER</div>
                <div style={{ padding: "14px 18px", fontSize: 12, fontWeight: 600, color: "#8b95a3", fontFamily: MONO }}>UNSTAKED</div>
                <div style={{ padding: "14px 18px", fontSize: 12, fontWeight: 600, color: AMBER, fontFamily: MONO }}>STAKED</div>
              </div>
              {econRows.map((row) => (
                <div key={row.param} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", background: "#0f141a" }}>
                  <div style={{ padding: "15px 18px", fontSize: 14, color: "#cdd5de" }}>{row.param}</div>
                  <div style={{ padding: "15px 18px", fontSize: 14, color: "#8b95a3", fontFamily: MONO }}>{row.unstaked}</div>
                  <div style={{ padding: "15px 18px", fontSize: 14, color: "#eef2f6", fontFamily: MONO }}>{row.staked}</div>
                </div>
              ))}
            </div>
          </div>

          {/* §6 KNOWN LIMITATIONS */}
          <div id="limitations" style={{ scrollMarginTop: 90, marginBottom: 64 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 14, color: AMBER }}>06</span>Known limitations
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#aeb8c4", margin: "0 0 22px" }}>
              CipherTrade is a working prototype on Sepolia, built to demonstrate confidential copy-trading under FHE. In the interest of being straight about scope, here is what it deliberately does <span style={{ color: "#eef2f6", fontWeight: 600 }}>not</span> do yet — none of these affect the confidentiality guarantees, only the production-economics around them.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {limitations.map((l) => (
                <div key={l.title} style={{ background: "#0f141a", border: "1px solid #1b222b", borderRadius: 13, padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                    <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: "#fbbf24", background: "#241b0c", border: "1px solid #5e4a24", padding: "3px 8px", borderRadius: 6 }}>{l.tag}</span>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{l.title}</span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, color: "#8b95a3" }}>{l.body}</div>
                </div>
              ))}
            </div>
          </div>

          {/* §7 FAQ */}
          <div id="faq" style={{ scrollMarginTop: 90, marginBottom: 56 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 22px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: MONO, fontSize: 14, color: AMBER }}>07</span>FAQ
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {faqData.map((f, i) => (
                <div key={i} style={{ background: "#0f141a", border: "1px solid #1b222b", borderRadius: 13, overflow: "hidden" }}>
                  <button onClick={() => setFaqOpen(faqOpen === i ? -1 : i)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: "#eef2f6", fontFamily: SANS }}>{f.q}</span>
                    <span style={{ fontSize: 20, color: AMBER, transform: faqOpen === i ? "rotate(45deg)" : "none", transition: "transform .25s", display: "inline-block" }}>+</span>
                  </button>
                  <div style={{ maxHeight: faqOpen === i ? 220 : 0, overflow: "hidden", transition: "max-height .3s ease" }}>
                    <div style={{ padding: "0 20px 18px", fontSize: 14.5, lineHeight: 1.65, color: "#8b95a3" }}>{f.a}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{ background: "linear-gradient(135deg,#101822,#0c1118)", border: "1px solid #5e4a24", borderRadius: 20, padding: 38, textAlign: "center" }}>
            <h3 style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.5, margin: "0 0 10px" }}>Ready to trade confidentially?</h3>
            <p style={{ fontSize: 15, color: "#aeb8c4", margin: "0 0 24px" }}>Open a sealed position or copy a proven trader in the live app.</p>
            <Link href="/app" style={{ display: "inline-block", padding: "15px 32px", background: AMBER, color: "#fff", fontSize: 15, fontWeight: 600, borderRadius: 12, boxShadow: "0 10px 30px -8px rgba(245,158,11,.6)", textDecoration: "none" }}>Launch CipherTrade →</Link>
          </div>

        </div>
      </div>

      {/* responsive */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media(max-width:860px){
          .docs-grid{grid-template-columns:1fr !important;}
          .doc-sidebar{display:none;}
        }
      ` }} />
    </div>
  );
}
