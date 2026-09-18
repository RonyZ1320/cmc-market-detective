import type { CMCAsset } from "./cmc";

export type Anomaly = CMCAsset & {
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

function percentile(values: number[], value: number) {
  if (!values.length) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const index = sorted.findIndex((v) => v >= value);

  if (index === -1) return 1;

  return index / Math.max(sorted.length - 1, 1);
}

export function detectAnomalies(rows: CMCAsset[]): Anomaly[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const validRows = rows.filter((r) => r?.quote?.[0]);

  if (!validRows.length) return [];

  const moveValues = validRows.map((r) =>
    Math.abs(r.quote[0].percent_change_24h || 0)
  );

  const accelerationValues = validRows.map((r) =>
    Math.abs(r.quote[0].percent_change_1h || 0)
  );

  const volumeChangeValues = validRows.map((r) =>
    Math.abs(r.quote[0].volume_change_24h || 0)
  );

  const volumeToCapValues = validRows.map((r) => {
    const q = r.quote[0];

    return q.volume_24h / Math.max(q.market_cap, 1);
  });

  return validRows
    .map((r) => {
      const q = r.quote[0];

      const move = Math.abs(q.percent_change_24h || 0);
      const acceleration = Math.abs(q.percent_change_1h || 0);
      const volumeChange = Math.abs(q.volume_change_24h || 0);

      const volumeToCap =
        q.volume_24h / Math.max(q.market_cap, 1);

      const movePercentile = percentile(
        moveValues,
        move
      );

      const accelerationPercentile = percentile(
        accelerationValues,
        acceleration
      );

      const volumeChangePercentile = percentile(
        volumeChangeValues,
        volumeChange
      );

      const liquidityPercentile = percentile(
        volumeToCapValues,
        volumeToCap
      );

      const baseScore =
        movePercentile * 35 +
        volumeChangePercentile * 25 +
        accelerationPercentile * 20 +
        liquidityPercentile * 10;

      let bonusScore = 0;

      const reasons: string[] = [];

      if (movePercentile >= 0.8) {
        bonusScore += 5;

        reasons.push(
          "unusually large 24h price move"
        );
      }

      if (volumeChangePercentile >= 0.8) {
        bonusScore += 5;

        reasons.push(
          "unusual 24h volume change"
        );
      }

      if (accelerationPercentile >= 0.8) {
        reasons.push(
          "strong short-term acceleration"
        );
      }

      if (liquidityPercentile >= 0.8) {
        reasons.push(
          "high trading activity relative to market cap"
        );
      }

      const direction24h = Math.sign(
        q.percent_change_24h || 0
      );

      const direction7d = Math.sign(
        q.percent_change_7d || 0
      );

      if (
        direction24h !== direction7d &&
        Math.abs(q.percent_change_7d || 0) > 5
      ) {
        bonusScore += 10;

        reasons.push(
          "24h and 7d price direction diverge"
        );
      }

      const score = Math.min(
        100,
        Math.round(baseScore + bonusScore)
      );

      if (score >= 35 && reasons.length === 0) {
        reasons.push(
          "statistically unusual market activity"
        );
      }

      return {
        ...r,

        score,

        reasons,

        metrics: {
          volumeToCap,

          momentum24h:
            q.percent_change_24h || 0,

          return1h:
            q.percent_change_1h || 0,

          return7d:
            q.percent_change_7d || 0,

          return30d:
            q.percent_change_30d ?? null,

          return60d:
            q.percent_change_60d ?? null,

          volumeChange:
            q.volume_change_24h || 0,

          acceleration:
            q.percent_change_1h || 0,

          movePercentile,

          accelerationPercentile,

          volumeChangePercentile,

          liquidityPercentile,

          baseScore,

          bonusScore,
        },
      };
    })
    .filter((r) => r.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}
