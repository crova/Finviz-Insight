import { useState, useEffect } from "react";

// ─── Seed data ────────────────────────────────────────────────────────────────
const SEED = {
  NVDA: {
    price: 875.40, change: 3.2, volume: 48200000, rel_vol: 2.1,
    pe: 62.4, fwd_pe: 38.1, eps: 14.02, eps_growth: 89.2,
    market_cap: "2.15T",
    analyst: { consensus: "Strong Buy", avg_target: 1050, buy: 38, hold: 4, sell: 0 },
    tech: { rsi: 68.4, sma20: true, sma50: true, sma200: true, beta: 1.72 },
    earnings: { next: "Feb 21 AMC", beat_pct: 8.2 },
    news: [
      "Goldman Sachs raises NVDA target to $1,100 — AI infrastructure supercycle thesis intact",
      "NVDA data center revenue beats by 12%; H100 demand backlog extends to mid-2025",
      "Three hyperscalers announce expanded NVDA GPU procurement in Q4 capex plans",
      "Blackwell architecture launch: analysts call it a generational performance leap over H100",
    ],
    sector: { name: "Technology", perf_1m: 7.4, perf_3m: 18.2 },
  },
  AAPL: {
    price: 183.50, change: -0.8, volume: 62100000, rel_vol: 0.9,
    pe: 28.4, fwd_pe: 26.1, eps: 6.46, eps_growth: 8.0,
    market_cap: "2.83T",
    analyst: { consensus: "Buy", avg_target: 205, buy: 28, hold: 17, sell: 3 },
    tech: { rsi: 44.2, sma20: false, sma50: true, sma200: true, beta: 1.18 },
    earnings: { next: "Jan 31 AMC", beat_pct: 1.4 },
    news: [
      "iPhone 16 cycle showing weaker China demand — industry channel checks soften",
      "Morgan Stanley cuts AAPL estimates; services growth trajectory decelerating",
      "Apple Vision Pro sales tracking below internal targets per WSJ supply chain report",
      "Bernstein maintains Outperform — Apple Intelligence seen as underappreciated 2025 catalyst",
    ],
    sector: { name: "Technology", perf_1m: 7.4, perf_3m: 18.2 },
  },
  SPY: {
    price: 475.20, change: -0.3, volume: 89400000, rel_vol: 1.1,
    pe: 22.1, fwd_pe: 20.4, eps: 21.50, eps_growth: 11.0,
    market_cap: "—",
    analyst: { consensus: "Buy", avg_target: 520, buy: 8, hold: 4, sell: 0 },
    tech: { rsi: 52.8, sma20: true, sma50: true, sma200: true, beta: 1.00 },
    earnings: { next: "Q4 season ongoing", beat_pct: 2.1 },
    news: [
      "Fed signals two 2024 rate cuts; inflation persistence creates timeline uncertainty",
      "Q4 earnings: 71% of S&P 500 reporters beating EPS — above 5-year avg of 67%",
      "Treasury 10Y yield climbs to 4.6% as strong jobs data delays cut expectations",
      "Goldman: equity risk premium near decade lows — market pricing near-perfection",
    ],
    sector: { name: "Broad Market", perf_1m: 1.8, perf_3m: 9.4 },
  },
  META: {
    price: 502.30, change: 2.1, volume: 18900000, rel_vol: 1.4,
    pe: 26.8, fwd_pe: 22.1, eps: 18.74, eps_growth: 23.7,
    market_cap: "1.29T",
    analyst: { consensus: "Strong Buy", avg_target: 575, buy: 47, hold: 8, sell: 0 },
    tech: { rsi: 61.2, sma20: true, sma50: true, sma200: true, beta: 1.34 },
    earnings: { next: "Jan 31 AMC", beat_pct: 14.1 },
    news: [
      "Meta raises Q4 guidance — AI ad targeting driving accelerating revenue per user",
      "Meta AI surpasses 500M monthly actives — fastest consumer AI adoption ever recorded",
      "Threads reaches 160M MAU, attracting brand advertisers exiting X platform",
      "2024 capex discipline signals infrastructure maturity returning after 2022 reset",
    ],
    sector: { name: "Communication Services", perf_1m: 5.2, perf_3m: 22.1 },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = {
  p:   n => `$${n.toFixed(2)}`,
  pct: n => `${n > 0 ? "+" : ""}${n.toFixed(1)}%`,
  vol: n => n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : `${(n / 1e6).toFixed(1)}M`,
};

// ─── Claude API ───────────────────────────────────────────────────────────────
async function callClaude(system, user) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1400,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await res.json();
  return data.content[0].text;
}

function parseJSON(raw) {
  const text = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(text);
}

// ─── Pipeline step definitions ────────────────────────────────────────────────
const STEP_DEFS = [
  { id: "evidence",   num: "01", label: "Evidence Gathering"    },
  { id: "classify",   num: "02", label: "Signal Classification"  },
  { id: "rank",       num: "03", label: "Importance Ranking"     },
  { id: "narrative",  num: "04", label: "Narrative Generation"   },
  { id: "confidence", num: "05", label: "Confidence Review"      },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function FinvizInsight() {
  const [ticker,     setTicker]     = useState(null);
  const [steps,      setSteps]      = useState({});
  const [running,    setRunning]    = useState(false);
  const [expanded,   setExpanded]   = useState(new Set());
  const [fontsReady, setFontsReady] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Bebas+Neue&family=DM+Serif+Display:ital@0;1&display=swap";
    link.onload = () => setFontsReady(true);
    document.head.appendChild(link);
  }, []);

  const mono    = fontsReady ? "'IBM Plex Mono', monospace"  : "monospace";
  const display = fontsReady ? "'Bebas Neue', sans-serif"    : "sans-serif";
  const serif   = fontsReady ? "'DM Serif Display', serif"   : "serif";

  const setStep = (id, status, output = null) =>
    setSteps(prev => ({ ...prev, [id]: { status, output } }));

  const toggleExpand = key =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const selectTicker = t => {
    setTicker(t);
    setSteps({});
    setExpanded(new Set());
  };

  // ── Pipeline ─────────────────────────────────────────────────────────────

  const runPipeline = async () => {
    if (!ticker || running) return;
    setRunning(true);
    setSteps({});
    setExpanded(new Set());
    const d = SEED[ticker];

    const snapshot = `Ticker: ${ticker} @ ${fmt.p(d.price)} (${fmt.pct(d.change)})
Volume: ${fmt.vol(d.volume)} | Rel Vol: ${d.rel_vol}x
P/E: ${d.pe} | Fwd P/E: ${d.fwd_pe} | EPS: $${d.eps} | EPS Growth YoY: ${d.eps_growth}%
Market Cap: ${d.market_cap}
Analyst: ${d.analyst.consensus} | Target: ${fmt.p(d.analyst.avg_target)} | Buy: ${d.analyst.buy} / Hold: ${d.analyst.hold} / Sell: ${d.analyst.sell}
RSI: ${d.tech.rsi} | SMA20: ${d.tech.sma20 ? "above" : "below"} | SMA50: ${d.tech.sma50 ? "above" : "below"} | SMA200: ${d.tech.sma200 ? "above" : "below"} | Beta: ${d.tech.beta}
Next Earnings: ${d.earnings.next} | Last EPS Beat: +${d.earnings.beat_pct}%
Sector: ${d.sector.name} | 1M Perf: ${fmt.pct(d.sector.perf_1m)} | 3M Perf: ${fmt.pct(d.sector.perf_3m)}
News:
${d.news.map((n, i) => `${i + 1}. ${n}`).join("\n")}`;

    try {
      // Step 1 — Evidence Gathering
      setStep("evidence", "running");
      const ev_raw = await callClaude(
        "You are a financial data analyst extracting market evidence. Return ONLY valid JSON with no markdown fences and no explanation text.",
        `From this ${ticker} Finviz snapshot, extract 6-9 distinct evidence items. Return this exact JSON shape:
{"evidence":[{"id":"ev1","text":"concise description of the signal","source":"data category label","category":"fundamental|technical|sentiment|momentum","lean":1,"why_included":"one sentence on why this matters to investors"}]}
lean: 1=bullish lean, -1=bearish lean, 0=neutral. Cover fundamentals, technicals, sentiment, and news.

Data:
${snapshot}`
      );
      const ev = parseJSON(ev_raw);
      setStep("evidence", "done", ev);

      // Step 2 — Signal Classification
      setStep("classify", "running");
      const cl_raw = await callClaude(
        "You are a financial signal classifier. Classify market evidence by directional implication. Return ONLY valid JSON, no markdown, no explanation.",
        `Classify these ${ticker} evidence items into bullish, bearish, and neutral groups. Return this exact JSON shape:
{"bullish":[{"id":"ev1","text":"...","reason":"one sentence why bullish"}],"bearish":[...],"neutral":[...],"classifier_note":"one sentence summary of the overall signal picture"}

Evidence:
${JSON.stringify(ev.evidence)}`
      );
      const cl = parseJSON(cl_raw);
      setStep("classify", "done", cl);

      // Step 3 — Importance Ranking
      setStep("rank", "running");
      const rk_raw = await callClaude(
        "You are a portfolio analyst ranking signals by investor importance. Return ONLY valid JSON, no markdown, no explanation.",
        `Rank the top 5-7 ${ticker} signals by their importance to an investor thesis. Return this exact JSON shape:
{"ranked":[{"rank":1,"signal":"...","direction":"bullish|bearish|neutral","weight":"high|medium|low","reasoning":"one sentence on why this rank"}],"methodology":"one sentence on how you weighted the signals"}

Classified signals:
${JSON.stringify(cl)}`
      );
      const rk = parseJSON(rk_raw);
      setStep("rank", "done", rk);

      // Step 4 — Narrative Generation
      setStep("narrative", "running");
      const na_raw = await callClaude(
        "You are an investor briefing writer. Write educational market narratives — never give buy/sell/hold recommendations. Frame everything as 'what the data shows'. Return ONLY valid JSON, no markdown, no explanation.",
        `Generate an investor narrative for ${ticker} grounded in these ranked signals. Return this exact JSON shape:
{"what":"2-3 sentences: what happened in the data","why":"2-3 sentences: why this configuration matters to investors","bull":"2-3 sentences: bullish interpretation of the evidence","bear":"2-3 sentences: bearish interpretation of the evidence","questions":["question 1","question 2","question 3","question 4"]}

Ranked signals:
${JSON.stringify(rk)}`
      );
      const na = parseJSON(na_raw);
      setStep("narrative", "done", na);

      // Step 5 — Confidence Review
      setStep("confidence", "running");
      const co_raw = await callClaude(
        "You are an AI analyst auditor assessing the quality and confidence of a market brief. Return ONLY valid JSON, no markdown, no explanation.",
        `Review this full ${ticker} analysis pipeline and assess confidence. Return this exact JSON shape:
{"level":"HIGH|MEDIUM|LOW","score":82,"reasoning":"2 sentences: what drives this confidence level","gaps":["data gap 1","data gap 2","data gap 3"],"data_quality":"one sentence on what's present vs missing in the underlying data"}

Pipeline output:
Evidence: ${JSON.stringify(ev.evidence)}
Classification: ${JSON.stringify(cl)}
Rankings: ${JSON.stringify(rk.ranked)}
Narrative: ${JSON.stringify(na)}`
      );
      const co = parseJSON(co_raw);
      setStep("confidence", "done", co);

    } catch {
      setSteps(prev => {
        const next = { ...prev };
        for (const id of Object.keys(next)) {
          if (next[id].status === "running") next[id] = { status: "error", output: null };
        }
        return next;
      });
    } finally {
      setRunning(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const C = {
    bg: "#07090c", text: "#c4d4e0", dim: "#4a6070", bright: "#e4f0f8",
    accent: "#38bdf8", bull: "#4ade80", bear: "#f87171", neutral: "#8ab8c8",
    card: "#090d12", border: "#0d1820", borderMid: "#1a3040", gold: "#c8a83a",
  };

  const css = {
    root:  { minHeight: "100vh", background: C.bg, color: C.text, fontFamily: mono },
    inner: { maxWidth: 720, margin: "0 auto", padding: "40px 24px 80px" },

    eyebrow: { fontSize: 10, letterSpacing: ".28em", color: "#2a7a9e", textTransform: "uppercase", marginBottom: 6 },
    title:   { fontFamily: display, fontSize: "clamp(44px, 10vw, 72px)", lineHeight: .9, color: C.bright, letterSpacing: ".02em", marginBottom: 8 },
    titleAc: { color: C.accent },
    sub:     { fontSize: 9, color: C.dim, letterSpacing: ".18em", marginBottom: 32 },

    tickerGrid: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 16 },
    tickerBtn: t => ({
      fontFamily: mono, fontSize: 13, fontWeight: 600, letterSpacing: ".1em",
      padding: "12px 4px", borderRadius: 2, cursor: "pointer", border: "1px solid",
      transition: "all .15s",
      borderColor: ticker === t ? C.accent : C.border,
      background:  ticker === t ? "rgba(56,189,248,.07)" : "transparent",
      color:       ticker === t ? C.accent : "#3a5868",
    }),

    snapBar:   { background: C.card, border: `1px solid ${C.border}`, borderRadius: 2, padding: "12px 16px", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: "12px 20px" },
    snapItem:  { display: "flex", flexDirection: "column", gap: 3 },
    snapLabel: { fontSize: 8, letterSpacing: ".2em", color: C.dim, textTransform: "uppercase" },
    snapVal:   col => ({ fontSize: 13, fontWeight: 600, color: col || C.text }),

    runBtn: {
      width: "100%", padding: 14, borderRadius: 2,
      background: running ? "rgba(56,189,248,.03)" : "rgba(56,189,248,.08)",
      border: `1px solid ${running ? C.border : C.borderMid}`,
      color: running ? C.dim : C.accent, fontFamily: mono, fontSize: 11,
      letterSpacing: ".15em", cursor: running ? "default" : "pointer",
      marginBottom: 28, transition: "all .2s",
    },

    pipeHead: { fontSize: 9, letterSpacing: ".25em", color: C.dim, textTransform: "uppercase", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 },
    pipeDot:  active => ({ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: active ? C.accent : C.dim, flexShrink: 0 }),

    stepCard: status => ({
      marginBottom: 10, borderRadius: 2, overflow: "hidden",
      border: `1px solid ${status === "running" ? C.accent : status === "done" ? C.borderMid : status === "error" ? "#4a1010" : C.border}`,
      opacity: status === "idle" ? 0.3 : 1, transition: "all .25s",
    }),
    stepHdr: status => ({
      display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
      background: status === "running" ? "rgba(56,189,248,.04)" : C.card,
      borderBottom: status === "done" ? `1px solid ${C.border}` : "none",
    }),
    stepNum:   { fontSize: 9, color: C.dim, letterSpacing: ".15em", minWidth: 24 },
    stepLabel: status => ({ fontSize: 11, fontWeight: 600, letterSpacing: ".12em", flex: 1, color: status === "running" ? C.accent : status === "done" ? C.text : C.dim }),
    stepStat:  status => ({ fontSize: 9, letterSpacing: ".12em", color: status === "running" ? C.accent : status === "done" ? C.bull : status === "error" ? C.bear : C.dim }),
    stepBody:  { padding: "14px 14px" },

    evItem:   { marginBottom: 7, border: `1px solid ${C.border}`, borderRadius: 2, overflow: "hidden" },
    evRow:    { display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 12px", cursor: "pointer", background: C.card },
    evLean:   lean => ({ fontSize: 9, fontWeight: 700, minWidth: 14, paddingTop: 1, color: lean === 1 ? C.bull : lean === -1 ? C.bear : C.neutral }),
    evText:   { flex: 1, fontSize: 10, color: C.text, lineHeight: 1.5 },
    evSource: { fontSize: 8, color: C.dim, letterSpacing: ".1em", textTransform: "uppercase", paddingTop: 2, whiteSpace: "nowrap" },
    evArrow:  { fontSize: 8, color: C.dim, paddingTop: 2 },
    evDetail: { background: "#060b10", padding: "10px 12px", borderTop: `1px solid ${C.border}` },
    evWhy:    { fontSize: 8, color: C.dim, letterSpacing: ".15em", display: "block", marginBottom: 4 },
    evWhyTxt: { fontFamily: serif, fontSize: "clamp(11px, 2.2vw, 13px)", color: "#5a8898", lineHeight: 1.65 },

    clGrid:   { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 },
    clCol:    dir => ({
      background: C.card, borderRadius: 2, padding: 10, border: "1px solid",
      borderColor: dir === "bullish" ? "rgba(74,222,128,.18)" : dir === "bearish" ? "rgba(248,113,113,.18)" : C.border,
    }),
    clHead:   dir => ({ fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 8, fontWeight: 600, color: dir === "bullish" ? C.bull : dir === "bearish" ? C.bear : C.neutral }),
    clItem:   { fontSize: 10, color: "#5a8898", lineHeight: 1.5, marginBottom: 7, paddingBottom: 7, borderBottom: `1px solid ${C.border}` },
    clReason: { fontSize: 9, color: C.dim, marginTop: 3, fontStyle: "italic" },
    clNote:   { fontSize: 9, color: C.dim, marginTop: 10, lineHeight: 1.6 },

    rkItem:   { display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}`, alignItems: "flex-start" },
    rkNum:    { fontSize: 10, color: C.dim, minWidth: 20, paddingTop: 1 },
    rkSignal: { flex: 1, fontSize: 10, color: C.text, lineHeight: 1.45 },
    rkBadge:  (w, dir) => ({
      fontSize: 8, padding: "2px 7px", borderRadius: 2, fontWeight: 600, letterSpacing: ".08em", whiteSpace: "nowrap",
      background: w === "high" ? "rgba(56,189,248,.1)" : "rgba(74,86,94,.12)",
      color:      w === "high" ? C.accent : C.dim,
    }),
    rkDir:    dir => ({ fontSize: 8, padding: "2px 7px", borderRadius: 2, whiteSpace: "nowrap", background: "transparent", color: dir === "bullish" ? C.bull : dir === "bearish" ? C.bear : C.neutral }),
    rkReason: { fontSize: 9, color: C.dim, marginTop: 3, lineHeight: 1.4 },
    rkMethod: { fontSize: 9, color: C.dim, marginTop: 10, lineHeight: 1.6 },

    narLabel: { fontSize: 9, letterSpacing: ".22em", color: C.dim, textTransform: "uppercase", marginBottom: 5 },
    narText:  { fontFamily: serif, fontSize: "clamp(13px, 2.5vw, 15px)", lineHeight: 1.7, color: "#a0b8c4", marginBottom: 14 },
    narGrid:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "4px 0 14px" },
    narCard:  dir => ({ background: C.card, borderRadius: 2, padding: 12, border: "1px solid", borderColor: dir === "bull" ? "rgba(74,222,128,.14)" : "rgba(248,113,113,.14)" }),
    narCHead: dir => ({ fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 6, fontWeight: 600, color: dir === "bull" ? C.bull : C.bear }),
    narCText: { fontFamily: serif, fontSize: "clamp(11px, 2.2vw, 13px)", color: "#7a9aaa", lineHeight: 1.65 },
    narQ:     { fontFamily: serif, fontSize: "clamp(12px, 2.3vw, 14px)", color: "#5a7888", padding: "6px 0 6px 16px", borderBottom: `1px solid ${C.border}`, position: "relative", lineHeight: 1.5 },

    confBadge: level => ({
      display: "inline-flex", alignItems: "center", gap: 10, padding: "5px 14px",
      borderRadius: 2, marginBottom: 12, border: "1px solid",
      borderColor: level === "HIGH" ? "rgba(74,222,128,.3)" : level === "MEDIUM" ? "rgba(200,168,58,.3)" : "rgba(248,113,113,.3)",
      background:  level === "HIGH" ? "rgba(74,222,128,.05)" : level === "MEDIUM" ? "rgba(200,168,58,.05)" : "rgba(248,113,113,.05)",
    }),
    confLevel: level => ({ fontSize: 14, fontWeight: 600, letterSpacing: ".1em", color: level === "HIGH" ? C.bull : level === "MEDIUM" ? C.gold : C.bear }),
    confScore: { fontSize: 10, color: C.dim },
    confText:  { fontFamily: serif, fontSize: "clamp(13px, 2.5vw, 14px)", color: "#7a9aaa", lineHeight: 1.65, marginBottom: 12 },
    confSub:   { fontFamily: serif, fontSize: "clamp(11px, 2vw, 12px)", color: C.dim, lineHeight: 1.65, marginBottom: 12 },
    gapLabel:  { fontSize: 9, color: C.dim, letterSpacing: ".18em", textTransform: "uppercase", marginBottom: 7, marginTop: 4 },
    gapItem:   { fontSize: 10, color: C.dim, padding: "5px 0 5px 14px", borderBottom: `1px solid ${C.border}`, position: "relative", lineHeight: 1.45 },

    idle:   { textAlign: "center", padding: "52px 0", fontSize: 10, color: "#1a2a38", letterSpacing: ".2em" },
    footer: { marginTop: 52, fontSize: 9, color: "#1a2a38", letterSpacing: ".2em", textAlign: "center" },
  };

  // ── Step renderers ────────────────────────────────────────────────────────

  const renderEvidence = ({ evidence }) => (
    <>
      {evidence.map(ev => (
        <div key={ev.id} style={css.evItem}>
          <div style={css.evRow} onClick={() => toggleExpand(`ev-${ev.id}`)}>
            <span style={css.evLean(ev.lean)}>{ev.lean === 1 ? "▲" : ev.lean === -1 ? "▼" : "—"}</span>
            <span style={css.evText}>{ev.text}</span>
            <span style={css.evSource}>{ev.source}</span>
            <span style={css.evArrow}>{expanded.has(`ev-${ev.id}`) ? "▲" : "▼"}</span>
          </div>
          {expanded.has(`ev-${ev.id}`) && (
            <div style={css.evDetail}>
              <span style={css.evWhy}>WHY INCLUDED</span>
              <span style={css.evWhyTxt}>{ev.why_included}</span>
            </div>
          )}
        </div>
      ))}
    </>
  );

  const renderClassify = output => (
    <>
      <div style={css.clGrid}>
        {["bullish", "bearish", "neutral"].map(dir => (
          <div key={dir} style={css.clCol(dir)}>
            <div style={css.clHead(dir)}>{dir} ({(output[dir] || []).length})</div>
            {(output[dir] || []).map((item, i) => (
              <div key={i} style={css.clItem}>
                {item.text}
                {item.reason && <div style={css.clReason}>{item.reason}</div>}
              </div>
            ))}
          </div>
        ))}
      </div>
      {output.classifier_note && <div style={css.clNote}>→ {output.classifier_note}</div>}
    </>
  );

  const renderRank = output => (
    <>
      {output.ranked.map((item, i) => (
        <div key={i} style={css.rkItem}>
          <span style={css.rkNum}>#{item.rank}</span>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
              <span style={css.rkSignal}>{item.signal}</span>
              <span style={css.rkBadge(item.weight)}>{item.weight?.toUpperCase()}</span>
              <span style={css.rkDir(item.direction)}>{item.direction}</span>
            </div>
            {item.reasoning && <div style={css.rkReason}>{item.reasoning}</div>}
          </div>
        </div>
      ))}
      {output.methodology && <div style={css.rkMethod}>→ {output.methodology}</div>}
    </>
  );

  const renderNarrative = output => (
    <>
      <div>
        <div style={css.narLabel}>What happened</div>
        <div style={css.narText}>{output.what}</div>
      </div>
      <div>
        <div style={css.narLabel}>Why it matters</div>
        <div style={css.narText}>{output.why}</div>
      </div>
      <div style={css.narGrid}>
        <div style={css.narCard("bull")}>
          <div style={css.narCHead("bull")}>Bullish read</div>
          <div style={css.narCText}>{output.bull}</div>
        </div>
        <div style={css.narCard("bear")}>
          <div style={css.narCHead("bear")}>Bearish read</div>
          <div style={css.narCText}>{output.bear}</div>
        </div>
      </div>
      {output.questions?.length > 0 && (
        <div>
          <div style={{ ...css.narLabel, marginTop: 4 }}>Open questions</div>
          {output.questions.map((q, i) => (
            <div key={i} style={css.narQ}>
              <span style={{ position: "absolute", left: 0, color: C.dim, fontFamily: mono }}>→</span>
              {q}
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderConfidence = output => (
    <>
      <div style={css.confBadge(output.level)}>
        <span style={css.confLevel(output.level)}>{output.level}</span>
        <span style={css.confScore}>confidence · {output.score}/100</span>
      </div>
      <div style={css.confText}>{output.reasoning}</div>
      {output.data_quality && <div style={css.confSub}>{output.data_quality}</div>}
      {output.gaps?.length > 0 && (
        <>
          <div style={css.gapLabel}>Data gaps</div>
          {output.gaps.map((g, i) => (
            <div key={i} style={css.gapItem}>
              <span style={{ position: "absolute", left: 0, color: C.dim }}>·</span>{g}
            </div>
          ))}
        </>
      )}
    </>
  );

  const RENDERERS = { evidence: renderEvidence, classify: renderClassify, rank: renderRank, narrative: renderNarrative, confidence: renderConfidence };

  // ── Snapshot bar ──────────────────────────────────────────────────────────

  const renderSnapshot = () => {
    if (!ticker) return null;
    const d = SEED[ticker];
    return (
      <div style={css.snapBar}>
        {[
          { label: "Price",    val: fmt.p(d.price),           color: null },
          { label: "Change",   val: fmt.pct(d.change),        color: d.change >= 0 ? C.bull : C.bear },
          { label: "Rel Vol",  val: `${d.rel_vol}x`,          color: d.rel_vol > 1.5 ? C.accent : C.text },
          { label: "P/E",      val: String(d.pe),             color: null },
          { label: "RSI",      val: String(d.tech.rsi),       color: d.tech.rsi > 70 ? C.bear : d.tech.rsi < 30 ? C.bull : C.text },
          { label: "Analyst",  val: d.analyst.consensus,      color: C.accent },
          { label: "Target",   val: fmt.p(d.analyst.avg_target), color: null },
          { label: "Earnings", val: d.earnings.next,          color: C.gold },
        ].map(({ label, val, color }) => (
          <div key={label} style={css.snapItem}>
            <span style={css.snapLabel}>{label}</span>
            <span style={css.snapVal(color)}>{val}</span>
          </div>
        ))}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const anyVisible = running || Object.values(steps).some(s => s.status !== "idle");

  return (
    <div style={css.root}>
      <style>{`button:hover { filter: brightness(1.3); }`}</style>
      <div style={css.inner}>

        <div style={css.eyebrow}>Finviz · AI-Powered Market Intelligence</div>
        <div style={css.title}>FINVIZ <span style={css.titleAc}>INSIGHT</span></div>
        <div style={css.sub}>EVIDENCE · CLASSIFICATION · RANKING · NARRATIVE · CONFIDENCE</div>

        <div style={css.tickerGrid}>
          {["NVDA", "AAPL", "SPY", "META"].map(t => (
            <button key={t} style={css.tickerBtn(t)} onClick={() => selectTicker(t)}>{t}</button>
          ))}
        </div>

        {renderSnapshot()}

        {ticker && (
          <button style={css.runBtn} onClick={runPipeline} disabled={running}>
            {running ? "PIPELINE RUNNING ···" : `RUN ANALYSIS PIPELINE → ${ticker}`}
          </button>
        )}

        {!ticker && <div style={css.idle}>── SELECT A TICKER TO BEGIN ──</div>}

        {anyVisible && (
          <>
            <div style={css.pipeHead}>
              <span style={css.pipeDot(running)} />
              AGENTIC PIPELINE
              {running  && <span style={{ color: C.dim }}>— processing</span>}
              {!running && <span style={{ color: C.bull }}>— complete</span>}
            </div>

            {STEP_DEFS.map(({ id, num, label }) => {
              const { status, output } = steps[id] || { status: "idle", output: null };
              return (
                <div key={id} style={css.stepCard(status)}>
                  <div style={css.stepHdr(status)}>
                    <span style={css.stepNum}>{num}</span>
                    <span style={css.stepLabel(status)}>{label.toUpperCase()}</span>
                    <span style={css.stepStat(status)}>
                      {status === "running" ? "PROCESSING ···" :
                       status === "done"    ? "COMPLETE ✓"     :
                       status === "error"   ? "ERROR ✗"        : "PENDING"}
                    </span>
                  </div>
                  {status === "done" && output && (
                    <div style={css.stepBody}>{RENDERERS[id](output)}</div>
                  )}
                </div>
              );
            })}
          </>
        )}

        <div style={css.footer}>DATA VIA FINVIZ · ANALYSIS BY CLAUDE · AGENTIC PIPELINE DEMO</div>
      </div>
    </div>
  );
}
