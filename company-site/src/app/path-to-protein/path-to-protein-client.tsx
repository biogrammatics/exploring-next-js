"use client";

import { useMemo, useState } from "react";
import {
  SECRETION_LEADERS,
  LEADER_CLASS_LABEL,
  RECOMMENDED_LEADERS,
  TAG_CATALOG,
  TAG_POSITIONS,
  VECTOR_QUESTIONS,
  STRAIN_QUESTIONS,
  DELIVERABLES,
  SCREENING_VARIABLES,
  assembleConstruct,
  constructSequence,
  matchVectors,
  matchStrains,
  silacMarkerClash,
  leaderByShort,
  tagById,
  type SelectedTag,
  type TagPosition,
  type Question,
} from "@/lib/path-to-protein";
import { analyzeProtein, formatMass } from "@/lib/protein-analysis";

export interface ContactPrefill {
  email?: string;
  fullName?: string;
  phone?: string;
}

interface Props {
  prefill: ContactPrefill;
  signedIn: boolean;
  isTeamLogin: boolean;
}

const STEPS = [
  "Protein and tags",
  "Expression format",
  "Vector and strain",
  "Deliverables",
  "Review and submit",
];

const EXAMPLE_SEQUENCE =
  "MKVLILACLVALALARELEELNVPGEIVESLSSSEESITRINKKIEKFQSEEQQQTEDELQDKIHPFAQTQSLVYPFPGPIPNSLPQNIPPLTQTPVVVPPFLQPEVMGVSKVKEAMAPKHKEMPFPKYPVEPFTESQSLTLTDVENLHLPLPLLQSWMHQPHQPLPPTVMFPPQSVLSLSQSKVLPVPQKAVPYPQRDMPIQAFLLYQEPVLGPVRGPFPIIV";

export default function PathToProteinClient({ prefill, signedIn, isTeamLogin }: Props) {
  const [step, setStep] = useState(1);

  // Step 1
  const [projectName, setProjectName] = useState("");
  const [proteinName, setProteinName] = useState("");
  const [sourceOrganism, setSourceOrganism] = useState("");
  const [sequence, setSequence] = useState("");
  const [tags, setTags] = useState<SelectedTag[]>([]);

  // Step 2
  const [mode, setMode] = useState<"secreted" | "intracellular" | "undecided" | "">("");
  const [leaders, setLeaders] = useState<string[]>([]);
  const [nterm, setNterm] = useState("");
  const [glyc, setGlyc] = useState("");
  const [formatProtease, setFormatProtease] = useState("");
  const [solubility, setSolubility] = useState("");

  // Step 3
  const [vector, setVector] = useState<Record<string, string>>({});
  const [strain, setStrain] = useState<Record<string, string>>({});
  const [silac, setSilac] = useState(false);

  // Step 4
  const [deliverable, setDeliverable] = useState("");
  const [screening, setScreening] = useState<string[]>([]);

  // Step 5
  const [email, setEmail] = useState(prefill.email ?? "");
  const [fullName, setFullName] = useState(prefill.fullName ?? "");
  const [organization, setOrganization] = useState("");
  const [phone, setPhone] = useState(prefill.phone ?? "");
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ quoteNumber: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const analysis = useMemo(() => analyzeProtein(sequence), [sequence]);
  const aox1Chosen = vector.promoter === "aox1";

  const matchedVectors = useMemo(() => matchVectors(vector), [vector]);
  const matchedStrains = useMemo(
    () => matchStrains({ ...strain, silac }, aox1Chosen),
    [strain, silac, aox1Chosen]
  );
  const markerClash = useMemo(
    () => (silac && vector.marker ? silacMarkerClash(vector.marker) : []),
    [silac, vector.marker]
  );

  const previewLeaders = useMemo(() => {
    if (mode !== "secreted") return [null];
    if (leaders.length === 0) return [null];
    return leaders.map((s) => leaderByShort(s) ?? null);
  }, [mode, leaders]);

  function toggle(list: string[], value: string): string[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  function addTag() {
    setTags((t) => [...t, { tagId: "his6", position: "c" }]);
  }
  function updateTag(i: number, patch: Partial<SelectedTag>) {
    setTags((t) => t.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }
  function removeTag(i: number) {
    setTags((t) => t.filter((_, j) => j !== i));
  }
  function moveTag(i: number, dir: -1 | 1) {
    setTags((t) => {
      const j = i + dir;
      if (j < 0 || j >= t.length) return t;
      const copy = [...t];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function submit() {
    setSubmitting(true);
    setErrors([]);
    try {
      const res = await fetch("/api/path-to-protein", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: projectName || undefined,
          proteinName: proteinName || undefined,
          sourceOrganism: sourceOrganism || undefined,
          proteinSequence: sequence,
          tags,
          format: {
            mode: mode || "undecided",
            leaders,
            nterm: nterm || undefined,
            glyc: glyc || undefined,
            protease: formatProtease || undefined,
            solubility: solubility || undefined,
          },
          vector,
          strain: { ...strain, silac },
          deliverable: deliverable || undefined,
          screeningVariables: screening,
          contact: {
            email: email || undefined,
            fullName: fullName || undefined,
            organization: organization || undefined,
            phone: phone || undefined,
            notes: notes || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(
          Array.isArray(data.details) && data.details.length > 0
            ? data.details.map(String)
            : [data.error ?? "Submission failed"]
        );
        return;
      }
      setResult({ quoteNumber: data.quoteNumber });
    } catch {
      setErrors(["Could not reach the server. Please try again."]);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-semibold text-gray-900">Request received</h1>
        <p className="mt-4 text-gray-700">
          Thank you. Your design has been sent to our team, who review every request
          by hand and will reply by email with a quote and any questions.
        </p>
        <p className="mt-4 rounded-md bg-gray-50 p-4 font-mono text-sm text-gray-800">
          Reference: {result.quoteNumber}
        </p>
        <p className="mt-4 text-sm text-gray-600">
          We have your address as <strong>{email || prefill.email}</strong>. Nothing
          has been charged and no commitment has been made.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-900">
          Design a custom Pichia strain
        </h1>
        <p className="mt-3 max-w-2xl text-gray-700">
          Tell us about your protein and we will design and build a
          whole-genome-sequenced <em>Komagataella phaffii</em> expression strain.
          No pricing is shown here — our team reviews every request by hand and
          replies by email with a quote.
        </p>
      </header>

      <ol className="mb-8 flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, i) => {
          const n = i + 1;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => setStep(n)}
                className={`rounded-full px-3 py-1 ${
                  n === step
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {n}. {label}
              </button>
            </li>
          );
        })}
      </ol>

      {/* ---------------- Step 1 ---------------- */}
      {step === 1 && (
        <Section title="Your protein">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Project name (optional)">
              <input className={inputClass} value={projectName}
                onChange={(e) => setProjectName(e.target.value)} />
            </Field>
            <Field label="Protein name">
              <input className={inputClass} value={proteinName}
                onChange={(e) => setProteinName(e.target.value)} />
            </Field>
            <Field label="Source organism (optional)">
              <input className={inputClass} value={sourceOrganism}
                onChange={(e) => setSourceOrganism(e.target.value)} />
            </Field>
          </div>

          <Field label="Amino acid sequence">
            <textarea
              className={`${inputClass} h-40 font-mono text-xs`}
              placeholder="Paste the mature protein sequence, with or without a FASTA header"
              value={sequence}
              onChange={(e) => setSequence(e.target.value)}
            />
            <button type="button" className={linkClass}
              onClick={() => setSequence(EXAMPLE_SEQUENCE)}>
              Load example
            </button>
          </Field>

          {analysis.length > 0 && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm">
              {analysis.looksLikeNucleotide && (
                <p className="mb-3 rounded bg-amber-50 p-2 text-amber-900">
                  This looks like a DNA sequence. This box expects amino acids —
                  if you have a gene, our codon optimizer is the other way round.
                </p>
              )}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                <Stat label="Length" value={`${analysis.length} aa`} />
                <Stat label="Mass" value={formatMass(analysis.molecularWeightDa)} />
                <Stat label="pI" value={analysis.isoelectricPoint?.toFixed(2) ?? "—"} />
                <Stat label="Cysteines" value={String(analysis.cysteineCount)} />
              </dl>
              <ul className="mt-3 space-y-1 text-gray-700">
                <li>
                  <strong>{analysis.glycosylationSequons.length}</strong> N-glycosylation
                  sequon{analysis.glycosylationSequons.length === 1 ? "" : "s"} (N-X-S/T)
                  {analysis.glycosylationSequons.length > 0 && (
                    <span className="text-gray-500">
                      {" "}
                      at {analysis.glycosylationSequons.map((g) => g.position).join(", ")}
                    </span>
                  )}
                </li>
                <li>
                  <strong>{analysis.kex2Sites.length}</strong> internal dibasic
                  (Kex2) site{analysis.kex2Sites.length === 1 ? "" : "s"}
                  {analysis.kex2Sites.length > 0 && (
                    <span className="text-gray-500">
                      {" "}
                      at {analysis.kex2Sites.map((k) => k.position).join(", ")} — worth
                      discussing if the protein is secreted
                    </span>
                  )}
                </li>
              </ul>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Tags and cleavage sites</h3>
              <button type="button" className={buttonClass} onClick={addTag}>
                Add element
              </button>
            </div>
            {tags.length === 0 && (
              <p className="text-sm text-gray-600">
                None. Add affinity tags, epitope tags, protease sites or linkers,
                and put them in the order you want them built.
              </p>
            )}
            <div className="space-y-2">
              {tags.map((t, i) => {
                const def = tagById(t.tagId);
                return (
                  <div key={i} className="rounded-md border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <select className={inputClass} value={t.tagId}
                        onChange={(e) => updateTag(i, { tagId: e.target.value })}>
                        {TAG_CATALOG.map((g) => (
                          <optgroup key={g.group} label={g.group}>
                            {g.items.map((item) => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      <select className={inputClass} value={t.position}
                        onChange={(e) =>
                          updateTag(i, { position: e.target.value as TagPosition })}>
                        {TAG_POSITIONS.map((p) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>
                      <button type="button" className={linkClass} onClick={() => moveTag(i, -1)}>Up</button>
                      <button type="button" className={linkClass} onClick={() => moveTag(i, 1)}>Down</button>
                      <button type="button" className={linkClass} onClick={() => removeTag(i)}>Remove</button>
                    </div>
                    {def?.isCustom && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <input className={inputClass} placeholder="Name"
                          value={t.customName ?? ""}
                          onChange={(e) => updateTag(i, { customName: e.target.value })} />
                        <input className={`${inputClass} font-mono`} placeholder="Sequence (optional)"
                          value={t.customSeq ?? ""}
                          onChange={(e) => updateTag(i, { customSeq: e.target.value })} />
                      </div>
                    )}
                    {def && !def.isCustom && (
                      <p className="mt-2 text-xs text-gray-600">
                        <span className="font-mono">{def.seq}</span> — {def.note}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}

      {/* ---------------- Step 2 ---------------- */}
      {step === 2 && (
        <Section title="Expression format">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { v: "secreted", l: "Secreted", n: "The protein is exported to the medium, which usually simplifies purification." },
              { v: "intracellular", l: "Intracellular", n: "The protein stays in the cell; recovery needs lysis and there is no Kex2 processing." },
              { v: "undecided", l: "Not sure — advise me", n: "We will review your sequence and propose a format with your quote." },
            ].map((o) => (
              <Card key={o.v} selected={mode === o.v} onClick={() => setMode(o.v as typeof mode)}>
                <strong>{o.l}</strong>
                <span className="mt-1 block text-xs text-gray-600">{o.n}</span>
              </Card>
            ))}
          </div>

          {mode === "secreted" && (
            <>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <strong>Our recommendation:</strong> pick three leaders, one from each
                class — our usual set is {RECOMMENDED_LEADERS.join(", ")}. Which route a
                given protein tolerates is not reliably predictable, so testing a
                post-translational leader alongside two SRP-dependent routes costs far
                less than discovering the problem after a single construct underperforms.
                <button type="button" className="mt-2 block underline"
                  onClick={() => setLeaders([...RECOMMENDED_LEADERS])}>
                  Use our recommended set
                </button>
              </div>

              <div className="space-y-2">
                {SECRETION_LEADERS.map((l) => (
                  <label key={l.short}
                    className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
                      leaders.includes(l.short)
                        ? "border-gray-900 bg-gray-50"
                        : "border-gray-200"
                    }`}>
                    <input type="checkbox" checked={leaders.includes(l.short)}
                      onChange={() => setLeaders((v) => toggle(v, l.short))} />
                    <span className="text-sm">
                      <strong>{l.short}</strong>
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                        {LEADER_CLASS_LABEL[l.cls]}
                      </span>
                      <span className="mt-1 block text-gray-700">
                        {l.sigName}{l.proName ? ` + ${l.proName}` : ""}
                      </span>
                      <span className="mt-1 block text-xs text-gray-600">{l.note}</span>
                    </span>
                  </label>
                ))}
              </div>

              <Radios label="N-terminal requirement" value={nterm} onChange={setNterm}
                options={[
                  { v: "authentic", l: "Authentic N-terminus required — no extra residues" },
                  { v: "tolerant", l: "A few extra residues (e.g. EA, EAEA) are acceptable" },
                  { v: "nopref", l: "No preference — optimize for yield" },
                ]} />
              <Radios label="N-glycosylation preference" value={glyc} onChange={setGlyc}
                options={[
                  { v: "standard", l: "Standard Pichia glycosylation is acceptable" },
                  { v: "reduced", l: "I would prefer reduced / engineered glycosylation" },
                  { v: "remove", l: "I would like advice on removing the sequons" },
                  {
                    v: "na",
                    l: "Not applicable — my protein has no sequons",
                    n: analysis.glycosylationSequons.length > 0
                      ? `We detected ${analysis.glycosylationSequons.length} sequon(s) in your sequence — worth a second look.`
                      : undefined,
                  },
                ]} />
              <Radios label="Has proteolysis been a problem?" value={formatProtease}
                onChange={setFormatProtease}
                options={[
                  { v: "known", l: "Yes — this protein has been degraded before" },
                  { v: "none", l: "No known problem" },
                  { v: "unknown", l: "Not sure" },
                ]} />
            </>
          )}

          {mode === "intracellular" && (
            <Radios label="Solubility strategy" value={solubility} onChange={setSolubility}
              options={[
                { v: "none", l: "No fusion partner needed" },
                { v: "fusion", l: "Use a solubility fusion partner" },
                { v: "recommend", l: "BioGrammatics recommendation", n: "We will propose a strategy with your quote." },
              ]} />
          )}

          {sequence && mode && (
            <div>
              <h3 className="mb-2 font-medium text-gray-900">Construct preview</h3>
              <div className="space-y-2">
                {previewLeaders.map((l, i) => {
                  const segs = assembleConstruct(sequence.replace(/\s+/g, "").toUpperCase(), tags, l);
                  return (
                    <div key={i} className="rounded-md border border-gray-200 p-3 text-xs">
                      <div className="mb-1 font-medium text-gray-900">
                        {proteinName || "Construct"}{l ? l.code : ""}
                        <span className="ml-2 font-normal text-gray-600">
                          {constructSequence(segs).length} aa
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {segs.map((s, j) => (
                          <span key={j}
                            className={`rounded px-1.5 py-0.5 ${
                              s.kind === "protein" ? "bg-emerald-100 text-emerald-900"
                                : s.kind === "sig" ? "bg-sky-100 text-sky-900"
                                : s.kind === "pro" ? "bg-indigo-100 text-indigo-900"
                                : s.kind === "linker" ? "bg-gray-100 text-gray-700"
                                : "bg-amber-100 text-amber-900"
                            }`}>
                            {s.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ---------------- Step 3 ---------------- */}
      {step === 3 && (
        <Section title="Vector and host strain">
          {Object.entries(VECTOR_QUESTIONS).map(([key, q]) => (
            <QuestionBlock key={key} q={q} value={vector[key] ?? ""}
              onChange={(v) => setVector((s) => ({ ...s, [key]: v }))} />
          ))}

          <MatchList title="Matching vectors" names={matchedVectors.map((v) => v.name)} />

          <hr className="my-6 border-gray-200" />

          {Object.entries(STRAIN_QUESTIONS).map(([key, q]) => {
            if (q.onlyWhenAox1 && !aox1Chosen) return null;
            return (
              <QuestionBlock key={key} q={q} value={strain[key] ?? ""}
                onChange={(v) => setStrain((s) => ({ ...s, [key]: v }))} />
            );
          })}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={silac}
              onChange={(e) => setSilac(e.target.checked)} />
            SILAC (stable isotope) labelling with arginine and/or lysine
          </label>

          {markerClash.length > 0 && (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Marker clash.</strong> Our SILAC host already carries{" "}
              {markerClash.join(" and ")} resistance, so a vector using that antibiotic
              cannot be selected in it. Choose a different selection above, or we will
              propose an alternative.
            </p>
          )}

          <MatchList title="Matching host strains" names={matchedStrains.map((s) => s.name)} />
        </Section>
      )}

      {/* ---------------- Step 4 ---------------- */}
      {step === 4 && (
        <Section title="Deliverables">
          <div className="space-y-3">
            {DELIVERABLES.map((d) => (
              <div key={d.id}
                className={`rounded-md border p-4 ${
                  d.included
                    ? "border-emerald-200 bg-emerald-50"
                    : deliverable === d.id
                      ? "border-gray-900 bg-gray-50"
                      : "border-gray-200"
                }`}>
                <label className="flex cursor-pointer items-start gap-3">
                  {!d.included && (
                    <input type="radio" name="deliverable" checked={deliverable === d.id}
                      onChange={() => setDeliverable(d.id)} className="mt-1" />
                  )}
                  <span>
                    <strong className="text-gray-900">{d.title}</strong>
                    <span className="ml-2 text-xs text-gray-600">{d.sub}</span>
                    <span className="mt-1 block text-sm text-gray-700">{d.body}</span>
                    {d.gets.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-xs text-gray-600">
                        {d.gets.map((g) => <li key={g}>{g}</li>)}
                      </ul>
                    )}
                  </span>
                </label>
              </div>
            ))}
          </div>

          {deliverable === "sse_multi" && (
            <div>
              <h3 className="mb-1 font-medium text-gray-900">Which variables matter?</h3>
              <p className="mb-2 text-sm text-gray-600">
                Most projects screen two or three. Tell us what matters and we will
                advise on the rest.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SCREENING_VARIABLES.map((v) => (
                  <label key={v.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={screening.includes(v.id)}
                      onChange={() => setScreening((s) => toggle(s, v.id))} />
                    {v.l}
                  </label>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ---------------- Step 5 ---------------- */}
      {step === 5 && (
        <Section title="Review and submit">
          <dl className="divide-y divide-gray-200 rounded-md border border-gray-200 text-sm">
            <Row k="Protein" v={`${proteinName || "unnamed"} (${analysis.length} aa)`} />
            <Row k="Format" v={mode || "not chosen"} />
            {mode === "secreted" && (
              <Row k="Leaders" v={leaders.length ? leaders.join(", ") : "none chosen"} />
            )}
            <Row k="Tags" v={tags.length
              ? tags.map((t) => tagById(t.tagId)?.name ?? t.tagId).join(", ")
              : "none"} />
            <Row k="Matching vectors" v={matchedVectors.map((v) => v.name).join(", ") || "none — we will advise"} />
            <Row k="Matching hosts" v={matchedStrains.map((s) => s.name).join(", ") || "none — we will advise"} />
            <Row k="Deliverable" v={DELIVERABLES.find((d) => d.id === deliverable)?.title ?? "validated strain only"} />
          </dl>

          <div>
            <h3 className="mb-1 font-medium text-gray-900">Your contact details</h3>
            {isTeamLogin ? (
              <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                You are signed in through a shared team login, so we cannot assume the
                account address is yours. Please enter the address the quote should go to.
              </p>
            ) : signedIn ? (
              <p className="mb-3 text-sm text-gray-600">
                Pre-filled from your account. Change the address if the quote should go
                somewhere else.
              </p>
            ) : (
              <p className="mb-3 text-sm text-gray-600">
                You do not need an account. We only use these details to send your quote.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email">
                <input type="email" className={inputClass} value={email}
                  placeholder="you@institution.edu"
                  onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Name">
                <input className={inputClass} value={fullName}
                  onChange={(e) => setFullName(e.target.value)} />
              </Field>
              <Field label="Organization">
                <input className={inputClass} value={organization}
                  onChange={(e) => setOrganization(e.target.value)} />
              </Field>
              <Field label="Phone (optional)">
                <input className={inputClass} value={phone}
                  onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </div>

            <Field label="Anything else we should know?">
              <textarea className={`${inputClass} h-24`} value={notes}
                placeholder="Timelines, confidentiality requirements, related projects, prior expression attempts"
                onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

          <p className="rounded-md bg-gray-50 p-3 text-sm text-gray-700">
            Your sequence and project details are treated as confidential and are used
            only to prepare your quote. Nothing is charged and no commitment is made by
            submitting this form.
          </p>

          {errors.length > 0 && (
            <ul className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}

          <button type="button" disabled={submitting || !sequence}
            onClick={submit}
            className="rounded-md bg-gray-900 px-5 py-2.5 text-white disabled:opacity-50">
            {submitting ? "Sending…" : "Send to our team"}
          </button>
        </Section>
      )}

      <nav className="mt-8 flex justify-between border-t border-gray-200 pt-4">
        <button type="button" className={buttonClass} disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}>
          Back
        </button>
        <button type="button" className={buttonClass} disabled={step === STEPS.length}
          onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}>
          Next
        </button>
      </nav>
    </main>
  );
}

/* ----------------------------- small pieces ----------------------------- */

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none";
const buttonClass =
  "rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40";
const linkClass = "text-sm text-blue-700 underline";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-gray-800">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-600">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
  );
}

function Card({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-md border p-3 text-left text-sm ${
        selected ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:bg-gray-50"
      }`}>
      {children}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-4 px-4 py-2">
      <dt className="w-40 shrink-0 text-gray-600">{k}</dt>
      <dd className="text-gray-900">{v}</dd>
    </div>
  );
}

function MatchList({ title, names }: { title: string; names: string[] }) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
      <strong className="text-gray-900">{title}</strong>{" "}
      <span className="text-gray-600">({names.length})</span>
      <p className="mt-1 font-mono text-xs text-gray-700">
        {names.length > 0
          ? names.join(", ")
          : "Nothing in our catalog matches that combination — send the request anyway and we will advise."}
      </p>
    </div>
  );
}

function Radios({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string; n?: string }[];
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-gray-800">{label}</legend>
      {options.map((o) => (
        <label key={o.v} className="flex items-start gap-2 text-sm">
          <input type="radio" checked={value === o.v} onChange={() => onChange(o.v)}
            className="mt-1" />
          <span>
            {o.l}
            {o.n && <span className="mt-0.5 block text-xs text-gray-600">{o.n}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function QuestionBlock({
  q, value, onChange,
}: { q: Question; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="font-medium text-gray-900">{q.label}</legend>
      {q.hint && <p className="text-sm text-gray-600">{q.hint}</p>}
      <div className="space-y-2">
        {q.options.map((o) => (
          <label key={o.v} className="flex items-start gap-2 text-sm">
            <input type="radio" checked={value === o.v} onChange={() => onChange(o.v)}
              className="mt-1" />
            <span>
              {o.l}
              {o.n && <span className="mt-0.5 block text-xs text-gray-600">{o.n}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
