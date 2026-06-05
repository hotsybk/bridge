// Server-only enforcement (CLAUDE.md §5.4).
if (typeof window !== "undefined") {
  throw new Error("algolia service must be used only on the server side.");
}

// Wave Z — Next.js 서버에서 Algolia 검색만 수행 (admin key 사용 금지).
// search-only key 만 사용 — 노출되어도 search 권한만 부여됨.
// env 미설정 시 null 반환 → tRPC 라우터에서 Firestore fallback 으로 분기.

const APP_ID =
  process.env.ALGOLIA_APP_ID || process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;
const INDEX_NAME = process.env.ALGOLIA_INDEX_NAME || "products";

export function isAlgoliaConfigured(): boolean {
  return Boolean(APP_ID && SEARCH_KEY);
}

export interface AlgoliaSearchResult {
  hits: Array<Record<string, unknown> & {objectID: string}>;
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  processingTimeMS: number;
  source: "algolia";
}

export type SortValue = "popularity" | "newest" | "price_asc" | "price_desc";

export interface SearchOpts {
  query?: string;
  categoryId?: string;
  vendorId?: string;
  page?: number;
  hitsPerPage?: number;
  sort?: SortValue;
}

/**
 * Algolia 검색 호출.
 * 환경 미설정 또는 호출 실패 시 null — 라우터가 Firestore fallback.
 */
export async function searchProducts(
  opts: SearchOpts,
): Promise<AlgoliaSearchResult | null> {
  if (!isAlgoliaConfigured()) return null;

  const filters: string[] = ["isActive:true"];
  if (opts.categoryId) filters.push(`categoryId:"${opts.categoryId}"`);
  if (opts.vendorId) filters.push(`vendorId:"${opts.vendorId}"`);

  const indexSuffix =
    opts.sort === "price_asc"
      ? "_price_asc"
      : opts.sort === "price_desc"
        ? "_price_desc"
        : opts.sort === "newest"
          ? "_newest"
          : "";

  const url = `https://${APP_ID}-dsn.algolia.net/1/indexes/${INDEX_NAME}${indexSuffix}/query`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "X-Algolia-Application-Id": APP_ID as string,
        "X-Algolia-API-Key": SEARCH_KEY as string,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: opts.query ?? "",
        filters: filters.join(" AND "),
        page: opts.page ?? 0,
        hitsPerPage: opts.hitsPerPage ?? 24,
      }),
    });
    if (!res.ok) {
      console.error("[algolia search] failed", res.status, await res.text());
      return null;
    }
    const data = (await res.json()) as Omit<AlgoliaSearchResult, "source">;
    return {...data, source: "algolia"};
  } catch (err) {
    console.error("[algolia search] exception", err);
    return null;
  }
}
