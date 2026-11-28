import type { Metadata } from "next";
import Link from "next/link";

// Title and description come from the root layout; this only pins the
// canonical URL so the homepage is not confused with the many ways it can be
// reached (trailing slash, query strings, the Render *.onrender.com host).
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/**
 * Homepage hierarchy, reorganized November 2026 after the AI-search review.
 *
 * The previous order led with "Expression in the Language of Life" and two
 * reagent CTAs (Browse Vectors / View Strains), with contract research demoted
 * to the second of two cards. Contract research is ~90% of revenue, and the
 * review found BioGrammatics absent from Google's AI Overview for "can you
 * find me a CRO for Pichia expression?" while four competitors were named and
 * a separate paragraph was given to reagent suppliers — the exact category the
 * old hierarchy signalled.
 *
 * So: CRO first, reagents as a clearly-signposted secondary offering, and the
 * tagline kept as an eyebrow rather than the H1. The interactive wizard
 * complements the service pages instead of being the only route into them.
 */

const CRO_SERVICES = [
  {
    title: "Expression feasibility",
    body: "Evaluate a new protein target in Pichia before committing to a full programme. You get a clear answer and the strain that produced it.",
  },
  {
    title: "Custom strain development",
    body: "Expression strains built to your specification — promoter, secretion leader, tags, marker and host background — and confirmed by whole-genome sequencing.",
  },
  {
    title: "Secretion and yield optimization",
    body: "For proteins that express poorly, or not at all. We screen leaders, copy number, host background and induction conditions, and report what worked.",
  },
  {
    title: "Strain characterization",
    body: "Whole-genome sequencing of the delivered strain: cassette integrity, integration site and copy number, with the annotated sequence as built.",
  },
];

const DIFFERENTIATORS = [
  {
    title: "Sequence-verified strains",
    body: "Whole-genome sequencing is part of the standard deliverable, not an extra. You know what integrated, where, and in how many copies.",
  },
  {
    title: "Secretion screened, not assumed",
    body: "Leader choice is the most common reason a protein fails to secrete in Pichia. We screen eight characterized leaders rather than defaulting to one.",
  },
  {
    title: "Direct access to the scientists",
    body: "Two decades of commercial Pichia projects, and you work with the scientists running yours rather than through an account manager.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero — leads with the service a customer searches for. The tagline is
          retained above it as an eyebrow, not as the H1. */}
      <section className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
        <p className="text-sm md:text-base uppercase tracking-[0.2em] text-white/80 mb-4">
          Expression in the Language of Life
        </p>
        <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white drop-shadow-lg max-w-4xl">
          <em>Pichia pastoris</em> Protein Expression Services
        </h1>
        <p className="text-lg md:text-2xl text-white/90 mb-8 max-w-3xl">
          Specialist contract research and custom strain development in{" "}
          <em>Komagataella phaffii</em>. From gene sequence to a
          sequence-verified expression strain.
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/path-to-protein"
            className="glass-button text-white px-8 py-3 rounded-lg text-lg"
          >
            Discuss your project
          </Link>
          <Link
            href="/pichia-protein-expression-services"
            className="px-8 py-3 rounded-lg text-lg bg-white/20 backdrop-blur border border-white/30 text-white hover:bg-white/30 transition-all"
          >
            Explore CRO services
          </Link>
        </div>
      </section>

      {/* Contract research services — the business, first. */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold mb-4 text-white text-center drop-shadow-lg">
            Contract Research Services
          </h2>
          <p className="text-white/90 text-center text-lg mb-12 max-w-3xl mx-auto">
            Recombinant protein expression in <em>Komagataella phaffii</em>, from
            a single feasibility study to a multiphase programme with defined
            deliverables and decision points.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            {CRO_SERVICES.map((service) => (
              <div
                key={service.title}
                className="glass-panel-dark p-8 text-center"
              >
                <h3 className="text-xl font-bold mb-3 text-white">
                  {service.title}
                </h3>
                <p className="text-white/85 leading-relaxed">{service.body}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              href="/pichia-protein-expression-services"
              className="inline-block glass-button text-white px-8 py-3 rounded-lg text-lg"
            >
              See what a project includes
            </Link>
          </div>
        </div>
      </section>

      {/* Differentiators — specific and evidenced, replacing the previous
          generic "Expertise / Speed / Quality", which every competitor claims
          and which tells a reader nothing. */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold mb-12 text-white text-center drop-shadow-lg">
            Why BioGrammatics
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {DIFFERENTIATORS.map((item) => (
              <div key={item.title} className="glass-panel-dark p-8 text-center">
                <h3 className="text-xl font-bold mb-3 text-white">
                  {item.title}
                </h3>
                <p className="text-white/85 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="glass-panel-dark p-8 md:p-12 text-center">
            <p className="text-lg md:text-xl text-white/90 leading-relaxed">
              At BioGrammatics, our mission is to advance scientific research and
              catalyze innovation to meet global challenges. Our strategy is to
              provide superior protein expression solutions, anchored by the
              capabilities of the methylotrophic yeast <em>Pichia pastoris</em>{" "}
              and customized to the unique demands of each of our clients. Over
              the past two decades, this commitment has facilitated significant
              progress in research, development and commercialization of Pichia
              produced proteins worldwide.
            </p>
          </div>
        </div>
      </section>

      {/* Reagent storefront — secondary, clearly signposted for the different
          audience it serves. */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="glass-panel-dark p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4 text-white">
              Prefer to develop your own strains?
            </h2>
            <p className="text-white/85 mb-6 leading-relaxed">
              We also supply the same tools we use. Pichia expression vectors,
              engineered host strains, competent cells and DNA synthesis
              subscriptions, available to laboratories developing strains
              in-house.
            </p>
            <div className="flex gap-4 flex-wrap justify-center">
              <Link
                href="/vectors"
                className="inline-block glass-button text-white px-6 py-2 rounded-lg"
              >
                Browse Vectors
              </Link>
              <Link
                href="/strains"
                className="inline-block px-6 py-2 rounded-lg bg-white/20 backdrop-blur border border-white/30 text-white hover:bg-white/30 transition-all"
              >
                Browse Strains
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Path to Protein — a tool that complements the service pages. The
          review is explicit that the core information must be readable without
          anyone using it, which the CRO services page now satisfies. */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="glass-panel-dark p-8 md:p-12 text-center">
            <h2 className="text-3xl font-bold mb-4 text-white">
              Your Path to Protein
            </h2>
            <p className="text-white/85 mb-8 text-lg">
              Design a strain interactively and send it to us as a project
              request — or use it to scope what you need before you get in touch.
            </p>
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-400/25 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-blue-100 font-bold">1-6</span>
                </div>
                <p className="text-sm text-white/85">Guided steps from gene to protein</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-400/25 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-purple-100 font-bold">DIY</span>
                </div>
                <p className="text-sm text-white/85">Mix DIY and service options</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-green-400/25 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-green-100 font-bold">$</span>
                </div>
                <p className="text-sm text-white/85">Instant pricing estimates</p>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-400/25 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-orange-100 font-bold">Pro</span>
                </div>
                <p className="text-sm text-white/85">Expert recommendations</p>
              </div>
            </div>
            <div className="text-center">
              <Link
                href="/path-to-protein"
                className="inline-block glass-button text-white px-8 py-3 rounded-lg text-lg"
              >
                Start Your Journey
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 mt-16">
        <div className="container mx-auto max-w-5xl">
          <div className="glass-panel-dark p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-white/75">
                &copy; 2026 BioGrammatics. All rights reserved.
              </p>
              <div className="flex gap-6">
                <Link href="/privacy" className="text-white/75 hover:text-white">
                  Privacy Policy
                </Link>
                <Link href="/terms" className="text-white/75 hover:text-white">
                  Terms &amp; Conditions
                </Link>
                <Link href="/cookies" className="text-white/75 hover:text-white">
                  Cookie Policy
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
