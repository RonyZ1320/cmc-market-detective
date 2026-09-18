import { NextResponse } from "next/server";

type Quote = {
  price: number;
  volume_24h: number;
  volume_change_24h: number;
  percent_change_1h: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_30d?: number;
  percent_change_60d?: number;
  market_cap: number;
  market_cap_dominance: number;
  last_updated?: string;
};

type Asset = {
  id: number;
  name: string;
  symbol: string;
  cmc_rank: number;
  quote: Quote[];
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

function avg(values: number[]) {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function fmt(value: number | null, digits = 2) {
  return value !== null && Number.isFinite(value)
    ? value.toFixed(digits)
    : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const asset = body.asset as Asset;
    const assets = Array.isArray(body.assets)
      ? (body.assets as Asset[])
      : [];

    if (!asset?.quote?.[0]) {
      return NextResponse.json(
        {
          success: false,
          error: "Asset data is required",
        },
        { status: 400 }
      );
    }

    const q = asset.quote[0];

    const universe = assets.filter(
      (item) => item?.quote?.[0]
    );

    const btc = universe.find(
      (item) => item.symbol?.toUpperCase() === "BTC"
    );

    const eth = universe.find(
      (item) => item.symbol?.toUpperCase() === "ETH"
    );

    const marketReturns = universe
      .map((item) => item.quote[0].percent_change_24h)
      .filter(finite);

    const marketVolumeChanges = universe
      .map((item) => item.quote[0].volume_change_24h)
      .filter(finite);

    const marketAvg24h = avg(marketReturns);

    const marketAvgVolumeChange = avg(
      marketVolumeChanges
    );

    const btc24h = btc?.quote?.[0]?.percent_change_24h ?? null;
    const eth24h = eth?.quote?.[0]?.percent_change_24h ?? null;

    const relativeToMarket =
      marketAvg24h === null
        ? null
        : q.percent_change_24h - marketAvg24h;

    const relativeToBTC =
      btc24h === null
        ? null
        : q.percent_change_24h - btc24h;

    const relativeToETH =
      eth24h === null
        ? null
        : q.percent_change_24h - eth24h;

    const direction =
      q.percent_change_24h >= 0
        ? "positive"
        : "negative";

    const volumeDirection =
      q.volume_change_24h >= 0
        ? "increased"
        : "decreased";

    const conclusionParts = [
      `${asset.name} (${asset.symbol}) is showing a ${direction} 24h move of ${fmt(q.percent_change_24h)}%, while 24h volume ${volumeDirection} ${fmt(Math.abs(q.volume_change_24h))}%.`,
    ];

    if (
      relativeToMarket !== null &&
      marketAvg24h !== null
    ) {
      conclusionParts.push(
        `Its 24h return is ${fmt(Math.abs(relativeToMarket))} percentage points ${relativeToMarket >= 0 ? "above" : "below"} the average return of the ${universe.length}-asset CMC snapshot.`
      );
    }

    if (relativeToBTC !== null) {
      conclusionParts.push(
        `Relative to BTC, the difference is ${fmt(Math.abs(relativeToBTC))} percentage points ${relativeToBTC >= 0 ? "higher" : "lower"}.`
      );
    }

    if (relativeToETH !== null) {
      conclusionParts.push(
        `Relative to ETH, the difference is ${fmt(Math.abs(relativeToETH))} percentage points ${relativeToETH >= 0 ? "higher" : "lower"}.`
      );
    }

    const marketSnapshot = {
      price: q.price,
      percent_change_1h: q.percent_change_1h,
      percent_change_24h: q.percent_change_24h,
      percent_change_7d: q.percent_change_7d,
      percent_change_30d:
        q.percent_change_30d ?? null,
      percent_change_60d:
        q.percent_change_60d ?? null,
      volume_24h: q.volume_24h,
      volume_change_24h: q.volume_change_24h,
      market_cap: q.market_cap,
      market_cap_dominance:
        q.market_cap_dominance,
      volume_to_cap:
        q.volume_24h / Math.max(q.market_cap, 1),
      last_updated: q.last_updated ?? null,
    };

    let aiExplanation = "";

    try {
      const ollamaResponse = await fetch(
        "http://localhost:11434/api/generate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "qwen3:1.7b",
            stream: false,
            think: false,
            options: {
              temperature: 0,
            },
            prompt: `Explain why ${asset.name} (${asset.symbol}) is statistically unusual using ONLY these facts:

24h return: ${q.percent_change_24h.toFixed(2)}%
24h volume change: ${q.volume_change_24h.toFixed(2)}%
1h return: ${q.percent_change_1h.toFixed(2)}%
7d return: ${q.percent_change_7d.toFixed(2)}%
Anomaly score: ${asset.score ?? "N/A"}/100
24h move percentile: ${asset.metrics?.movePercentile != null ? Math.round(asset.metrics.movePercentile * 100) + "th" : "N/A"}
Volume change percentile: ${asset.metrics?.volumeChangePercentile != null ? Math.round(asset.metrics.volumeChangePercentile * 100) + "th" : "N/A"}
1h acceleration percentile: ${asset.metrics?.accelerationPercentile != null ? Math.round(asset.metrics.accelerationPercentile * 100) + "th" : "N/A"}
Relative to BTC: ${relativeToBTC != null ? relativeToBTC.toFixed(2) : "N/A"} percentage points
Relative to ETH: ${relativeToETH != null ? relativeToETH.toFixed(2) : "N/A"} percentage points
Relative to market average: ${relativeToMarket != null ? relativeToMarket.toFixed(2) : "N/A"} percentage points

Do not invent news, catalysts, causes, investor behavior, accumulation, or market reactions.
Do not infer a trend or explain why a move happened unless the supplied evidence directly establishes it.
If two timeframes differ, describe the difference without explaining its cause.
Do not predict price or give trading advice.
Write 2 concise paragraphs focused on the strongest measured evidence.`,
          }),
        }
      );

      if (ollamaResponse.ok) {
        const aiResult = await ollamaResponse.json();

        if (typeof aiResult.response === "string") {
          aiExplanation = aiResult.response.trim();
        }
      }
    } catch (error) {
      console.warn("Ollama explanation unavailable:", error);
    }

    return NextResponse.json({
      success: true,

      asset: {
        id: asset.id,
        name: asset.name,
        symbol: asset.symbol,
        cmc_rank: asset.cmc_rank,
      },

      market_snapshot: marketSnapshot,

      anomaly: {
        score: asset.score ?? null,
        reasons: asset.reasons ?? [],
        metrics: asset.metrics ?? null,
      },

      comparison: {
        universe_size: universe.length,
        btc_24h: btc24h,
        eth_24h: eth24h,
        market_average_24h: marketAvg24h,
        market_average_volume_change_24h:
          marketAvgVolumeChange,
        relative_to_btc: relativeToBTC,
        relative_to_eth: relativeToETH,
        relative_to_market: relativeToMarket,
      },

      request: {
        method: "POST",
        endpoint: "/api/investigate",
        params: {
          asset: asset.symbol,
          universe_size: universe.length,
        },
      },

      evidence: {
        asset: {
          name: asset.name,
          symbol: asset.symbol,
          rank: asset.cmc_rank,
        },

        snapshot: marketSnapshot,

        comparison: {
          universeSize: universe.length,
          btc24h,
          eth24h,
          marketAverage24h: marketAvg24h,
          marketAverageVolumeChange24h:
            marketAvgVolumeChange,
          relativeToBTC,
          relativeToETH,
          relativeToMarket,
        },

        anomaly: {
          score: asset.score ?? null,
          reasons: asset.reasons ?? [],
          metrics: asset.metrics ?? null,
        },
      },

      conclusion: conclusionParts.join(" "),

      ai_explanation: aiExplanation || null,


      investigation: {
        question: `Why is ${asset.name} (${asset.symbol}) unusual right now?`,
        finding: {
          direction,
          return24h: q.percent_change_24h,
          volumeChange24h: q.volume_change_24h,
          return1h: q.percent_change_1h,
          return7d: q.percent_change_7d,
        },
        relativePerformance: {
          vsBTC: relativeToBTC,
          vsETH: relativeToETH,
          vsMarket: relativeToMarket,
          marketAverage24h: marketAvg24h,
        },
        activity: {
          volume24h: q.volume_24h,
          volumeToMarketCap:
            q.volume_24h / Math.max(q.market_cap, 1),
          volumeChange24h: q.volume_change_24h,
        },
        anomalySignals: {
          score: asset.score ?? null,
          reasons: asset.reasons ?? [],
          movePercentile:
            asset.metrics?.movePercentile ?? null,
          volumeChangePercentile:
            asset.metrics?.volumeChangePercentile ?? null,
          accelerationPercentile:
            asset.metrics?.accelerationPercentile ?? null,
          liquidityPercentile:
            asset.metrics?.liquidityPercentile ?? null,
          baseScore:
            asset.metrics?.baseScore ?? null,
          bonusScore:
            asset.metrics?.bonusScore ?? null,
        },
        evidence: [
          "CoinMarketCap latest listings snapshot",
          "24h price-change percentile across the scanned universe",
          "24h volume-change percentile across the scanned universe",
          "1h acceleration percentile across the scanned universe",
          "volume-to-market-cap activity percentile",
          "relative performance versus BTC, ETH and the market average",
        ],
      },

      source:
        "CoinMarketCap market snapshot + deterministic comparison engine",
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      { status: 500 }
    );
  }
}
