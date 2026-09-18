"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  ChevronRight,
  Clock3,
  Database,
  Eye,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";

type Quote = {
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
};

type Asset = {
  id: number;
  name: string;
  symbol: string;
  cmc_rank: number;
  quote: Quote[];
};

type Anomaly = Asset & {
  score: number;
  reasons: string[];
  metrics: {
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

type MarketResponse = {
  success: boolean;
  count: number;
  data: Asset[];
  anomalies: Anomaly[];
  status: {
    credit_count: number;
    timestamp?: string;
  };
  request: {
    method: string;
    endpoint: string;
    params: {
      start: number;
      limit: number;
      convert: string;
    };
  };
};

type Investigation = {
  source: string;
  request: {
    method: string;
    endpoint: string;
    params: Record<string, string | number>;
  };
  asset: {
    id: number;
    name: string;
    symbol: string;
    cmc_rank: number;
  };
  market_snapshot: Quote;
  detection: Anomaly["metrics"] & {
    score?: number;
    reasons?: string[];
    metrics?: Anomaly["metrics"];
  };
  conclusion: string;
  ai_explanation?: string | null;
  comparison?: {
    btc_24h: number;
    eth_24h: number;
    market_average_24h: number;
    universe_size: number;
    relative_to_btc: number;
    relative_to_eth: number;
    relative_to_market: number;
  };
};

function formatPrice(value: number) {
  if (value >= 1000) {
    return `$${value.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}`;
  }

  if (value >= 1) {
    return `$${value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })}`;
  }

  return `$${value.toLocaleString(undefined, {
    maximumFractionDigits: 6,
  })}`;
}

function formatCompact(value: number) {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }

  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`;
  }

  return `$${value.toFixed(0)}`;
}

function changeColor(value: number) {
  return value >= 0 ? "text-emerald-400" : "text-rose-400";
}

function ScoreBadge({ score }: { score: number }) {
  const severity =
    score >= 90
      ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
      : score >= 75
        ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
        : "bg-cyan-500/10 text-cyan-300 border-cyan-500/20";

  return (
    <div
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-sm font-bold ${severity}`}
    >
      {score}
    </div>
  );
}

export default function Home() {
  const [market, setMarket] = useState<MarketResponse | null>(null);
  const [selected, setSelected] = useState<Anomaly | null>(null);
  const [investigation, setInvestigation] =
    useState<Investigation | null>(null);
  const [loading, setLoading] = useState(true);
  const [investigating, setInvestigating] = useState(false);
  const [query, setQuery] = useState("");
  const [investigationError, setInvestigationError] = useState("");
  const [similarSetups, setSimilarSetups] = useState<any>(null);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  async function loadMarket() {
    setLoading(true);

    try {
      const response = await fetch("/api/market", {
        cache: "no-store",
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Market request failed");
      }

      setMarket(result);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function findSimilarSetups(asset: Anomaly) {
    const currentMarket = market;

    if (!currentMarket) {
      setSimilarSetups({
        success: false,
        error: "Market data is not loaded yet.",
      });
      return;
    }

    setSimilarLoading(true);
    setSimilarSetups(null);

    try {
      const response = await fetch("/api/similar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          asset,
          assets: currentMarket.data,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Similarity search failed");
      }

      setSimilarSetups(result);
    } catch (error) {
      console.error(error);
      setSimilarSetups({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Similarity search failed",
      });
    } finally {
      setSimilarLoading(false);
    }
  }

  async function investigate(asset: Anomaly) {
    if (!market) {
      setInvestigationError("Market data is not loaded yet.");
      return;
    }

    setSelected(asset);
    setInvestigation(null);
    setInvestigationError("");
    setInvestigating(true);

    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          asset,
          assets: market.data,
          anomalies: market.anomalies,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Investigation failed");
      }

      setInvestigation(result);

      setTimeout(() => {
        document
          .getElementById("investigation-panel")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      }, 100);
    } catch (error) {
      console.error(error);
      setInvestigationError(
        error instanceof Error
          ? error.message
          : "Investigation failed"
      );
    } finally {
      setInvestigating(false);
    }
  }

  async function askDetective() {
    const question = query.trim();

    if (!question || !market) return;

    setAiLoading(true);
    setAiAnswer("");
    setAiError("");

    try {
      const normalized = question.toLowerCase();

      const asset =
        market.data.find(
          (item) =>
            normalized.includes(item.symbol.toLowerCase()) ||
            normalized.includes(item.name.toLowerCase())
        ) ?? selected;

      const response = await fetch("/api/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          asset,
          assets: market.data,
          anomalies: market.anomalies,
          market: {
            count: market.count,
            status: market.status,
          },
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "AI investigation failed");
      }

      setAiAnswer(result.answer);

      setTimeout(() => {
        document
          .getElementById("ai-answer")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      }, 100);
    } catch (error) {
      console.error(error);

      setAiError(
        error instanceof Error
          ? error.message
          : "AI investigation failed"
      );
    } finally {
      setAiLoading(false);
    }
  }

  useEffect(() => {
    loadMarket();
  }, []);

  const filteredAnomalies = useMemo(() => {
    if (!market) return [];

    const normalized = query.trim().toLowerCase();

    if (!normalized) return market.anomalies;

    return market.anomalies.filter(
      (asset) =>
        asset.name.toLowerCase().includes(normalized) ||
        asset.symbol.toLowerCase().includes(normalized)
    );
  }, [market, query]);

  const topMarket = market?.data.slice(0, 8) ?? [];

  return (
    <main className="min-h-screen bg-[#06080c] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-300px] h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-cyan-500/[0.035] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/[0.06] px-3 py-1.5 text-[11px] font-semibold tracking-[0.22em] text-cyan-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
                  COINMARKETCAP × AI
                </div>

                <div className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-medium text-zinc-500">
                  MARKET INTELLIGENCE
                </div>
              </div>

              <h1 className="text-4xl font-bold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
                Market Detective
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-500 sm:text-base">
                An AI market investigator that scans CoinMarketCap data,
                detects unusual moves, and shows the evidence behind every
                conclusion.
              </p>
            </div>

            <button
              onClick={loadMarket}
              disabled={loading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-5 text-sm font-semibold text-zinc-200 transition hover:border-cyan-400/30 hover:bg-cyan-400/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh Market
            </button>
          </div>
        </header>

        {/* Stats */}
        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Assets Scanned"
            value={market ? String(market.count) : "—"}
            icon={<Database className="h-4 w-4" />}
          />

          <StatCard
            label="Anomalies"
            value={market ? String(market.anomalies.length) : "—"}
            icon={<AlertTriangle className="h-4 w-4" />}
          />

          <StatCard
            label="Top Asset"
            value={market?.data[0]?.symbol ?? "—"}
            icon={<Activity className="h-4 w-4" />}
          />

          <StatCard
            label="API Credits"
            value={
              market ? String(market.status.credit_count) : "—"
            }
            icon={<Terminal className="h-4 w-4" />}
          />
        </section>

        {/* Main grid */}
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(350px,0.8fr)]">
          {/* Anomalies */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.018]">
            <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-bold text-zinc-100">
                    Detected anomalies
                  </h2>
                </div>

                <p className="mt-1 text-xs text-zinc-600">
                  Signals derived from the live CMC market snapshot.
                </p>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                LIVE SNAPSHOT
              </div>
            </div>

            <div>
              {loading ? (
                <div className="space-y-px">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="h-[92px] animate-pulse border-b border-white/[0.05] bg-white/[0.01]"
                    />
                  ))}
                </div>
              ) : filteredAnomalies.length === 0 ? (
                <div className="p-10 text-center text-sm text-zinc-600">
                  No matching anomalies.
                </div>
              ) : (
                filteredAnomalies.map((asset) => {
                  const q = asset.quote[0];
                  const active = selected?.id === asset.id;

                  return (
                    <button
                      key={asset.id}
                      onClick={() => investigate(asset)}
                      className={`group flex w-full items-center gap-4 border-b border-white/[0.05] p-4 text-left transition last:border-b-0 ${
                        active
                          ? "bg-cyan-400/[0.055]"
                          : "hover:bg-white/[0.025]"
                      }`}
                    >
                      <ScoreBadge score={asset.score} />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-zinc-100">
                            #{asset.cmc_rank} {asset.name}
                          </span>
                          <span className="text-xs font-medium text-zinc-600">
                            {asset.symbol}
                          </span>
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-zinc-600">
                          {asset.reasons.slice(0, 3).map((reason) => (
                            <span key={reason}>{reason}</span>
                          ))}
                        </div>
                      </div>

                      <div className="hidden shrink-0 text-right sm:block">
                        <div
                          className={`flex items-center justify-end gap-1 text-sm font-bold ${changeColor(
                            q.percent_change_24h
                          )}`}
                        >
                          {q.percent_change_24h >= 0 ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          {q.percent_change_24h >= 0 ? "+" : ""}
                          {q.percent_change_24h.toFixed(2)}%
                        </div>

                        <div className="mt-1 text-[10px] uppercase tracking-wider text-zinc-600">
                          anomaly score
                        </div>
                      </div>

                      <ChevronRight
                        className={`h-4 w-4 shrink-0 transition ${
                          active
                            ? "translate-x-1 text-cyan-400"
                            : "text-zinc-700 group-hover:text-zinc-400"
                        }`}
                      />
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Detective panel */}
          <aside className="rounded-2xl border border-white/[0.08] bg-white/[0.018]">
            <div className="border-b border-white/[0.07] p-5">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-cyan-400" />
                <h2 className="text-sm font-bold">Ask Detective</h2>
              </div>

              <p className="mt-1 text-xs text-zinc-600">
                Search the detected market signals.
              </p>

              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />

                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      askDetective();
                    }
                  }}
                  placeholder="Why is SOL moving?"
                  className="h-11 w-full rounded-xl border border-white/[0.08] bg-black/20 pl-10 pr-10 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-700 focus:border-cyan-400/30"
                />

                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <button
                onClick={askDetective}
                disabled={!query.trim() || aiLoading || !market}
                className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 text-xs font-bold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {aiLoading ? "Investigating..." : "Ask Detective"}
              </button>
            </div>

            <div className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                  Top market
                </span>

                <span className="text-[10px] text-zinc-700">
                  CMC RANK
                </span>
              </div>

              <div className="space-y-2">
                {topMarket.map((asset) => {
                  const q = asset.quote[0];

                  return (
                    <div
                      key={asset.id}
                      className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.025] px-3.5 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="w-5 text-[10px] text-zinc-700">
                          {asset.cmc_rank}
                        </span>

                        <div className="min-w-0">
                          <div className="text-xs font-bold text-zinc-200">
                            {asset.symbol}
                          </div>
                          <div className="truncate text-[10px] text-zinc-600">
                            {formatPrice(q.price)}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-xs font-semibold ${changeColor(
                          q.percent_change_24h
                        )}`}
                      >
                        {q.percent_change_24h >= 0 ? "+" : ""}
                        {q.percent_change_24h.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-white/[0.07] p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Evidence-first analysis
              </div>

              <p className="mt-2 text-xs leading-5 text-zinc-600">
                Every investigation exposes the CMC endpoint, market
                snapshot, detection signals, and conclusion.
              </p>
            </div>
          </aside>
        </section>

        {/* Investigation */}
        {selected && (
          <section
            id="investigation-panel"
            className="mt-6 scroll-mt-6 overflow-hidden rounded-2xl border border-cyan-400/10 bg-white/[0.018]">
            <div className="flex flex-col gap-5 border-b border-white/[0.07] p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-cyan-400">
                  <Eye className="h-3.5 w-3.5" />
                  Active investigation
                </div>

                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold tracking-tight">
                    {selected.name}
                  </h2>

                  <span className="text-sm text-zinc-600">
                    {selected.symbol}
                  </span>
                </div>

                <p className="mt-1 text-xs text-zinc-600">
                  CoinMarketCap rank #{selected.cmc_rank} · anomaly score{" "}
                  {selected.score}/100
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3 text-right">
                  <div
                    className={`text-xl font-bold ${changeColor(
                      selected.quote[0].percent_change_24h
                    )}`}
                  >
                    {selected.quote[0].percent_change_24h >= 0
                      ? "+"
                      : ""}
                    {selected.quote[0].percent_change_24h.toFixed(2)}%
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                    24h move
                  </div>
                </div>

                <ScoreBadge score={selected.score} />
              </div>
            </div>

            {investigating ? (
              <div className="flex min-h-[300px] items-center justify-center p-10">
                <div className="text-center">
                  <Sparkles className="mx-auto h-6 w-6 animate-pulse text-cyan-400" />
                  <p className="mt-3 text-sm font-semibold text-zinc-300">
                    Building evidence chain...
                  </p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Normalizing the CMC market snapshot.
                  </p>
                </div>
              </div>
            ) : investigation ? (
              <div className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
                {/* Evidence chain */}
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-cyan-400" />
                    <h3 className="text-sm font-bold">
                      Evidence Chain
                    </h3>
                  </div>

                  <div className="space-y-3">
                    <EvidenceStep
                      number="01"
                      title="CMC market snapshot"
                      description="Live market data retrieved from CoinMarketCap."
                    >
                      <code className="text-[11px] text-cyan-300">
                        GET /v3/cryptocurrency/listings/latest
                      </code>
                    </EvidenceStep>

                    <EvidenceStep
                      number="02"
                      title="CMC API request parameters"
                      description="The exact query configuration used by Market Detective."
                    >
                      <pre className="overflow-x-auto rounded-lg border border-white/[0.06] bg-black/30 p-3 text-[10px] leading-5 text-zinc-500">
{JSON.stringify(
  {
    start: 1,
    limit: 100,
    convert: "USD",
  },
  null,
  2
)}
                      </pre>
                    </EvidenceStep>

                    <EvidenceStep
                      number="03"
                      title="Normalized market evidence"
                      description="Values used by the anomaly engine."
                    >
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Metric label="Price" value={formatPrice(investigation.market_snapshot.price)} />
                        <Metric
                          label="1h"
                          value={`${investigation.market_snapshot.percent_change_1h.toFixed(2)}%`}
                        />
                        <Metric
                          label="24h"
                          value={`${investigation.market_snapshot.percent_change_24h.toFixed(2)}%`}
                        />
                        <Metric
                          label="7d"
                          value={`${investigation.market_snapshot.percent_change_7d.toFixed(2)}%`}
                        />
                        <Metric
                          label="Volume"
                          value={formatCompact(investigation.market_snapshot.volume_24h)}
                        />
                        <Metric
                          label="Vol Δ"
                          value={`${investigation.market_snapshot.volume_change_24h.toFixed(2)}%`}
                        />
                        <Metric
                          label="Market Cap"
                          value={formatCompact(investigation.market_snapshot.market_cap)}
                        />
                        <Metric
                          label="Dominance"
                          value={`${investigation.market_snapshot.market_cap_dominance.toFixed(2)}%`}
                        />
                      </div>
                    </EvidenceStep>

                    <EvidenceStep
                      number="04"
                      title="Detection signals"
                      description="Quantitative signals used to classify the asset as unusual."
                    >
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <Metric
                          label="24h move percentile"
                          value={`${Math.round(
                            selected.metrics.movePercentile * 100
                          )}th`}
                        />

                        <Metric
                          label="Volume percentile"
                          value={`${Math.round(
                            selected.metrics.volumeChangePercentile * 100
                          )}th`}
                        />

                        <Metric
                          label="1h percentile"
                          value={`${Math.round(
                            selected.metrics.accelerationPercentile * 100
                          )}th`}
                        />

                        <Metric
                          label="Activity percentile"
                          value={`${Math.round(
                            selected.metrics.liquidityPercentile * 100
                          )}th`}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <Metric
                          label="Base score"
                          value={selected.metrics.baseScore.toFixed(1)}
                        />

                        <Metric
                          label="Bonus score"
                          value={`+${selected.metrics.bonusScore.toFixed(1)}`}
                        />

                        <Metric
                          label="Final score"
                          value={`${selected.score}/100`}
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {selected.reasons.map((reason) => (
                          <span
                            key={reason}
                            className="rounded-lg border border-amber-400/10 bg-amber-400/[0.04] px-2.5 py-1.5 text-[10px] text-amber-300"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </EvidenceStep>
                  </div>
                </div>

                {/* Analyst conclusion */}
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-cyan-400" />
                    <h3 className="text-sm font-bold">
                      Detective conclusion
                    </h3>
                  </div>

                  <div className="rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.025] p-5">
                    <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-400">
                      <Sparkles className="h-3.5 w-3.5" />
                      Evidence-backed finding
                    </div>

                    <p className="text-sm leading-7 text-zinc-300">
                      {investigation.conclusion}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Metric
                      label="Volume / Cap"
                      value={selected.metrics.volumeToCap.toFixed(4)}
                    />
                    <Metric
                      label="Momentum"
                      value={`${selected.metrics.momentum24h.toFixed(2)}%`}
                    />
                    <Metric
                      label="Acceleration"
                      value={`${selected.metrics.acceleration.toFixed(2)}%`}
                    />
                    <Metric
                      label="Detection Score"
                      value={`${selected.score}/100`}
                    />
                  </div>

                  {/* AI detective explanation */}
                  {investigation.ai_explanation && (
                    <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/10 text-cyan-300">
                          ✦
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            Detective Explanation
                          </h3>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            Ollama analysis grounded only in the measured evidence.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-300">
                        {investigation.ai_explanation}
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                        Local AI · Qwen 3 1.7B · Evidence constrained
                      </div>
                    </div>
                  )}

                  {/* 06 — Similar setups */}
                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-white">
                          Find similar setups
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Compare this asset against the live CMC market snapshot.
                        </p>
                      </div>

                      <button
                        onClick={() => findSimilarSetups(selected)}
                        disabled={similarLoading}
                        className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {similarLoading ? "Scanning..." : "Find Similar"}
                      </button>
                    </div>

                    {similarSetups?.error && (
                      <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/5 p-3 text-xs text-red-300">
                        {similarSetups.error}
                      </div>
                    )}

                    {similarSetups?.matches?.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {similarSetups.matches.map((match: any) => (
                          <div
                            key={match.id}
                            className="rounded-xl border border-white/8 bg-black/20 p-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-white">
                                  {match.name}{" "}
                                  <span className="text-slate-500">
                                    ${match.symbol}
                                  </span>
                                </div>

                                <div className="mt-1 flex flex-wrap gap-2">
                                  {match.reasons?.map((reason: string) => (
                                    <span
                                      key={reason}
                                      className="rounded-full bg-white/5 px-2 py-1 text-[10px] text-slate-400"
                                    >
                                      {reason}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="text-right">
                                <div className="text-lg font-bold text-cyan-300">
                                  {match.similarity}%
                                </div>
                                <div className="text-[10px] uppercase tracking-wider text-slate-600">
                                  similarity
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                              <Metric
                                label="24h"
                                value={`${match.comparison.return24h.toFixed(2)}%`}
                              />
                              <Metric
                                label="Vol Δ"
                                value={`${match.comparison.volumeChange24h.toFixed(2)}%`}
                              />
                              <Metric
                                label="1h"
                                value={`${match.comparison.return1h.toFixed(2)}%`}
                              />
                              <Metric
                                label="7d"
                                value={`${match.comparison.return7d.toFixed(2)}%`}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {similarSetups?.success &&
                      similarSetups.matches?.length === 0 && (
                        <div className="mt-4 text-xs text-slate-500">
                          No comparable setups found in the current market snapshot.
                        </div>
                      )}
                  </div>

                  {/* 05 — Relative market context */}
                  <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/20 p-5">
                    <div className="mb-4 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-cyan-400/10 bg-cyan-400/[0.05] font-mono text-[9px] font-bold text-cyan-400">
                        05
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">
                          Relative market context
                        </div>
                        <div className="mt-1 text-[10px] text-zinc-600">
                          Performance compared with BTC, ETH and the scanned CMC universe.
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Metric
                        label="BTC 24h"
                        value={
                          investigation.comparison?.btc_24h != null
                            ? `${investigation.comparison.btc_24h.toFixed(2)}%`
                            : "—"
                        }
                      />

                      <Metric
                        label="ETH 24h"
                        value={
                          investigation.comparison?.eth_24h != null
                            ? `${investigation.comparison.eth_24h.toFixed(2)}%`
                            : "—"
                        }
                      />

                      <Metric
                        label="Market Avg"
                        value={
                          investigation.comparison?.market_average_24h != null
                            ? `${investigation.comparison.market_average_24h.toFixed(2)}%`
                            : "—"
                        }
                      />

                      <Metric
                        label="Universe"
                        value={
                          investigation.comparison?.universe_size != null
                            ? `${investigation.comparison.universe_size} assets`
                            : "—"
                        }
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
                        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                          vs BTC
                        </div>
                        <div className="mt-1 font-mono text-sm font-bold text-zinc-200">
                          {investigation.comparison?.relative_to_btc != null
                            ? `${investigation.comparison.relative_to_btc >= 0 ? "+" : ""}${investigation.comparison.relative_to_btc.toFixed(2)} pp`
                            : "—"}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
                        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                          vs ETH
                        </div>
                        <div className="mt-1 font-mono text-sm font-bold text-zinc-200">
                          {investigation.comparison?.relative_to_eth != null
                            ? `${investigation.comparison.relative_to_eth >= 0 ? "+" : ""}${investigation.comparison.relative_to_eth.toFixed(2)} pp`
                            : "—"}
                        </div>
                      </div>

                      <div className="rounded-xl border border-white/[0.05] bg-white/[0.015] p-3">
                        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                          vs Market
                        </div>
                        <div className="mt-1 font-mono text-sm font-bold text-zinc-200">
                          {investigation.comparison?.relative_to_market != null
                            ? `${investigation.comparison.relative_to_market >= 0 ? "+" : ""}${investigation.comparison.relative_to_market.toFixed(2)} pp`
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-600">
                      <Clock3 className="h-3.5 w-3.5" />
                      08 · CMC Data timestamp
                    </div>

                    <p className="mt-2 font-mono text-[11px] text-zinc-500">
                      {investigation.market_snapshot.last_updated ??
                        "CMC timestamp unavailable"}
                    </p>
                  </div>
                </div>
              </div>
            ) : investigationError ? (
              <div className="p-6">
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-rose-300">
                    <AlertTriangle className="h-4 w-4" />
                    Investigation failed
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    {investigationError}
                  </p>
                </div>
              </div>
            ) : null}
          </section>
        )}

        {/* AI answer */}
        {(aiLoading || aiAnswer || aiError) && (
          <section
            id="ai-answer"
            className="mt-6 overflow-hidden rounded-2xl border border-cyan-400/10 bg-cyan-400/[0.018]"
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-5">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-cyan-400" />
                  <h2 className="text-sm font-bold">
                    AI Market Investigation
                  </h2>
                </div>

                <p className="mt-1 text-xs text-zinc-600">
                  Grounded exclusively in the supplied CoinMarketCap evidence.
                </p>
              </div>

              <div className="rounded-full border border-cyan-400/10 bg-cyan-400/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                Evidence grounded
              </div>
            </div>

            <div className="p-6">
              {aiLoading ? (
                <div className="flex items-center gap-3 py-8 text-sm text-zinc-500">
                  <Sparkles className="h-5 w-5 animate-pulse text-cyan-400" />
                  Detective is analyzing the CMC evidence...
                </div>
              ) : aiError ? (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.04] p-4 text-sm text-rose-300">
                  {aiError}
                </div>
              ) : (
                <div className="max-w-4xl">
                  <div className="whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                    {aiAnswer}
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    <span className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-1.5 text-[10px] text-zinc-500">
                      Source: CoinMarketCap
                    </span>

                    <span className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-1.5 text-[10px] text-zinc-500">
                      External catalysts not assumed
                    </span>

                    <span className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-1.5 text-[10px] text-zinc-500">
                      Evidence-first reasoning
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="mt-8 flex flex-col gap-2 border-t border-white/[0.05] pt-5 text-[10px] text-zinc-700 sm:flex-row sm:items-center sm:justify-between">
          <span>CMC MARKET DETECTIVE · AI MARKET INTELLIGENCE</span>

          <span>
            Source: CoinMarketCap API · API key redacted
          </span>
        </footer>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.018] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">
          {label}
        </span>

        <span className="text-zinc-700">{icon}</span>
      </div>

      <div className="mt-4 text-2xl font-bold tracking-tight text-zinc-100">
        {value}
      </div>
    </div>
  );
}

function EvidenceStep({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-4">
      <div className="flex gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-cyan-400/10 bg-cyan-400/[0.04] font-mono text-[10px] font-bold text-cyan-400">
          {number}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-zinc-300">
            {title}
          </div>

          <div className="mt-1 text-[10px] leading-5 text-zinc-600">
            {description}
          </div>

          <div className="mt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-black/20 p-3">
      <div className="text-[9px] font-bold uppercase tracking-wider text-zinc-700">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-semibold text-zinc-300">
        {value}
      </div>
    </div>
  );
}
