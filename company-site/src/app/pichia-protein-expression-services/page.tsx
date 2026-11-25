import type { Metadata } from "next";
import Link from "next/link";

/**
 * The definitive Pichia CRO services page.
 *
 * Copy is lifted from CRO_SERVICES_PAGE.md (drafted 24 Nov 2026) which in turn
 * was sourced from the vector, strain, leader, tag and deliverable catalogues in
 * src/lib/path-to-protein.ts — so the specifics on this page are evidenced by
 * what the business actually offers, not invented.
 *
 * The September/November 2026 AI-search review found BioGrammatics absent from
 * Google's AI Overview for "can you find me a CRO for Pichia expression?" while
 * four competitors were named. The tables below are the part that matters: they
 * are what let an AI system produce a paragraph about BioGrammatics comparable
 * to the ones it produced for VALIDOGEN, Kemp, Isomerase and Profacgen. If
 * anything is cut for length, cut prose, not the design-options table.
 *
 * Claims deliberately NOT made here, pending sign-off (CRO_SERVICES_PAGE.md
 * "Claims needing your sign-off"):
 *   - Fermentation scale. The review mentions an in-house 3 L bioreactor from
 *     "prior company context" that is not evidenced anywhere in this repo, so
 *     fermentation is offered "on discussion" with no number. A concrete scale
 *     is worth more than a vague offer — add it once confirmed.
 *   - Research cell banking. No basis for it in the codebase; omitted entirely.
 *   - Founding year and location ("founded 2008, Carlsbad, California" per the
 *     transcript). Unverified, so omitted — a wrong founding date on a CRO page
 *     is worse than a missing one. This is exactly the concrete detail that
 *     helps an AI characterize a company, so it is worth confirming.
 *   - Turnaround times and pricing. Kemp publishes a 4–6 week feasibility
 *     window and timelines help buyers self-qualify, but omit beats a number
 *     that cannot be met.
 *   - "Two decades" is carried over from the existing homepage copy.
 *   - GlycoSwitch® is used as a registered trademark below. Confirm the licence
 *     permits advertising it here and whether an attribution line is required.
 *   - SILAC hosts are in the strain catalogue; confirm they are offered as a
 *     service rather than held internally.
 */

/**
 * Where "Discuss your project with a scientist" goes.
 *
 * The strain design wizard is the only working project-enquiry route today: it
 * creates a quote request and notifies ADMIN_EMAIL via quote-notification.ts,
 * so an enquiry does reach a person. The draft notes a direct enquiry form or
 * mailto would be better, and there is no public contact address anywhere in
 * the repo to use instead. Swap this one constant when that route exists.
 *
 * Note the review's requirement is satisfied either way: everything a buyer
 * needs to evaluate BioGrammatics is readable on this page without anyone
 * touching the interactive tool.
 */
const PROJECT_ENQUIRY_HREF = "/path-to-protein";

export const metadata: Metadata = {
  // The root layout appends " | BioGrammatics", producing the full target:
  // "Pichia Protein Expression CRO | Custom Strain Development | BioGrammatics"
  title: "Pichia Protein Expression CRO | Custom Strain Development",
  description:
    "BioGrammatics provides custom Pichia pastoris protein expression services: strain engineering, expression feasibility studies, secretion optimization and whole-genome-sequenced production strains.",
  alternates: { canonical: "/pichia-protein-expression-services" },
};

const SERVICES = [
  {
    title: "Expression feasibility studies",
    body: [
      "Evaluate a new protein target in Pichia before committing to a full programme. We design and build the expression construct, generate strains, and test whether your protein is made — and if it is secreted, whether it leaves the cell intact.",
      "You get a clear answer and the strain that produced it, not just a report.",
    ],
  },
  {
    title: "Custom strain development",
    body: [
      "Design and construction of expression strains to your specification: promoter, secretion leader, tags, selection marker, integration strategy and host background. Every strain we deliver is confirmed by whole-genome sequencing before it ships.",
    ],
  },
  {
    title: "Secretion and yield optimization",
    body: [
      "If your protein expresses poorly, or not at all, the cause is usually identifiable. We screen secretion leaders, cassette copy number, host background, induction temperature, medium, pH, feed strategy and induction duration, and report which combination performed best and by how much.",
      "This applies to strains we built and to strains you already have.",
    ],
  },
  {
    title: "Strain characterization",
    body: [
      "Whole-genome sequencing of the delivered strain, confirming that the expression cassette is present, intact and correct, and establishing where it integrated and in how many copies. Supplied as a written report with the annotated cassette sequence as built.",
    ],
  },
];

const DELIVERABLES = [
  {
    name: "Sequence-verified expression strain",
    detail:
      "Glycerol stock of the production strain; whole-genome sequencing report covering cassette integrity, integration site and copy number; annotated sequence of the expression cassette as built; strain handling and induction protocol.",
  },
  {
    name: "Small-scale expression trial",
    detail:
      "Induction under standard conditions with a Coomassie-stained SDS-PAGE gel and a written assessment of the result.",
  },
  {
    name: "Expression trial with immunoblot",
    detail:
      "As above, plus a western blot against your tag or a supplied antibody — for proteins not abundant enough to identify confidently on a stained gel, or where identity must be confirmed.",
  },
  {
    name: "Multi-variable expression screen",
    detail:
      "Expression screened across the variables that matter to your target, with comparative gel and blot data and a recommendation of the best conditions found.",
  },
];

const DESIGN_OPTIONS: { component: string; options: React.ReactNode }[] = [
  {
    component: "Promoter",
    options: (
      <>
        Methanol-inducible <em>AOX1</em>, where expression stays off until
        methanol is added — useful when the product is burdensome to the cell.
        Constitutive <em>UPP</em>, which runs throughout growth with no methanol
        handling. Promoterless backbones for a promoter you supply.
      </>
    ),
  },
  {
    component: "Integration",
    options: (
      <>
        Standard random integration, where screening selects the best clone. Or
        targeted integration to a defined locus using our T-series vectors,
        which carry double-crossover homology arms.
      </>
    ),
  },
  {
    component: "Selection marker",
    options: (
      <>Zeocin, G418 (geneticin), Hygromycin B or Nourseothricin (NTC).</>
    ),
  },
  {
    component: "Marker removal",
    options: (
      <>
        J-series vectors leave the resistance marker in the strain — the
        simplest route. S-series vectors carry the marker between lox sites so
        it can be excised afterwards, for strains that must end marker-free.
      </>
    ),
  },
  {
    component: "Secretion leaders",
    options: (
      <>
        Eight characterized leaders, including the <em>S. cerevisiae</em> α-mating
        factor signal peptide with full, KR and Δ1 pro-peptide variants; the{" "}
        <em>S. cerevisiae</em> OST1 signal peptide with and without a
        pro-peptide; AGA2; and a native <em>Pichia</em> HP signal peptide. Where
        secretion is uncertain, we screen several in parallel.
      </>
    ),
  },
  {
    component: "Host background",
    options: (
      <>
        Mut+ or methanol-utilization-slow (<em>aox1Δ</em>) hosts.
        Protease-deficient hosts, single and double deletion, for
        protease-sensitive targets. GlycoSwitch® Man5 hosts (<em>och1Δ</em> with
        an ER-targeted mannosidase) where Man5 rather than hypermannosylated
        N-glycans are required. SILAC labelling hosts.
      </>
    ),
  },
  {
    component: "Tags and processing sites",
    options: (
      <>
        Purification and detection tags including 6x/8x/10xHis, Strep-tag II,
        Twin-Strep, FLAG and 3xFLAG, Avi, c-Myc, HA, V5 and S-tag. Cleavable
        linkers using TEV, HRV 3C/PreScission, thrombin, Factor Xa or
        enterokinase sites. Flexible and rigid spacers, SpyTag and Sortase A
        motifs for conjugation.
      </>
    ),
  },
  {
    component: "Gene design",
    options: (
      <>
        Pichia-specific codon optimization, with control over restriction sites
        and sequence features that interfere with synthesis.
      </>
    ),
  },
];

const STRENGTHS = [
  {
    lead: "Every strain is sequence-verified.",
    body: "Whole-genome sequencing is part of the standard deliverable, not an extra. You know what integrated, where, and in how many copies before you build a process on it.",
  },
  {
    lead: "Secretion is treated as a variable, not an assumption.",
    body: "Leader choice is the most common reason a protein fails to secrete well in Pichia, and we screen it rather than defaulting to α-mating factor.",
  },
  {
    lead: "Strains can end marker-free.",
    body: "Our lox-flanked S-series supports marker recycling, which matters for multi-cassette strains and for downstream regulatory considerations.",
  },
  {
    lead: "Integration can be targeted.",
    body: "Where clone-to-clone variation is a problem, double-crossover homology arms put the cassette in a defined locus.",
  },
  {
    lead: "Independent integrants are screened, not assumed.",
    body: "Expression varies between clones from the same transformation; we screen multiple independent integrants as a matter of course.",
  },
];

export default function PichiaProteinExpressionServicesPage() {
  return (
    <main className="min-h-screen py-12 px-4">
      <div className="container mx-auto max-w-5xl space-y-8">
        {/* Hero */}
        <section className="glass-panel p-8 md:p-12">
          <h1 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900">
            <em>Pichia pastoris</em> Protein Expression Services
          </h1>
          <p className="text-lg md:text-xl text-gray-700 mb-8">
            Specialist contract research and custom strain development in{" "}
            <em>Komagataella phaffii</em>. From gene sequence to a
            sequence-verified expression strain.
          </p>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>
              BioGrammatics is a contract research organization dedicated to
              recombinant protein expression in the methylotrophic yeast{" "}
              <em>Komagataella phaffii</em>, still widely known as{" "}
              <em>Pichia pastoris</em>.
            </p>
            <p>
              We work directly with biotechnology, biopharmaceutical, precision
              fermentation and industrial biotechnology companies to design
              expression strategies, construct and characterize strains, and
              assess protein expression. Our scientists have spent two decades on
              commercial Pichia projects, and clients work with those scientists
              directly rather than through an account manager.
            </p>
            <p>
              Projects can be structured as a single feasibility study or as a
              multiphase programme with defined deliverables and decision points,
              so that you can judge the result at each stage before committing to
              the next.
            </p>
          </div>
          <div className="flex gap-4 flex-wrap mt-8">
            <Link
              href={PROJECT_ENQUIRY_HREF}
              className="glass-button text-white px-8 py-3 rounded-lg text-lg"
            >
              Discuss your project with a scientist
            </Link>
            <Link
              href="/vectors"
              className="px-8 py-3 rounded-lg text-lg bg-white/60 backdrop-blur border border-white/40 text-gray-800 hover:bg-white/80 transition-all"
            >
              Browse vectors and strains
            </Link>
          </div>
        </section>

        {/* What we do */}
        <section className="glass-panel p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-gray-900">
            What we do
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {SERVICES.map((service) => (
              <div key={service.title}>
                <h3 className="text-xl font-bold mb-3 text-gray-800">
                  {service.title}
                </h3>
                {service.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-gray-700 leading-relaxed mb-3"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* What you receive */}
        <section className="glass-panel p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 text-gray-900">
            What you receive
          </h2>
          <p className="text-gray-700 mb-6">
            Every project delivers a validated strain. Analytical work is added
            to it as the project requires.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <tbody>
                {DELIVERABLES.map((item) => (
                  <tr key={item.name} className="border-b border-gray-300/60">
                    <th
                      scope="row"
                      className="align-top py-4 pr-4 md:pr-6 font-bold text-gray-800 md:w-64 md:min-w-56"
                    >
                      {item.name}
                    </th>
                    <td className="align-top py-4 text-gray-700 leading-relaxed">
                      {item.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-700 mt-6">
            Fermentation development, purification, larger material quantities
            and additional analytics are available on discussion.
          </p>
        </section>

        {/* Design options */}
        <section className="glass-panel p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 text-gray-900">
            Design options
          </h2>
          <p className="text-gray-700 mb-6">
            Projects are built from a defined and documented set of components
            rather than a single house protocol. The choices below are made with
            you at the design stage.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <tbody>
                {DESIGN_OPTIONS.map((row) => (
                  <tr key={row.component} className="border-b border-gray-300/60">
                    <th
                      scope="row"
                      className="align-top py-4 pr-4 md:pr-6 font-bold text-gray-800 md:w-56 md:min-w-48"
                    >
                      {row.component}
                    </th>
                    <td className="align-top py-4 text-gray-700 leading-relaxed">
                      {row.options}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Where we are strongest */}
        <section className="glass-panel p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 text-gray-900">
            Where we are strongest
          </h2>
          <p className="text-gray-700 mb-6">
            Our differentiation is molecular biology and strain engineering
            rather than scale. Specifically:
          </p>
          <ul className="space-y-4">
            {STRENGTHS.map((strength) => (
              <li key={strength.lead} className="flex gap-3">
                <span className="mt-2 w-2 h-2 shrink-0 bg-blue-500 rounded-full" />
                <p className="text-gray-700 leading-relaxed">
                  <strong className="text-gray-900">{strength.lead}</strong>{" "}
                  {strength.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Reagent storefront — secondary */}
        <section className="glass-panel p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 text-gray-900">
            Prefer to build your own strains?
          </h2>
          <p className="text-gray-700 mb-6">
            We also supply the same tools we use. Our catalogue of Pichia
            expression vectors, engineered host strains, competent cells and
            related reagents is available to laboratories developing strains
            in-house.
          </p>
          <div className="flex gap-4 flex-wrap">
            <Link
              href="/vectors"
              className="inline-block px-6 py-2 rounded-lg bg-white/60 backdrop-blur border border-white/40 text-gray-800 hover:bg-white/80 transition-all"
            >
              Browse vectors
            </Link>
            <Link
              href="/strains"
              className="inline-block px-6 py-2 rounded-lg bg-white/60 backdrop-blur border border-white/40 text-gray-800 hover:bg-white/80 transition-all"
            >
              Browse strains
            </Link>
          </div>
        </section>

        {/* Start a project */}
        <section className="glass-panel p-8 md:p-12 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-3 text-gray-900">
            Start a project
          </h2>
          <p className="text-gray-700 mb-8 max-w-2xl mx-auto">
            Tell us about your protein and what you need from it. Our scientists
            review every enquiry directly and respond with options, not a form
            letter.
          </p>
          <Link
            href={PROJECT_ENQUIRY_HREF}
            className="inline-block glass-button text-white px-8 py-3 rounded-lg text-lg"
          >
            Discuss your project with a scientist
          </Link>
        </section>
      </div>
    </main>
  );
}
