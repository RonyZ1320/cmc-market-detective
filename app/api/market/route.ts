import { NextResponse } from "next/server";
import { getLatestListings } from "../../../lib/cmc";
import { detectAnomalies } from "../../../lib/anomaly";

export async function GET() {
  try {
    const result = await getLatestListings(100);
    const anomalies = detectAnomalies(result.data);

    return NextResponse.json({
      success: true,
      count: result.data.length,
      data: result.data,
      anomalies,
      status: result.status,
      request: {
        method: "GET",
        endpoint: "/v3/cryptocurrency/listings/latest",
        params: {
          start: 1,
          limit: 100,
          convert: "USD",
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
