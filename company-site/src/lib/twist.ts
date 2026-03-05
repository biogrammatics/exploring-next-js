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

/** Step 2: Create a construct for scoring */
export async function createConstruct(body: {
  sequences: string[];
  name: string;
  type?: string;
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

/** Step 3: Score/describe a construct by ID */
export async function describeConstruct(constructId: string) {
  const res = await fetch(
    userPath(`/constructs/describe/?id__in=${constructId}`),
    { headers: getHeaders() }
  );
  return parseResponse(res);
}
