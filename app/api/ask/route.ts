import { NextResponse } from "next/server";

type Asset = {
  id: number;
  name: string;
  symbol: string;
  cmc_rank: number;
  quote: {
    price: number;
    volume_24h: number;
    volume_change_24h: number;
    percent_change_1h: number;
    percent_change_24h: number;
    percent_change_7d: number;
    percent_change_30d?: number;
    percent_change_60d?: number;
    percent_change_90d?: number;
    market_cap: number;
    market_cap_dominance: number;
    last_updated?: string;
  }[];
  score?: number;
  reasons?: string[];
  metrics?: {
    volumeToCap: number;
    momentum24h: number;
    return1h: number;
    return7d: number;
    return30d: number | null;
    return60d: number | null;
    volumeChange: number;
    acceleration: number;
    movePercentile: number;
    accelerationPercentile: number;
    volumeChangePercentile: number;
    liquidityPercentile: number;
    baseScore: number;
    bonusScore: number;
  };
};

type AskRequest = {
  question: string;
  asset?: Asset;
  assets?: Asset[];
  anomalies?: Asset[];
};

function compactAsset(asset: Asset) {
  const q = asset.quote?.[0];

  if (!q) return null;

  return {
    symbol: asset.symbol,
    name: asset.name,
    rank: asset.cmc_rank,
    price: q.price,
    change1h: q.percent_change_1h,
    change24h: q.percent_change_24h,
    change7d: q.percent_change_7d,
    volume24h: q.volume_24h,
    volumeChange: q.volume_change_24h,
    marketCap: q.market_cap,
    dominance: q.market_cap_dominance,
    score: asset.score ?? null,
    reasons: asset.reasons ?? [],
    metrics: asset.metrics ?? null,
  };
}

function formatPercent(value: number | undefined) {
  return `${(value ?? 0).toFixed(2)}%`;
}

function formatCompactUsd(value: number | undefined) {
  const n = value ?? 0;

  if (n >= 1_000_000_000) {
    return `$${(n / 1_000_000_000).toFixed(2)}B`;
  }

  if (n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(2)}M`;
  }

  if (n >= 1_000) {
    return `$${(n / 1_000).toFixed(2)}K`;
  }

  return `$${n.toFixed(2)}`;
}

function percentileLabel(value: number | undefined) {
  return `${Math.round((value ?? 0) * 100)}th percentile`;
}

function buildMarketBrief(
  assets: Asset[],
  anomalies: Asset[]
) {
  const rows = anomalies
    .map(compactAsset)
    .filter(Boolean) as NonNullable<
    ReturnType<typeof compactAsset>
  >[];

  const top = rows.slice(0, 8);

  const lines = [
    `Assets scanned: ${assets.length}`,
    `Anomalies detected: ${rows.length}`,
    "",
    "DETERMINISTIC ANOMALY RESULTS:",
  ];

  top.forEach((asset, index) => {
    const m = asset.metrics;

    lines.push(
      `${index + 1}. ${asset.symbol} (${asset.name})`,
      `Score: ${asset.score}/100`,
      `CMC rank: #${asset.rank}`,
      `Price: ${formatCompactUsd(asset.price)}`,
      `24h change: ${formatPercent(asset.change24h)}`,
      `Volume change: ${formatPercent(asset.volumeChange)}`,
      `1h change: ${formatPercent(asset.change1h)}`,
      `7d change: ${formatPercent(asset.change7d)}`,
      `Volume/market cap: ${(m?.volumeToCap ?? 0).toFixed(4)}`,
      `24h move percentile: ${percentileLabel(m?.movePercentile)}`,
      `Volume-change percentile: ${percentileLabel(m?.volumeChangePercentile)}`,
      `1h percentile: ${percentileLabel(m?.accelerationPercentile)}`,
      `Activity percentile: ${percentileLabel(m?.liquidityPercentile)}`,
      `Base score: ${(m?.baseScore ?? 0).toFixed(1)}`,
      `Bonus score: +${(m?.bonusScore ?? 0).toFixed(1)}`,
      `Reasons: ${
        asset.reasons.length
          ? asset.reasons.join("; ")
          : "none supplied"
      }`,
      ""
    );
  });

  return lines.join("\n");
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AskRequest;

    if (!body.question?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Question is required",
        },
        { status: 400 }
      );
    }

    const assets = Array.isArray(body.assets)
      ? body.assets
      : body.asset
        ? [body.asset]
        : [];

    const anomalies = Array.isArray(body.anomalies)
      ? body.anomalies
      : [];

    if (!assets.length) {
      return NextResponse.json(
        {
          success: false,
          error: "No CMC market evidence was supplied.",
        },
        { status: 400 }
      );
    }

    const normalizedQuestion = body.question.toLowerCase();

    const isMarketQuestion =
      assets.length > 1 ||
      /market|crypto right now|unusual|anomal|volume|moving|activity/i.test(
        normalizedQuestion
      );

    const selectedAsset = body.asset
      ? compactAsset(body.asset)
      : null;

    let prompt: string;

    if (isMarketQuestion) {
      const marketBrief = buildMarketBrief(
        assets,
        anomalies
      );

      prompt = `
You are Market Detective.

You are a natural-language explanation layer.

A deterministic TypeScript anomaly engine has already analyzed the CoinMarketCap market snapshot.

Your job is ONLY to explain the supplied deterministic results.

Do NOT perform your own analysis.

Do NOT analyze the full asset universe.

Do NOT create a new ranking.

Do NOT calculate a new score.

Do NOT invent a reason.

Do NOT summarize arbitrary assets.

SOURCE OF TRUTH:
The deterministic anomaly report below.

STRICT RULES:

- Use only the supplied report.
- Never use outside knowledge.
- Never speculate about causes.
- Never predict future price direction.
- Never recommend buying, selling, or holding.
- Never claim buying dominated.
- Never claim selling dominated.
- Never claim investor demand.
- Never claim sentiment.
- Never claim whale activity.
- Never claim a catalyst.
- Never claim news or partnerships.
- Never claim ETF flows or macro causes.
- Never call an asset bullish or bearish.
- Never call an asset a winner or loser.
- Never describe volume increases as proof of buying or selling.
- Never say that volume proves demand.
- Never say that volume proves improved liquidity.

When a percentile is supplied, describe it as a relative position within the scanned market.

When a score is supplied, describe it as the anomaly engine's score.

ANSWER EXACTLY IN THIS STRUCTURE:

MARKET SNAPSHOT

State the number of assets scanned and anomalies detected.

WHAT STANDS OUT

Mention the highest-scoring supplied anomalies.

For each asset include:
- symbol
- anomaly score
- 24h change
- volume change

WHY THEY STAND OUT

Use ONLY the supplied reasons and percentile values.

WHAT THE DATA ESTABLISHES

State the direct quantitative observations.

WHAT THE DATA DOES NOT ESTABLISH

State that the supplied CMC data does not establish:
- cause
- catalyst
- buying versus selling dominance
- investor demand
- sentiment
- future price direction

Keep the answer under 180 words.

USER QUESTION:
${body.question}

DETERMINISTIC ANOMALY REPORT:
${marketBrief}
`;
    } else {
      prompt = `
You are Market Detective.

Explain the supplied CoinMarketCap evidence for the user's asset question.

Use ONLY the supplied evidence.

Never speculate about causes.
Never predict future price direction.
Never recommend buying, selling, or holding.
Never claim buying or selling dominance.
Never claim investor demand.
Never claim sentiment.
Never claim a catalyst.
Never claim news or external events.

A volume increase establishes only that reported trading volume increased.

Use this exact structure:

WHAT THE DATA SHOWS

WHY IT STANDS OUT

WHAT WE CAN INFER

WHAT WE CANNOT ESTABLISH

Keep the answer under 160 words.

USER QUESTION:
${body.question}

CMC EVIDENCE:
${JSON.stringify(selectedAsset, null, 2)}
`;
    }

    const response = await fetch(
      "http://localhost:11434/api/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "qwen3:1.7b",
          prompt,
          stream: false,
          think: false,
          options: {
            temperature: 0,
            num_predict: 300,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          success: false,
          error: `Ollama request failed: ${errorText}`,
        },
        { status: 502 }
      );
    }

    const result = await response.json();

    if (!result.response) {
      return NextResponse.json(
        {
          success: false,
          error: "Ollama returned an empty response",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      answer: result.response.trim(),
      source:
        "CoinMarketCap deterministic anomaly evidence + local Ollama model",
      model: "qwen3:1.7b",
      evidenceGrounded: true,
      scope: isMarketQuestion ? "market" : "asset",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AI investigation failed",
      },
      { status: 500 }
    );
  }
}
