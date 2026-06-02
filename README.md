# Finviz Insight

A Claude artifact demonstrating an agentic analysis pipeline for market data.

## What it does

Paste the JSX into a Claude artifact and select a ticker. Clicking **Run Analysis Pipeline** fires five sequential Claude API calls — each step's output feeds the next as context:

| Step | Agent call | Output |
|------|-----------|--------|
| 01 | Evidence Gathering | 6–9 extracted market signals with sourcing |
| 02 | Signal Classification | Signals bucketed into Bullish / Bearish / Neutral |
| 03 | Importance Ranking | Signals ranked by investor relevance with reasoning |
| 04 | Narrative Generation | What happened · Why it matters · Bull/Bear reads · Open questions |
| 05 | Confidence Review | Confidence level (HIGH/MEDIUM/LOW), score, data gaps |

Each evidence item in Step 01 is expandable — clicking **▼** reveals the model's reasoning for why that signal was included. This makes the pipeline's logic transparent and auditable.

## Demo tickers

Seed data is included for **NVDA, AAPL, SPY, META** covering price, volume, fundamentals, technicals, analyst consensus, earnings, and recent news headlines.

## How to run

1. Open [claude.ai](https://claude.ai) and start a new conversation
2. Create a new artifact and paste the contents of `FinvizInsight.jsx`
3. Select a ticker and click **Run Analysis Pipeline**

No API key required — Claude artifacts running inside claude.ai proxy calls to the Anthropic API transparently.

## Architecture

```
FinvizInsight.jsx
│
├── SEED — Finviz-style snapshot data for demo tickers
├── callClaude() — thin fetch wrapper, no auth header needed in artifact context
├── parseJSON() — strips markdown fences before JSON.parse
│
└── runPipeline()
    ├── Step 1: evidence    ← raw snapshot → structured evidence items
    ├── Step 2: classify    ← evidence     → bullish / bearish / neutral
    ├── Step 3: rank        ← classified   → ranked by importance
    ├── Step 4: narrative   ← ranked       → investor brief
    └── Step 5: confidence  ← full chain   → confidence score + gaps
```

Each step renders progressively as it completes. The pipeline state is tracked per step (`idle → running → done`), giving a live view of the agent's reasoning chain.

## Prompt assets

**Step 1 — Evidence Gathering**
> "From this Finviz snapshot, extract 6–9 distinct evidence items covering fundamentals, technicals, sentiment, and news."

**Step 2 — Signal Classification**
> "Classify these evidence items into bullish, bearish, and neutral groups with a reason for each classification."

**Step 3 — Importance Ranking**
> "Rank the top 5–7 signals by their importance to an investor thesis with methodology note."

**Step 4 — Narrative Generation**
> "Generate an investor narrative grounded in ranked signals — educational framing only, no buy/sell recommendations."

**Step 5 — Confidence Review**
> "Audit the full pipeline output: assign a confidence level, score, and list data gaps."

## Evaluation rubric

| Dimension | What to check |
|-----------|--------------|
| Grounding | Does Step 04 narrative cite signals from Steps 01–03? |
| Classification accuracy | Are signals categorized correctly given the seed data? |
| Ranking logic | Does the top-ranked signal reflect the most material factor? |
| Confidence calibration | Does a heavily one-sided signal set produce HIGH confidence? Mixed signals → MEDIUM? |
| Gap identification | Does Step 05 flag missing data (options flow, insider activity, sector rotation)? |

