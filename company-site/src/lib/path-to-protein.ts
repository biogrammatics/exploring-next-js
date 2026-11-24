/**
 * Custom strain design ("path to protein") — catalogs, question set, construct
 * assembly and the submission schema.
 *
 * Ported from Tom Beardslee's design-wizard prototype. The vector and strain
 * catalogs in `src/data/path-to-protein/` are generated from the GenBank files
 * and the strain master sheet, so updating them is a file swap, not an edit
 * here.
 *
 * Deliberately NOT in the database yet: the `Vector` model has no column for
 * series / ARS / cloning window / unique cutters, and `PichiaStrain` has no
 * derived-trait columns. Adding them needs a migration, and migrations are
 * blocked until the baseline in AUDIT.md C4 / A6 is done. Until then these
 * files are the source of truth for the wizard only; the storefront catalog
 * continues to read the database.
 *
 * No pricing appears anywhere in this module, by design. A submission produces
 * a ServiceQuote for the team to price by hand.
 */

import { z } from "zod";
import vectorData from "@/data/path-to-protein/vectors.json";
import strainData from "@/data/path-to-protein/strains.json";

/* ------------------------------------------------------------------ *
 * Catalogs
 * ------------------------------------------------------------------ */

export interface VectorEntry {
  name: string;
  /** "J" = marker stays in the strain. "S" = marker is lox-flanked, removable. */
  series: "J" | "S";
  promoter: "aox1" | "upp" | "none";
  promoterLabel: string;
  marker: string;
  bp: number;
  ars: boolean;
  lox: boolean;
  /** Non-empty when the vector carries double-crossover homology arms. */
  arms: string;
  window: number | "";
  cutters: string;
  variant: "v2" | "targeted";
}

export interface StrainEntry {
  name: string;
  genotype: string;
  description: string;
  mutS: boolean;
  glyco: boolean;
  proteases: string[];
  silac: boolean;
  builtInMarkers: string[];
  /** True when the master sheet has no genotype; held out of the wizard. */
  incomplete: boolean;
}

export const VECTOR_CATALOG = vectorData as VectorEntry[];
export const STRAIN_CATALOG = strainData as StrainEntry[];

/** Strains with a genotype we can show. BG08 and BG13 are held out. */
export const OFFERED_STRAINS = STRAIN_CATALOG.filter((s) => !s.incomplete);

export const VARIANT_NOTE: Record<VectorEntry["variant"], string> = {
  v2: "Current version. Carries an ARS and a 300 bp cloning window.",
  targeted:
    "Carries double-crossover homology arms for targeted integration at a defined locus.",
};

/* ------------------------------------------------------------------ *
 * Secretion leaders
 * ------------------------------------------------------------------ */

/**
 * Mechanistic class of a leader. The recommended screen takes one from each,
 * because which route a given protein tolerates is not reliably predictable.
 */
export type LeaderClass = "nonsrp_pro" | "srp_pro" | "srp_nopro";

export const LEADER_CLASS_LABEL: Record<LeaderClass, string> = {
  nonsrp_pro: "Post-translational, with pro-peptide",
  srp_pro: "SRP-dependent, with pro-peptide",
  srp_nopro: "SRP-dependent, signal peptide only",
};

export interface SecretionLeader {
  /** Construct suffix, e.g. "-s1". */
  code: string;
  short: string;
  sigName: string;
  sigSeq: string;
  proName: string;
  proSeq: string;
  note: string;
  cls: LeaderClass;
  /** SRP arrest signal peptide. */
  arrest?: boolean;
}

export const SECRETION_LEADERS: SecretionLeader[] = [
  {
    code: "-s1", short: "s1",
    sigName: "Sc ⎩ signal peptide", sigSeq: "MRFPSIFTAVLFAASSALA",
    proName: "Sc ⎩ pro-peptide",
    proSeq: "APVNTTTEDETAQIPAEAVIGYLDLEGDFDVAVLPFSNSTNNGLLFINTTIASIAAKEEGVSLDKREAEA",
    note: "Kex2 cleaves after the KR at the end of the pro-peptide. Ends in EAEA — Ste13 trims this spacer, which can be incomplete and leave EA residues on a fraction of the product.",
    cls: "nonsrp_pro",
  },
  {
    code: "-s2", short: "s2",
    sigName: "Sc ⎩ signal peptide", sigSeq: "MRFPSIFTAVLFAASSALA",
    proName: "Sc ⎩ pro-peptide (KR)",
    proSeq: "APVNTTTEDETAQIPAEAVIGYLDLEGDFDVAVLPFSNSTNNGLLFINTTIASIAAKEEGVSLDKR",
    note: "Kex2 cleaves after the KR at the end of the pro-peptide. Ends directly at KR, so no Glu-Ala spacer has to be trimmed.",
    cls: "nonsrp_pro",
  },
  {
    code: "-s7", short: "s7",
    sigName: "Sc ⎩ signal peptide", sigSeq: "MRFPSIFTAVLFAASSALA",
    proName: "Sc ⎩ pro-peptide (Δ1)",
    proSeq: "APVNTTTEDETAQIPAEAVIGYLDLEGDFDVAVLPFSASIAAKEEGVSLDKREAEA",
    note: "Kex2 cleaves after the KR at the end of the pro-peptide. Ends in EAEA — Ste13 trims this spacer, which can be incomplete and leave EA residues on a fraction of the product.",
    cls: "nonsrp_pro",
  },
  {
    code: "-s3", short: "s3",
    sigName: "Sc OST1 signal peptide", sigSeq: "MRQVWFSWIVGLFLCFFNVSSA",
    proName: "Sc ⎩ pro-peptide",
    proSeq: "APVNTTTEDETAQIPAEAVIGYLDLEGDFDVAVLPFSNSTNNGLLFINTTIASIAAKEEGVSLDKREAEA",
    note: "Kex2 cleaves after the KR at the end of the pro-peptide. Ends in EAEA — Ste13 trims this spacer, which can be incomplete and leave EA residues on a fraction of the product.",
    cls: "srp_pro",
  },
  {
    code: "-s6", short: "s6",
    sigName: "Sc OST1 signal peptide", sigSeq: "MRQVWFSWIVGLFLCFFNVSSA",
    proName: "Sc ⎩ pro-peptide (KR)",
    proSeq: "APVNTTTEDETAQIPAEAVIGYLDLEGDFDVAVLPFSNSTNNGLLFINTTIASIAAKEEGVSLDKR",
    note: "Kex2 cleaves after the KR at the end of the pro-peptide. Ends directly at KR, so no Glu-Ala spacer has to be trimmed.",
    cls: "srp_pro",
  },
  {
    code: "-s4", short: "s4",
    sigName: "Sc OST1 signal peptide", sigSeq: "MRQVWFSWIVGLFLCFFNVSSA",
    proName: "", proSeq: "",
    note: "Signal peptide only, cleaved by signal peptidase in the ER; no pro-peptide and no Kex2 processing step.",
    cls: "srp_nopro",
  },
  {
    code: "-s5", short: "s5",
    sigName: "Sc AGA2 signal peptide", sigSeq: "MQLLRCFSIFSVIASVLA",
    proName: "", proSeq: "",
    note: "SRP arrest signal peptide, cleaved by signal peptidase in the ER; no pro-peptide and no Kex2 processing step.",
    cls: "srp_nopro", arrest: true,
  },
  {
    code: "-s8", short: "s8",
    sigName: "Pp HP signal peptide", sigSeq: "MLLGVLVLLFSHACA",
    proName: "", proSeq: "",
    note: "SRP arrest signal peptide, cleaved by signal peptidase in the ER; no pro-peptide and no Kex2 processing step.",
    cls: "srp_nopro", arrest: true,
  },
];

/**
 * House default screen: one leader from each mechanistic class.
 *
 * REVIEW NOTE: confirm this is the set we actually recommend before this
 * wording goes in front of customers (WIZARD_REVIEW.md, section 3).
 */
export const RECOMMENDED_LEADERS = ["s1", "s3", "s5"] as const;

export function leaderByShort(short: string): SecretionLeader | undefined {
  return SECRETION_LEADERS.find((l) => l.short === short);
}

/* ------------------------------------------------------------------ *
 * Tags
 * ------------------------------------------------------------------ */

export interface TagDefinition {
  id: string;
  name: string;
  seq: string;
  note: string;
  isLinker?: boolean;
  isCustom?: boolean;
}

export interface TagGroup {
  group: string;
  items: TagDefinition[];
}

/**
 * DRAFT CONTENT. Sequences are the common literature forms. The offered list
 * and the cleavage-scar wording are both open review items — see
 * WIZARD_REVIEW.md before treating this as approved copy.
 */
export const TAG_CATALOG: TagGroup[] = [
  {
    group: "Affinity / purification tags",
    items: [
      { id: "his6", name: "6xHis", seq: "HHHHHH", note: "IMAC (Ni/Co). Most common Pichia-compatible purification tag." },
      { id: "his8", name: "8xHis", seq: "HHHHHHHH", note: "Stronger IMAC binding than 6xHis." },
      { id: "his10", name: "10xHis", seq: "HHHHHHHHHH", note: "For difficult or low-abundance targets." },
      { id: "strep2", name: "Strep-tag II", seq: "WSHPQFEK", note: "Strep-Tactin purification; gentle elution." },
      { id: "twstrep", name: "Twin-Strep-tag", seq: "WSHPQFEKGGGSGGGSGGSAWSHPQFEK", note: "Higher affinity than single Strep-tag II." },
      { id: "flag", name: "FLAG", seq: "DYKDDDDK", note: "Anti-FLAG affinity and detection." },
      { id: "flag3", name: "3xFLAG", seq: "DYKDHDGDYKDHDIDYKDDDDK", note: "Higher sensitivity detection." },
      { id: "avi", name: "Avi-tag (biotinylation)", seq: "GLNDIFEAQKIEWHE", note: "Site-specific biotinylation; requires BirA (in vitro or co-expressed)." },
    ],
  },
  {
    group: "Epitope / detection tags",
    items: [
      { id: "myc", name: "c-Myc", seq: "EQKLISEEDL", note: "Anti-Myc 9E10 detection." },
      { id: "ha", name: "HA", seq: "YPYDVPDYA", note: "Anti-HA detection." },
      { id: "v5", name: "V5", seq: "GKPIPNPLLGLDST", note: "Anti-V5 detection." },
      { id: "stag", name: "S-tag", seq: "KETAAAKFERQHMDS", note: "S-protein detection/purification." },
    ],
  },
  {
    group: "Protease cleavage sites",
    items: [
      { id: "thrombin", name: "Thrombin site", seq: "LVPRGS", note: "Cleaves after LVPR, leaving GS on the downstream fragment." },
      { id: "tev", name: "TEV protease site", seq: "ENLYFQG", note: "Cleaves between Q and G; leaves a G (or S) scar." },
      { id: "hrv3c", name: "HRV 3C / PreScission site", seq: "LEVLFQGP", note: "Cleaves between Q and G; active at 4 degrees C." },
      { id: "fxa", name: "Factor Xa site", seq: "IEGR", note: "Cleaves after R, scarless." },
      { id: "ek", name: "Enterokinase site", seq: "DDDDK", note: "Cleaves after K, scarless." },
    ],
  },
  {
    group: "Linkers and other elements",
    items: [
      { id: "gs1", name: "Flexible linker (GGGGS)", seq: "GGGGS", note: "Short flexible spacer.", isLinker: true },
      { id: "gs3", name: "Flexible linker (GGGGS)x3", seq: "GGGGSGGGGSGGGGS", note: "Long flexible spacer.", isLinker: true },
      { id: "rigid", name: "Rigid linker (EAAAK)x2", seq: "EAAAKEAAAK", note: "Helical spacer that keeps domains apart.", isLinker: true },
      { id: "spytag", name: "SpyTag", seq: "AHIVMVDAYKPTK", note: "Covalent conjugation to SpyCatcher." },
      { id: "sortase", name: "Sortase A motif (LPETG)", seq: "LPETG", note: "Sortase-mediated ligation." },
      { id: "custom", name: "Custom / not listed", seq: "", note: "Enter your own sequence or describe what you need.", isCustom: true },
    ],
  },
];

export const ALL_TAGS: TagDefinition[] = TAG_CATALOG.flatMap((g) => g.items);

export function tagById(id: string): TagDefinition | undefined {
  return ALL_TAGS.find((t) => t.id === id);
}

export const TAG_POSITIONS = [
  { id: "n", label: "N-terminal" },
  { id: "c", label: "C-terminal" },
  { id: "other", label: "Other — I will specify" },
] as const;

export type TagPosition = (typeof TAG_POSITIONS)[number]["id"];

/* ------------------------------------------------------------------ *
 * Question sets
 * ------------------------------------------------------------------ */

export interface QuestionOption {
  v: string;
  l: string;
  n?: string;
}

export interface Question {
  label: string;
  hint?: string;
  options: QuestionOption[];
  /** Only shown when the AOX1 promoter was chosen. */
  onlyWhenAox1?: boolean;
}

export const VECTOR_QUESTIONS: Record<string, Question> = {
  arm: {
    label: "Will you need the antibiotic resistance marker removed later?",
    hint: "Marker removal lets the same antibiotic be reused for a second modification, and leaves the final strain without a resistance gene.",
    options: [
      { v: "no", l: "No — the marker can stay in the strain", n: "Our J-series vectors. The simplest route, and the right one for most production strains." },
      { v: "yes", l: "Yes — the marker must be removable", n: "Our S-series vectors carry the marker between lox sites so it can be excised afterwards. This adds steps to the project, and a few more decisions we will walk through with you." },
      { v: "any", l: "I am not sure — show me both" },
    ],
  },
  promoter: {
    label: "How should expression be driven?",
    options: [
      { v: "aox1", l: "Methanol-inducible (AOX1 promoter)", n: "Expression is off until methanol is added, which suits proteins that burden the cell or are toxic during growth." },
      { v: "upp", l: "Constitutive (UPP promoter)", n: "Expression runs throughout growth with no methanol handling, which simplifies fermentation and scale-up." },
      { v: "none", l: "I will supply my own promoter", n: "Promoterless backbones, for a promoter you provide or one we clone in for you." },
      { v: "any", l: "No preference — advise me" },
    ],
  },
  integration: {
    label: "How should the cassette integrate?",
    hint: "Targeted integration puts the cassette at a defined locus; random integration is the standard route and allows higher copy number.",
    options: [
      { v: "random", l: "Standard (random integration)", n: "The usual route. Screening picks the best clone from the resulting population." },
      { v: "targeted", l: "Targeted to a defined locus", n: "Our T-series vectors carry double-crossover homology arms. Fewer clones to screen and a defined genotype, at the cost of a narrower vector choice." },
      { v: "any", l: "No preference — advise me" },
    ],
  },
  marker: {
    label: "Antibiotic selection in Pichia",
    hint: "All four work well. Choose one you already use, or leave it to us.",
    options: [
      { v: "Zeocin", l: "Zeocin" },
      { v: "G418 (geneticin)", l: "G418 (geneticin)" },
      { v: "Hygromycin B", l: "Hygromycin B" },
      { v: "Nourseothricin (NTC)", l: "Nourseothricin (NTC)" },
      { v: "any", l: "No preference" },
    ],
  },
};

export const STRAIN_QUESTIONS: Record<string, Question> = {
  mut: {
    label: "Methanol utilization phenotype",
    hint: "Applies to the methanol-inducible AOX1 promoter you selected above.",
    onlyWhenAox1: true,
    options: [
      { v: "mutplus", l: "Standard (Mut+)", n: "Wild-type AOX1 locus and the fastest methanol utilization." },
      { v: "muts", l: "Methanol utilization slow (aox1Δ)", n: "Slower, more controlled induction and less heat generated in fermentation." },
      { v: "any", l: "No preference — advise me" },
    ],
  },
  protease: {
    label: "Protease-deficient host",
    hint: "Protease deletions can protect a sensitive product, and often come with slower growth or reduced robustness.",
    options: [
      { v: "no", l: "Not needed" },
      { v: "yes", l: "Yes — my protein is protease-sensitive", n: "We hold single and double deletion hosts (pep4, prb1, sub2, yps1) and will pick the combination that fits." },
      { v: "any", l: "Not sure — advise me" },
    ],
  },
  glyco: {
    label: "Glycosylation",
    hint: "Only relevant if your protein carries N-glycosylation sequons and is secreted.",
    options: [
      { v: "standard", l: "Standard Pichia glycosylation" },
      { v: "man5", l: "GlycoSwitch® Man5 host", n: "och1Δ with an ER-targeted mannosidase, giving Man5 rather than hyper-mannosylated glycans. Man5 is not a human-type glycan." },
      { v: "any", l: "Not applicable / advise me" },
    ],
  },
};

/* ------------------------------------------------------------------ *
 * Deliverables
 * ------------------------------------------------------------------ */

export interface Deliverable {
  id: string;
  level: number;
  included?: boolean;
  title: string;
  sub: string;
  body: string;
  gets: string[];
}

export const DELIVERABLES: Deliverable[] = [
  {
    id: "strain", level: 1, included: true,
    title: "WGS-validated expression strain",
    sub: "Included in every project",
    body: "We build the strain, confirm it by whole-genome sequencing, and ship it to you. Sequencing verifies that your expression cassette is present, intact and correct, and shows where it integrated and in how many copies.",
    gets: [
      "Glycerol stock of the validated production strain",
      "Whole-genome sequencing report covering cassette integrity, integration site and copy number",
      "Annotated sequence of the expression cassette as built",
      "Strain handling and induction protocol",
    ],
  },
  {
    id: "sse_gel", level: 2,
    title: "Small-scale expression trial with SDS-PAGE",
    sub: "Add-on",
    body: "We grow the strain under standard induction conditions and run the material on a stained SDS-PAGE gel, so you can see whether your protein is being made and roughly how much.",
    gets: [
      "Everything in the validated strain package",
      "Small-scale induction under standard conditions",
      "Coomassie-stained SDS-PAGE gel image",
      "Short written assessment of the result",
    ],
  },
  {
    id: "sse_gel_wb", level: 3,
    title: "Small-scale expression trial with SDS-PAGE and western blot",
    sub: "Add-on",
    body: "As above, with an immunoblot. Worth choosing when your protein is not abundant enough to identify confidently on a stained gel, or when you need to confirm identity rather than just see a band.",
    gets: [
      "Everything in the SDS-PAGE package",
      "Western blot against your tag or a supplied antibody",
      "Blot image alongside the stained gel",
      "Short written assessment of the result",
    ],
  },
  {
    id: "sse_multi", level: 4,
    title: "Small-scale expression testing multiple variables",
    sub: "Add-on",
    body: "Rather than one standard condition, we screen several, and report which gave the best result. Most projects screen two or three variables — tell us which matter to you and we will advise.",
    gets: [
      "Everything in the SDS-PAGE package",
      "Expression screened across the variables you select",
      "Comparative gel and blot data across conditions",
      "Recommendation of the best conditions found",
    ],
  },
  {
    id: "other", level: 5,
    title: "Something else — let's discuss",
    sub: "Add-on",
    body: "Fermentation development, purification, larger material amounts, analytics or anything else not listed. Describe what you need and our team will respond with options.",
    gets: [],
  },
];

export const SCREENING_VARIABLES = [
  { id: "clones", l: "Multiple independent clones" },
  { id: "copynumber", l: "Cassette copy number" },
  { id: "temperature", l: "Induction temperature" },
  { id: "medium", l: "Growth / induction medium" },
  { id: "ph", l: "Culture pH" },
  { id: "feed", l: "Methanol or alternative feed strategy" },
  { id: "duration", l: "Induction duration / time course" },
  { id: "leader", l: "Alternative secretion leaders" },
  { id: "host", l: "Alternative host backgrounds" },
] as const;

/* ------------------------------------------------------------------ *
 * Matching
 * ------------------------------------------------------------------ */

export interface VectorAnswers {
  arm: string;
  promoter: string;
  integration: string;
  marker: string;
}

export interface StrainAnswers {
  mut: string;
  protease: string;
  glyco: string;
  silac: boolean;
}

/** Vectors consistent with the customer's answers. May be empty. */
export function matchVectors(a: Partial<VectorAnswers>): VectorEntry[] {
  return VECTOR_CATALOG.filter((v) => {
    if (a.arm === "no" && v.series !== "J") return false;
    if (a.arm === "yes" && v.series !== "S") return false;
    if (a.promoter && a.promoter !== "any" && v.promoter !== a.promoter) return false;
    if (a.integration === "targeted" && v.variant !== "targeted") return false;
    if (a.integration === "random" && v.variant === "targeted") return false;
    if (a.marker && a.marker !== "any" && v.marker !== a.marker) return false;
    return true;
  });
}

/**
 * Host strains consistent with the customer's answers.
 *
 * `aox1Chosen` gates the methanol-phenotype filter: the Mut+/MutS distinction
 * is only meaningful when expression is driven by the AOX1 promoter.
 */
export function matchStrains(a: Partial<StrainAnswers>, aox1Chosen: boolean): StrainEntry[] {
  return OFFERED_STRAINS.filter((s) => {
    if (Boolean(a.silac) !== s.silac) return false;
    if (a.glyco === "man5" && !s.glyco) return false;
    if (a.glyco === "standard" && s.glyco) return false;
    if (a.protease === "yes" && s.proteases.length === 0) return false;
    if (a.protease === "no" && s.proteases.length > 0) return false;
    if (aox1Chosen && a.mut === "muts" && !s.mutS) return false;
    if (aox1Chosen && a.mut === "mutplus" && s.mutS) return false;
    return true;
  });
}

/**
 * The SILAC host carries its own resistance markers, so a vector using the
 * same antibiotic cannot be selected in it. Returns the clashing markers.
 */
export function silacMarkerClash(selectedMarker: string): string[] {
  const silacStrain = OFFERED_STRAINS.find((s) => s.silac);
  if (!silacStrain) return [];
  return silacStrain.builtInMarkers.filter((m) =>
    selectedMarker.toLowerCase().includes(m.toLowerCase())
  );
}

/* ------------------------------------------------------------------ *
 * Construct assembly
 * ------------------------------------------------------------------ */

export interface ConstructSegment {
  kind: "sig" | "pro" | "tag" | "linker" | "protein";
  name: string;
  seq: string;
}

export interface SelectedTag {
  tagId: string;
  position: TagPosition;
  /** Only meaningful for the "custom" tag. */
  customSeq?: string;
  customName?: string;
}

function tagSegment(t: SelectedTag): ConstructSegment | null {
  const def = tagById(t.tagId);
  if (!def) return null;
  const seq = def.isCustom ? (t.customSeq ?? "") : def.seq;
  const name = def.isCustom ? (t.customName || "Custom element") : def.name;
  return { kind: def.isLinker ? "linker" : "tag", name, seq };
}

/**
 * Order the construct: leader (signal, then pro-peptide), N-terminal tags in
 * the order given, the protein, then C-terminal tags.
 *
 * Tags positioned "other" are left out of the assembled sequence — the
 * customer describes those in free text and we resolve them by hand.
 */
export function assembleConstruct(
  proteinSequence: string,
  tags: SelectedTag[],
  leader: SecretionLeader | null
): ConstructSegment[] {
  const segments: ConstructSegment[] = [];

  if (leader) {
    segments.push({ kind: "sig", name: leader.sigName, seq: leader.sigSeq });
    if (leader.proSeq) {
      segments.push({ kind: "pro", name: leader.proName, seq: leader.proSeq });
    }
  }

  for (const t of tags.filter((x) => x.position === "n")) {
    const seg = tagSegment(t);
    if (seg) segments.push(seg);
  }

  segments.push({ kind: "protein", name: "Your protein", seq: proteinSequence });

  for (const t of tags.filter((x) => x.position === "c")) {
    const seg = tagSegment(t);
    if (seg) segments.push(seg);
  }

  return segments;
}

/** Full translated sequence of the assembled construct. */
export function constructSequence(segments: ConstructSegment[]): string {
  return segments.map((s) => s.seq).join("");
}

/* ------------------------------------------------------------------ *
 * Submission schema
 * ------------------------------------------------------------------ */

export const MAX_NOTES_LENGTH = 4000;
export const MAX_NAME_LENGTH = 200;
export const MAX_TAGS = 12;

const tagSchema = z.object({
  tagId: z.string().min(1).max(50),
  position: z.enum(["n", "c", "other"]),
  customSeq: z.string().max(500).optional(),
  customName: z.string().max(MAX_NAME_LENGTH).optional(),
});

/**
 * Contact block. `email` is optional here because a signed-in customer falls
 * back to their account address; the route enforces that a guest supplies one.
 * Validation of the address itself is `isValidEmail` in `identity.ts`, so that
 * every entry point agrees on what an address is.
 */
const contactSchema = z.object({
  email: z.string().max(254).optional(),
  fullName: z.string().max(MAX_NAME_LENGTH).optional(),
  organization: z.string().max(MAX_NAME_LENGTH).optional(),
  phone: z.string().max(50).optional(),
  notes: z.string().max(MAX_NOTES_LENGTH).optional(),
});

export const designSubmissionSchema = z.object({
  projectName: z.string().max(MAX_NAME_LENGTH).optional(),
  proteinName: z.string().max(MAX_NAME_LENGTH).optional(),
  sourceOrganism: z.string().max(MAX_NAME_LENGTH).optional(),
  proteinSequence: z.string().min(1),
  tags: z.array(tagSchema).max(MAX_TAGS).default([]),
  format: z.object({
    mode: z.enum(["secreted", "intracellular", "undecided"]),
    leaders: z.array(z.string().max(10)).max(SECRETION_LEADERS.length).default([]),
    nterm: z.string().max(40).optional(),
    glyc: z.string().max(40).optional(),
    protease: z.string().max(40).optional(),
    solubility: z.string().max(40).optional(),
  }),
  vector: z.object({
    arm: z.string().max(20).optional(),
    promoter: z.string().max(20).optional(),
    integration: z.string().max(20).optional(),
    marker: z.string().max(60).optional(),
  }),
  strain: z.object({
    mut: z.string().max(20).optional(),
    protease: z.string().max(20).optional(),
    glyco: z.string().max(20).optional(),
    silac: z.boolean().default(false),
  }),
  deliverable: z.string().max(40).optional(),
  screeningVariables: z.array(z.string().max(40)).max(SCREENING_VARIABLES.length).default([]),
  contact: contactSchema,
});

export type DesignSubmission = z.infer<typeof designSubmissionSchema>;

/**
 * Human-readable summary of a submitted design, for the quote record and the
 * team's review email. Kept here so the admin view and the notification agree.
 */
export function summarizeDesign(d: DesignSubmission, sequenceLength: number): string {
  const lines: string[] = [];
  const q = (set: Record<string, Question>, key: string, value: string | undefined) =>
    set[key]?.options.find((o) => o.v === value)?.l ?? value ?? "not answered";

  lines.push(`Protein: ${d.proteinName || "unnamed"} (${sequenceLength} aa)`);
  if (d.sourceOrganism) lines.push(`Source organism: ${d.sourceOrganism}`);

  lines.push(`Format: ${d.format.mode}`);
  if (d.format.mode === "secreted" && d.format.leaders.length > 0) {
    lines.push(`Leaders requested: ${d.format.leaders.join(", ")}`);
  }

  if (d.tags.length > 0) {
    const described = d.tags.map((t) => {
      const def = tagById(t.tagId);
      const name = def?.isCustom ? t.customName || "custom" : def?.name ?? t.tagId;
      return `${name} (${t.position})`;
    });
    lines.push(`Tags: ${described.join(", ")}`);
  }

  lines.push(`Vector — marker removal: ${q(VECTOR_QUESTIONS, "arm", d.vector.arm)}`);
  lines.push(`Vector — promoter: ${q(VECTOR_QUESTIONS, "promoter", d.vector.promoter)}`);
  lines.push(`Vector — integration: ${q(VECTOR_QUESTIONS, "integration", d.vector.integration)}`);
  lines.push(`Vector — marker: ${d.vector.marker ?? "no preference"}`);

  lines.push(`Host — protease: ${q(STRAIN_QUESTIONS, "protease", d.strain.protease)}`);
  lines.push(`Host — glycosylation: ${q(STRAIN_QUESTIONS, "glyco", d.strain.glyco)}`);
  if (d.vector.promoter === "aox1") {
    lines.push(`Host — methanol phenotype: ${q(STRAIN_QUESTIONS, "mut", d.strain.mut)}`);
  }
  if (d.strain.silac) lines.push("Host — SILAC labelling required");

  const matchedVectors = matchVectors(d.vector as Partial<VectorAnswers>);
  const matchedStrains = matchStrains(
    d.strain as Partial<StrainAnswers>,
    d.vector.promoter === "aox1"
  );
  lines.push(
    `Matching vectors (${matchedVectors.length}): ${matchedVectors.map((v) => v.name).join(", ") || "none — needs review"}`
  );
  lines.push(
    `Matching hosts (${matchedStrains.length}): ${matchedStrains.map((s) => s.name).join(", ") || "none — needs review"}`
  );

  const deliverable = DELIVERABLES.find((x) => x.id === d.deliverable);
  lines.push(`Deliverable: ${deliverable?.title ?? "not selected"}`);
  if (d.screeningVariables.length > 0) {
    const labels = d.screeningVariables
      .map((id) => SCREENING_VARIABLES.find((v) => v.id === id)?.l ?? id)
      .join(", ");
    lines.push(`Screening variables: ${labels}`);
  }

  return lines.join("\n");
}
