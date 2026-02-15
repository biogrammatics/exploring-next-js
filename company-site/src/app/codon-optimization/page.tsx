"use client";

import { useState, useEffect, useCallback } from "react";

interface JobStatus {
  id: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  proteinSequence: string;
  proteinName: string | null;
  targetOrganism: string;
  dnaSequence: string | null;
  errorMessage: string | null;
  vectorName: string | null;
  goldenGateExclusion: boolean;
  excludedEnzymeNames: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  stats: {
    aminoAcidCount: number;
    dnaLength: number;
    gcContent: number;
  } | null;
}

const EXPRESSION_VECTORS = [
  { name: "pPICZ-A", label: "pPICZ-A (AOX1 / Zeocin)" },
  { name: "pPICZ-B", label: "pPICZ-B (AOX1 / Zeocin)" },
  { name: "pGAPZ-A", label: "pGAPZ-A (GAP / Zeocin)" },
  { name: "pPIC9K", label: "pPIC9K (AOX1 / G418)" },
  { name: "pTEF1-Zeo", label: "pTEF1-Zeo (TEF1 / Zeocin)" },
];

export default function CodonOptimizationPage() {
  const [proteinSequence, setProteinSequence] = useState("");
  const [proteinName, setProteinName] = useState("");
  const [targetOrganism, setTargetOrganism] = useState("pichia");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [selectedVector, setSelectedVector] = useState("");
  const [goldenGateExclusion, setGoldenGateExclusion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  // Job tracking
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Poll for job status
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`/api/codon-optimization/${jobId}`);
      const data = await response.json();

      if (response.ok && data.job) {
        setJobStatus(data.job);

        // Stop polling if job is complete or failed
        if (data.job.status === "COMPLETED" || data.job.status === "FAILED") {
          setIsPolling(false);
        }
      }
    } catch (err) {
      console.error("Error polling job status:", err);
    }
  }, []);

  // Set up polling interval
  useEffect(() => {
    if (!isPolling || !currentJobId) return;

    const interval = setInterval(() => {
      pollJobStatus(currentJobId);
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [isPolling, currentJobId, pollJobStatus]);

  // Check for job ID in URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("job");
    if (jobId) {
      setCurrentJobId(jobId);
      setIsPolling(true);
      pollJobStatus(jobId);
    }
  }, [pollJobStatus]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setWarnings([]);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/codon-optimization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proteinSequence,
          proteinName: proteinName || undefined,
          targetOrganism,
          notificationEmail: notificationEmail || undefined,
          vectorName: selectedVector || undefined,
          goldenGateExclusion,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit job");
      }

      // Job submitted successfully
      setCurrentJobId(data.jobId);
      setWarnings(data.warnings || []);
      setIsPolling(true);

      // Update URL with job ID
      window.history.pushState({}, "", `?job=${data.jobId}`);

      // Start polling
      pollJobStatus(data.jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit job");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleNewJob() {
    setCurrentJobId(null);
    setJobStatus(null);
    setIsPolling(false);
    setProteinSequence("");
    setProteinName("");
    setWarnings([]);
    setError("");
    window.history.pushState({}, "", window.location.pathname);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function downloadFasta(sequence: string, name: string, type: "protein" | "dna") {
    const header = `>${name || "sequence"}_${type}`;
    const content = `${header}\n${sequence}`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "sequence"}_${type}.fasta`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Show results if we have a completed job
  if (jobStatus) {
    return (
      <main className="min-h-screen py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold mb-2 text-white drop-shadow-lg">
            Codon Optimization
          </h1>
          <p className="text-white/80 mb-8">
            Reverse translate protein sequences to DNA
          </p>

          <div className="glass-panel p-6">
            {/* Status indicator */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    jobStatus.status === "COMPLETED"
                      ? "bg-green-100 text-green-800"
                      : jobStatus.status === "FAILED"
                      ? "bg-red-100 text-red-800"
                      : jobStatus.status === "PROCESSING"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {jobStatus.status === "PROCESSING" && (
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                  {jobStatus.status}
                </span>
                {jobStatus.proteinName && (
                  <span className="text-gray-600">{jobStatus.proteinName}</span>
                )}
              </div>
              <button
                onClick={handleNewJob}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Start New Job
              </button>
            </div>

            {/* Error message */}
            {jobStatus.status === "FAILED" && jobStatus.errorMessage && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                <strong>Error:</strong> {jobStatus.errorMessage}
              </div>
            )}

            {/* Pending/Processing message */}
            {(jobStatus.status === "PENDING" ||
              jobStatus.status === "PROCESSING") && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
                <p className="font-medium">
                  {jobStatus.status === "PENDING"
                    ? "Your job is queued and will be processed shortly..."
                    : "Your sequence is being optimized..."}
                </p>
                <p className="text-sm mt-1">
                  You can leave this page and return later. If you provided an
                  email, you&apos;ll be notified when it&apos;s complete.
                </p>
              </div>
            )}

            {/* Results */}
            {jobStatus.status === "COMPLETED" && jobStatus.dnaSequence && (
              <>
                {/* Stats */}
                {jobStatus.stats && (
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-gray-800">
                        {jobStatus.stats.aminoAcidCount}
                      </div>
                      <div className="text-sm text-gray-600">Amino Acids</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-gray-800">
                        {jobStatus.stats.dnaLength}
                      </div>
                      <div className="text-sm text-gray-600">Base Pairs</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg text-center">
                      <div className="text-2xl font-bold text-gray-800">
                        {jobStatus.stats.gcContent}%
                      </div>
                      <div className="text-sm text-gray-600">GC Content</div>
                    </div>
                  </div>
                )}

                {/* Restriction enzyme exclusions */}
                {jobStatus.excludedEnzymeNames && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">
                      Restriction Enzyme Exclusions
                    </h4>
                    <p className="text-sm text-gray-600">
                      {jobStatus.vectorName && (
                        <>Vector: {jobStatus.vectorName}. </>
                      )}
                      {jobStatus.goldenGateExclusion && (
                        <>Golden Gate compatible. </>
                      )}
                      Excluded: {jobStatus.excludedEnzymeNames.split(",").join(", ")}
                    </p>
                  </div>
                )}

                {/* DNA Sequence */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-800">
                      Optimized DNA Sequence
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(jobStatus.dnaSequence!)}
                        className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() =>
                          downloadFasta(
                            jobStatus.dnaSequence!,
                            jobStatus.proteinName || "optimized",
                            "dna"
                          )
                        }
                        className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        Download FASTA
                      </button>
                    </div>
                  </div>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                    {jobStatus.dnaSequence}
                  </pre>
                </div>

                {/* Original protein sequence */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-medium text-gray-800">
                      Input Protein Sequence
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(jobStatus.proteinSequence)}
                        className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() =>
                          downloadFasta(
                            jobStatus.proteinSequence,
                            jobStatus.proteinName || "input",
                            "protein"
                          )
                        }
                        className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        Download FASTA
                      </button>
                    </div>
                  </div>
                  <pre className="bg-gray-100 text-gray-800 p-4 rounded-lg overflow-x-auto text-sm font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                    {jobStatus.proteinSequence}
                  </pre>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Show submission form
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold mb-2 text-white drop-shadow-lg">
          Codon Optimization
        </h1>
        <p className="text-white/80 mb-8">
          Reverse translate protein sequences to DNA optimized for your target
          organism
        </p>

        <div className="glass-panel p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Protein sequence input */}
            <div>
              <label
                htmlFor="proteinSequence"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Protein Sequence (amino acids) *
              </label>
              <textarea
                id="proteinSequence"
                value={proteinSequence}
                onChange={(e) => setProteinSequence(e.target.value)}
                required
                rows={8}
                placeholder="Paste your amino acid sequence here (FASTA format accepted)..."
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
              <p className="text-sm text-gray-500 mt-1">
                Standard single-letter amino acid codes. Whitespace and numbers
                will be removed.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Protein name */}
              <div>
                <label
                  htmlFor="proteinName"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Protein Name (optional)
                </label>
                <input
                  type="text"
                  id="proteinName"
                  value={proteinName}
                  onChange={(e) => setProteinName(e.target.value)}
                  placeholder="e.g., GFP, Insulin"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Target organism */}
              <div>
                <label
                  htmlFor="targetOrganism"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Target Organism
                </label>
                <select
                  id="targetOrganism"
                  value={targetOrganism}
                  onChange={(e) => setTargetOrganism(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="pichia">Pichia pastoris</option>
                  <option value="ecoli">E. coli</option>
                  <option value="yeast">S. cerevisiae</option>
                  <option value="human">Human (H. sapiens)</option>
                  <option value="cho">CHO cells</option>
                </select>
              </div>
            </div>

            {/* Cloning options */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-800">Cloning Options</h3>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Expression vector */}
                <div>
                  <label
                    htmlFor="vector"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Expression Vector
                  </label>
                  <select
                    id="vector"
                    value={selectedVector}
                    onChange={(e) => setSelectedVector(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">No vector selected</option>
                    {EXPRESSION_VECTORS.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-gray-500 mt-1">
                    Automatically excludes restriction sites used by this vector.
                  </p>
                </div>

                {/* Golden Gate toggle */}
                <div className="flex items-start gap-3 pt-7">
                  <input
                    type="checkbox"
                    id="goldenGate"
                    checked={goldenGateExclusion}
                    onChange={(e) => setGoldenGateExclusion(e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="goldenGate" className="text-sm text-gray-700">
                    <span className="font-medium">Golden Gate compatible</span>
                    <br />
                    <span className="text-gray-500">
                      Excludes BsaI, BbsI, BsmBI, and SapI sites
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Email notification */}
            <div>
              <label
                htmlFor="notificationEmail"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email for Notification (optional)
              </label>
              <input
                type="email"
                id="notificationEmail"
                value={notificationEmail}
                onChange={(e) => setNotificationEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-sm text-gray-500 mt-1">
                Receive an email when your optimization is complete
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                {error}
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                <strong>Warnings:</strong>
                <ul className="list-disc ml-5 mt-1">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting || !proteinSequence.trim()}
              className="w-full py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 font-medium text-lg"
            >
              {isSubmitting ? "Submitting..." : "Optimize Codons"}
            </button>
          </form>
        </div>

        {/* Info section */}
        <div className="mt-8 glass-panel p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            About Codon Optimization
          </h2>
          <div className="text-gray-600 space-y-3">
            <p>
              Codon optimization (reverse translation) converts a protein
              sequence into a DNA sequence that encodes the same protein. Because
              multiple codons can encode the same amino acid, optimization can
              improve expression in your target organism.
            </p>
            <p>
              Our algorithm selects codons based on usage frequency in your
              target organism. This can lead to improved protein expression,
              faster translation rates, and higher yields.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
