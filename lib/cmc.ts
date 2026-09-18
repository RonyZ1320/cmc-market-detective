const CMC_BASE_URL = "https://pro-api.coinmarketcap.com";

export type CMCQuote = {
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

export type CMCAsset = {
  id: number;
  name: string;
  symbol: string;
  cmc_rank: number;
  quote: CMCQuote[];
};

type CMCResponse = {
  data?: CMCAsset[];
  status?: {
    error_code?: number;
    error_message?: string;
    timestamp?: string;
    credit_count?: number;
  };
};

export type CMCMarketResult = {
  data: CMCAsset[];
  status: {
    error_code: number;
    error_message?: string;
    timestamp?: string;
    credit_count: number;
  };
};

export async function getLatestListings(
  limit = 100
): Promise<CMCMarketResult> {
  const apiKey = process.env.CMC_API_KEY;

  if (!apiKey) {
    throw new Error("CMC_API_KEY is not configured");
  }

  const url = new URL(
    `${CMC_BASE_URL}/v3/cryptocurrency/listings/latest`
  );

  url.searchParams.set("start", "1");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("convert", "USD");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-CMC_PRO_API_KEY": apiKey.trim(),
    },
    cache: "no-store",
  });

  const result: CMCResponse = await response.json();

  const errorCode = Number(result.status?.error_code ?? 0);

  if (!response.ok || errorCode !== 0) {
    throw new Error(
      `CMC API ${errorCode}: ${
        result.status?.error_message ?? response.statusText
      }`
    );
  }

  return {
    data: result.data ?? [],
    status: {
      error_code: errorCode,
      error_message: result.status?.error_message,
      timestamp: result.status?.timestamp,
      credit_count: Number(result.status?.credit_count ?? 0),
    },
  };
}
