"use client";

import { useState } from "react";

interface ApiResult {
  status: number;
  data: unknown;
}

const SAMPLE_SEQUENCE =
  "ATGGCTTCTCCCATCTCAAATTCTTCTTCAACTCTCTACAGCTTATTTTTCTTTGGCCTCTTGCTTTCATTTTCGTTTGCTGGTCGTGCTCGAGCTAACCCCAATTACCGAGACGCCTTGGCTAAGTCGATATTGTTTTTTGAAGGACAACGCTCCGGTAGGATCCCGGCTAACCAACGGATCACTTGGAGGTCCAACTCCGGCCTCTACGATGGTGAACTTGCTCATGTGGATTTAACCGGCGGCTACTACGACGCCGGCGACAATGTAAAATTCAATCTTCCGATGGCTTTCACAACCACAATGCTTTCATGGGGAGCACTCGAGTACGGGGCGCGTATGGGTAGCGAATTAGGCAACACACGGGCCGCCATCCGTTGGGCCACCGATTACCTTCTCAAGTGCGCGACCGCCACTCCAGGCAAGCTCTACGTCGGCGTGGGAGACCCTCACGCCGACCACAAGTGCTGGGAACGGCCTGAGGACATGGATACTGTTCGAACCGTATACTCTGTTTCTGCCGGGAACCCAGGATCGGATGTTGCCGGAGAGACCGCGGCCGCACTGGCCGCCGCGTCGTTGGTGTTCCGACGAGTTGATAGGAAGTATTCACGGGTGTTGCTGGCGACGGCGAAGAAGGTGATGGAATTTGCGTTGGAGCACCGTGGATCGTATAGTGATTCGCTTTCCTCTGCTGTTTGTCCTTTTTATTGCTCTTATTCCGGATATAAGGATGAATTGGTATGGGGAGCAGCATGGCTTCTAAGAGCAACAAATGATGTTAAATACTTCAATTTGTTGAAGTCATTGGGAGGTGATGATGTGACTGATATCTTTAGTTGGGACAACAAATTTGCTGGTGCTCATGTCCTTTTGGGGAGATTGATGTTCAAGTTGCCAGAAAGTAACCTCCAATATGTGACATCCATAACGTTTTTGCTCACCACATATTCCAAATACATGTCTGCAGCCAAACACACATTCAACTGTGGCAACCTTGTCGTTACTCCAGCTTCTCTGAAAAACCTTGCTAAGATTCAGGTGGATTATATATTAGGAGTGAACCCATTGAAAATGTCATACATGGTGGGATATGGAAAGAACTTCCCAAAGAGAATTCATCATAGAGGATCTTCGCTGCCTTCCAAGGCCACCCACCCTCAAGCTATTGCCTGCGATGGTGGCTTCCAACCCTTCTTCTATTCCTACAACCCCAACCCTAATATCTTAATTGGCGCTGTCGTCGGCGGCCCCAATCAAAGTGATGGCTTCCCTGACGATCGCACTGATTACAGCCACTCTGAACCTGCTACGTACATCAATGCTGCTCTTGTTGGACCTCTTGCATTCTTCTCGGGCAAACATTGA";

export default function TwistTestPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ApiResult | null>>({});
  const [constructMode, setConstructMode] = useState<"CLONED_GENE" | "NON_CLONED_GENE">("CLONED_GENE");
  const [vectorMesUid, setVectorMesUid] = useState("");
  const [insertionPointMesUid, setInsertionPointMesUid] = useState("");
  const [sequence, setSequence] = useState(SAMPLE_SEQUENCE);
  const [constructName, setConstructName] = useState("TEST_Clonal");
  const [constructId, setConstructId] = useState("");

  async function runStep(key: string, fn: () => Promise<ApiResult>) {
    setLoading(key);
    try {
      const result = await fn();
      setResults((prev) => ({ ...prev, [key]: result }));
      return result;
    } catch (err) {
      const errResult: ApiResult = {
        status: 0,
        data: { error: String(err) },
      };
      setResults((prev) => ({ ...prev, [key]: errResult }));
      return errResult;
    } finally {
      setLoading(null);
    }
  }

  const testConnection = () =>
    runStep("connection", async () => {
      const res = await fetch("/api/twist/test");
      return res.json();
    });

  const fetchVectors = () =>
    runStep("vectors", async () => {
      const res = await fetch("/api/twist/vectors");
      const data: ApiResult = await res.json();
      // Auto-populate first vector's UIDs if available
      if (
        data?.data &&
        typeof data.data === "object" &&
        "results" in data.data
      ) {
        const results = (data.data as { results: Record<string, unknown>[] })
          .results;
        if (results?.length > 0) {
          const v = results[0];
          setVectorMesUid((v.mes_uid as string) || "");
          const insertionPoints = v.insertion_points as
            | Record<string, unknown>[]
            | undefined;
          if (insertionPoints?.length) {
            setInsertionPointMesUid(
              (insertionPoints[0].mes_uid as string) || ""
            );
          }
        }
      }
      return data;
    });

  const createConstruct = () =>
    runStep("construct", async () => {
      const payload: Record<string, unknown> = {
        sequences: [sequence.trim()],
        name: constructName,
        type: constructMode,
      };
      if (constructMode === "CLONED_GENE") {
        payload.vector_mes_uid = vectorMesUid;
        payload.insertion_point_mes_uid = insertionPointMesUid;
      }
      const res = await fetch("/api/twist/constructs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data: ApiResult = await res.json();
      // Auto-populate construct ID from response
      if (
        data?.data &&
        typeof data.data === "object" &&
        "results" in data.data
      ) {
        const results = (data.data as { results: Record<string, unknown>[] })
          .results;
        if (results?.length > 0) {
          setConstructId(String(results[0].id || ""));
        }
      }
      return data;
    });

  const scoreConstruct = () =>
    runStep("score", async () => {
      const res = await fetch(
        `/api/twist/constructs/describe?id=${constructId}`
      );
      return res.json();
    });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Twist API Test</h1>
      <p className="text-gray-500 mb-8">
        Test connectivity and endpoints against Twist Bioscience staging API.
        Calls are proxied through our server (Render IP whitelist).
      </p>

      <div className="space-y-8 max-w-4xl">
        {/* Step 0: Connection Test */}
        <Section title="Step 0: Test Connection" step="0">
          <p className="text-sm text-gray-600 mb-3">
            GET user profile to verify credentials and connectivity.
          </p>
          <button
            onClick={testConnection}
            disabled={loading !== null}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === "connection" ? "Testing..." : "Test Connection"}
          </button>
          <ResultDisplay result={results.connection} />
        </Section>

        {/* Step 1: Get Vectors */}
        <Section title="Step 1: Get Vectors" step="1">
          <p className="text-sm text-gray-600 mb-3">
            Fetch available vectors and insertion points. UIDs will
            auto-populate below.
          </p>
          <button
            onClick={fetchVectors}
            disabled={loading !== null}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === "vectors" ? "Fetching..." : "Get Vectors"}
          </button>
          <ResultDisplay result={results.vectors} />
        </Section>

        {/* Step 2: Create Construct */}
        <Section title="Step 2: Create Construct" step="2">
          <p className="text-sm text-gray-600 mb-4">
            Submit a DNA sequence for scoring — as a cloned gene (into vector) or as a standalone fragment.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Construct Type
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setConstructMode("CLONED_GENE")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border ${constructMode === "CLONED_GENE" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                >
                  Cloned Gene (into vector)
                </button>
                <button
                  onClick={() => setConstructMode("NON_CLONED_GENE")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border ${constructMode === "NON_CLONED_GENE" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"}`}
                >
                  Fragment (no vector)
                </button>
              </div>
            </div>
            {constructMode === "CLONED_GENE" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vector MES UID
                  </label>
                  <input
                    type="text"
                    value={vectorMesUid}
                    onChange={(e) => setVectorMesUid(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                    placeholder="OI_59529ab1f9aecd6d6574f2f8"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Insertion Point MES UID
                  </label>
                  <input
                    type="text"
                    value={insertionPointMesUid}
                    onChange={(e) => setInsertionPointMesUid(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                    placeholder="494e5353-59ee-2d8b-810a-d3c87d51e2f5"
                  />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Construct Name
              </label>
              <input
                type="text"
                value={constructName}
                onChange={(e) => setConstructName(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                DNA Sequence
              </label>
              <textarea
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                rows={6}
                className="w-full border rounded-lg px-3 py-2 font-mono text-xs"
              />
              <p className="text-sm text-gray-500 mt-1">
                {sequence.length} bp
              </p>
            </div>
            <button
              onClick={createConstruct}
              disabled={
                loading !== null || (constructMode === "CLONED_GENE" && (!vectorMesUid || !insertionPointMesUid))
              }
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading === "construct" ? "Creating..." : constructMode === "CLONED_GENE" ? "Create Cloned Construct" : "Create Fragment"}
            </button>
          </div>
          <ResultDisplay result={results.construct} />
        </Section>

        {/* Step 3: Score Construct */}
        <Section title="Step 3: Score Construct" step="3">
          <p className="text-sm text-gray-600 mb-4">
            Check if the construct is buildable. The construct ID
            auto-populates from Step 2.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Construct ID
              </label>
              <input
                type="text"
                value={constructId}
                onChange={(e) => setConstructId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 font-mono text-sm"
                placeholder="123456"
              />
            </div>
            <button
              onClick={scoreConstruct}
              disabled={loading !== null || !constructId}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading === "score" ? "Scoring..." : "Score Construct"}
            </button>
          </div>
          <ResultDisplay result={results.score} />
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  step,
  children,
}: {
  title: string;
  step: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
          {step}
        </span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ResultDisplay({ result }: { result?: ApiResult | null }) {
  if (!result) return null;

  const statusColor =
    result.status >= 200 && result.status < 300
      ? "text-green-700 bg-green-50 border-green-200"
      : "text-red-700 bg-red-50 border-red-200";

  return (
    <div className="mt-4">
      {result.status > 0 && (
        <span
          className={`inline-block px-2 py-0.5 rounded text-sm font-medium border mb-2 ${statusColor}`}
        >
          {result.status}
        </span>
      )}
      <pre className="bg-gray-50 border rounded-lg p-4 text-xs overflow-auto max-h-96">
        {JSON.stringify(result.data, null, 2)}
      </pre>
    </div>
  );
}
