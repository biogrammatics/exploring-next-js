/** Twist scoring error codes — returned in score_data.issues[].code */
export const TWIST_ERROR_CODES: Record<number, { message: string; category: string; fixable: boolean }> = {
  // General
  4000: { message: "General error", category: "general", fixable: false },
  4001: { message: "Problematic sequence", category: "general", fixable: false },
  4002: { message: "Repeats or extreme GC in highlighted region", category: "general", fixable: true },
  4003: { message: "Invalid sequence", category: "validation", fixable: false },
  4004: { message: "Sequence contains invalid character(s)", category: "validation", fixable: false },
  // Length
  4100: { message: "Invalid sequence length", category: "length", fixable: false },
  4101: { message: "Sequence is too short", category: "length", fixable: false },
  4102: { message: "Sequence is too long", category: "length", fixable: false },
  4103: { message: "Sequences >1,700bp elevate risk marginally — consider splitting", category: "length", fixable: false },
  4104: { message: "Sequences >3,100bp elevate risk — consider splitting", category: "length", fixable: false },
  // GC content
  4200: { message: "Invalid GC content", category: "gc", fixable: true },
  4201: { message: "Overall GC must be under 65% (under 60% optimal)", category: "gc", fixable: true },
  4202: { message: "Overall GC must be over 25%", category: "gc", fixable: true },
  4203: { message: "GC difference between highest/lowest 50bp windows exceeds 52%", category: "gc", fixable: true },
  // Secondary structure / repeats
  4300: { message: "Secondary structure issue", category: "repeats", fixable: true },
  4301: { message: "Hairpin detected", category: "repeats", fixable: true },
  4303: { message: "Long direct repeat (≥20bp) detected", category: "repeats", fixable: true },
  4304: { message: "Direct repeat with high Tm (>60°C) detected", category: "repeats", fixable: true },
  4305: { message: ">45% of sequence is small repeats (≥9bp) — vary codon usage", category: "repeats", fixable: true },
  4306: { message: "Long low-homology repeat region detected", category: "repeats", fixable: true },
  // Design / manufacturing
  4401: { message: "Cannot find acceptable split point for hierarchical design", category: "design", fixable: false },
  4402: { message: "Unable to synthesize as-is — try codon optimization or splitting", category: "design", fixable: true },
  4403: { message: "Cannot find acceptable split point for hierarchical design", category: "design", fixable: false },
  4404: { message: "Fragment sizes <300bp — retry with fewer fragments", category: "design", fixable: false },
  4405: { message: "Fragment sizes >1,800bp — retry with more fragments", category: "design", fixable: false },
  // Sequence content
  4501: { message: "His tag with ≥5 identical codons — vary codons (e.g. CAT CAC CAT)", category: "codons", fixable: true },
  4502: { message: "CpG multimeric segment ≥14bp — break up low-complexity region", category: "codons", fixable: true },
  4503: { message: "Long homopolymer stretch — break up", category: "codons", fixable: true },
  4504: { message: "Contains Gateway cloning att site(s)", category: "forbidden", fixable: false },
  4505: { message: "Contains impermissible sequences (manufacturing/QC)", category: "forbidden", fixable: false },
  4506: { message: "Clonal gene has high homology to CCDB", category: "forbidden", fixable: false },
  4507: { message: "Restriction site of methylation-sensitive enzyme overlaps methylation site", category: "forbidden", fixable: false },
  4508: { message: "Unable to design primers — increase GC in first/last 60bp", category: "design", fixable: true },
  // Fragment design
  5001: { message: "Unable to split fragment for synthesis", category: "design", fixable: false },
  5002: { message: "Fragment design exception", category: "design", fixable: false },
};

const TWIST_API_BASE_URL =
  process.env.TWIST_API_BASE_URL ||
  "https://twist-api.twistbioscience-staging.com";
const TWIST_API_EMAIL =
  process.env.TWIST_API_EMAIL || "twist.sandbox@biogrammatics.com";

function getHeaders(): Record<string, string> {
  const authToken = process.env.TWIST_AUTH_TOKEN;
  const endUserToken = process.env.TWIST_END_USER_TOKEN;

  if (!authToken || !endUserToken) {
    throw new Error("TWIST_AUTH_TOKEN and TWIST_END_USER_TOKEN must be set");
  }

  return {
    Authorization: authToken,
    "X-End-User-Token": endUserToken,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

function userPath(path: string): string {
  return `${TWIST_API_BASE_URL}/v1/users/${TWIST_API_EMAIL}${path}`;
}

async function parseResponse(res: Response) {
  const text = await res.text();
  try {
    return { status: res.status, data: JSON.parse(text) };
  } catch {
    return { status: res.status, data: { rawBody: text || "(empty response)" } };
  }
}

/** Step 0: Test connectivity — GET user profile */
export async function testConnection() {
  const res = await fetch(userPath("/"), { headers: getHeaders() });
  return parseResponse(res);
}

/** Step 1: Get available vectors and insertion points */
export async function getVectors() {
  const res = await fetch(userPath("/vectors/"), { headers: getHeaders() });
  return parseResponse(res);
}

/** Step 2a: Create a cloned gene construct (into a vector) */
export async function createClonedConstruct(body: {
  sequences: string[];
  name: string;
  insertion_point_mes_uid: string;
  vector_mes_uid: string;
}) {
  const res = await fetch(userPath("/constructs/"), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      type: "CLONED_GENE",
      adapters_on: false,
      ...body,
    }),
  });
  return parseResponse(res);
}

/** Step 2b: Create a fragment construct (no vector) */
export async function createFragmentConstruct(body: {
  sequences: string[];
  name: string;
}) {
  const res = await fetch(userPath("/constructs/"), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      type: "NON_CLONED_GENE",
      adapters_on: false,
      ...body,
    }),
  });
  return parseResponse(res);
}

/** Step 2: Create a construct — dispatches to cloned or fragment */
export async function createConstruct(body: {
  sequences: string[];
  name: string;
  type?: string;
  insertion_point_mes_uid?: string;
  vector_mes_uid?: string;
}) {
  if (body.type === "NON_CLONED_GENE") {
    return createFragmentConstruct({
      sequences: body.sequences,
      name: body.name,
    });
  }
  return createClonedConstruct({
    sequences: body.sequences,
    name: body.name,
    insertion_point_mes_uid: body.insertion_point_mes_uid || "",
    vector_mes_uid: body.vector_mes_uid || "",
  });
}

/** Step 3: Score/describe a construct by ID */
export async function describeConstruct(constructId: string) {
  const res = await fetch(
    userPath(`/constructs/describe/?id__in=${constructId}`),
    { headers: getHeaders() }
  );
  return parseResponse(res);
}
