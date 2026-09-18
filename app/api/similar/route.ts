import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const target = body.asset;
    const assets = Array.isArray(body.assets) ? body.assets : [];

    if (!target?.quote?.[0]) {
      return NextResponse.json(
        { success: false, error: "Target asset is required" },
        { status: 400 }
      );
    }

    const tq = target.quote[0];

    const targetVolumeToCap =
      tq.volume_24h / Math.max(tq.market_cap, 1);

    const distance = (a: number, b: number, scale: number) =>
      Math.abs(a - b) / Math.max(scale, 0.0001);

    const matches = assets
      .filter(
        (asset: any) =>
          asset?.quote?.[0] &&
          asset.symbol !== target.symbol
      )
      .map((asset: any) => {
        const q = asset.quote[0];

        const volumeToCap =
          q.volume_24h / Math.max(q.market_cap, 1);

        const d24h = distance(
          q.percent_change_24h,
          tq.percent_change_24h,
          20
        );

        const dVolume = distance(
          q.volume_change_24h,
          tq.volume_change_24h,
          100
        );

        const d1h = distance(
          q.percent_change_1h,
          tq.percent_change_1h,
          5
        );

        const d7d = distance(
          q.percent_change_7d,
          tq.percent_change_7d,
          30
        );

        const dActivity = distance(
          volumeToCap,
          targetVolumeToCap,
          0.25
        );

        const rawDistance =
          d24h * 0.35 +
          dVolume * 0.25 +
          d1h * 0.15 +
          d7d * 0.10 +
          dActivity * 0.15;

        const similarity = Math.max(
          0,
          Math.min(
            100,
            Math.round(100 / (1 + rawDistance))
          )
        );

        const reasons: string[] = [];

        if (
          Math.abs(
            q.percent_change_24h - tq.percent_change_24h
          ) <= 5
        ) {
          reasons.push("similar 24h move");
        }

        if (
          Math.abs(
            q.volume_change_24h - tq.volume_change_24h
          ) <= 25
        ) {
          reasons.push("similar volume expansion");
        }

        if (
          Math.abs(
            q.percent_change_1h - tq.percent_change_1h
          ) <= 2.5
        ) {
          reasons.push("similar short-term acceleration");
        }

        if (
          Math.abs(
            q.percent_change_7d - tq.percent_change_7d
          ) <= 10
        ) {
          reasons.push("similar 7d momentum");
        }

        if (
          Math.abs(volumeToCap - targetVolumeToCap) <= 0.1
        ) {
          reasons.push("similar volume/cap activity");
        }

        return {
          ...asset,
          similarity,
          reasons,
          comparison: {
            return24h: q.percent_change_24h,
            volumeChange24h: q.volume_change_24h,
            return1h: q.percent_change_1h,
            return7d: q.percent_change_7d,
            volumeToCap,
          },
        };
      })
      .sort(
        (a: any, b: any) =>
          b.similarity - a.similarity
      )
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      target: {
        name: target.name,
        symbol: target.symbol,
        return24h: tq.percent_change_24h,
        volumeChange24h: tq.volume_change_24h,
        return1h: tq.percent_change_1h,
        return7d: tq.percent_change_7d,
        volumeToCap: targetVolumeToCap,
      },
      matches,
      method: {
        type: "deterministic behavioral similarity",
        weights: {
          return24h: 35,
          volumeChange24h: 25,
          return1h: 15,
          return7d: 10,
          volumeToCap: 15,
        },
      },
      source:
        "CoinMarketCap market snapshot + deterministic similarity engine",
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
