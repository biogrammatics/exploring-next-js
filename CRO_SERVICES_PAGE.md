# Pichia CRO services page — draft copy

**Target URL:** `biogrammatics.com/pichia-protein-expression-services`
**Status:** draft for scientific and commercial sign-off. Nothing here is published.
**Drafted:** 24 November 2026, from the AI search review's section 6 plus the
vector, strain, leader and deliverable catalogues in the beta site's
`src/lib/path-to-protein.ts`.

Everything marked **【VERIFY】** is a claim I could not confirm from the codebase
or the review documents. Those are collected again at the end. Please check each
one before this goes live — the whole point of the page is that it is more
specific than a competitor's, and specific claims have to be true.

---

## Wix SEO panel

| Field | Value |
|---|---|
| Page title | Pichia Protein Expression CRO \| Custom Strain Development \| BioGrammatics |
| Meta description | BioGrammatics provides custom Pichia pastoris protein expression services: strain engineering, expression feasibility studies, secretion optimization and whole-genome-sequenced production strains. |
| URL slug | `pichia-protein-expression-services` |

---

## Page copy

### H1

Pichia pastoris Protein Expression Services

### Subheading

Specialist contract research and custom strain development in *Komagataella phaffii*. From gene sequence to a sequence-verified expression strain.

### Opening (body text)

BioGrammatics is a contract research organization dedicated to recombinant protein expression in the methylotrophic yeast *Komagataella phaffii*, still widely known as *Pichia pastoris*.

We work directly with biotechnology, biopharmaceutical, precision fermentation and industrial biotechnology companies to design expression strategies, construct and characterize strains, and assess protein expression. Our scientists have spent two decades on commercial Pichia projects, and clients work with those scientists directly rather than through an account manager.

Projects can be structured as a single feasibility study or as a multiphase programme with defined deliverables and decision points, so that you can judge the result at each stage before committing to the next.

**【VERIFY】** *"Two decades" — the current homepage says "over the past two decades," so this is consistent with existing copy, but confirm it is still the number you want to use.*

---

### H2 — What we do

#### H3 — Expression feasibility studies

Evaluate a new protein target in Pichia before committing to a full programme. We design and build the expression construct, generate strains, and test whether your protein is made — and if it is secreted, whether it leaves the cell intact.

You get a clear answer and the strain that produced it, not just a report.

#### H3 — Custom strain development

Design and construction of expression strains to your specification: promoter, secretion leader, tags, selection marker, integration strategy and host background. Every strain we deliver is confirmed by whole-genome sequencing before it ships.

#### H3 — Secretion and yield optimization

If your protein expresses poorly, or not at all, the cause is usually identifiable. We screen secretion leaders, cassette copy number, host background, induction temperature, medium, pH, feed strategy and induction duration, and report which combination performed best and by how much.

This applies to strains we built and to strains you already have.

#### H3 — Strain characterization

Whole-genome sequencing of the delivered strain, confirming that the expression cassette is present, intact and correct, and establishing where it integrated and in how many copies. Supplied as a written report with the annotated cassette sequence as built.

---

### H2 — What you receive

Every project delivers a validated strain. Analytical work is added to it as the project requires.

| | Included |
|---|---|
| **Sequence-verified expression strain** | Glycerol stock of the production strain; whole-genome sequencing report covering cassette integrity, integration site and copy number; annotated sequence of the expression cassette as built; strain handling and induction protocol. |
| **Small-scale expression trial** | Induction under standard conditions with a Coomassie-stained SDS-PAGE gel and a written assessment of the result. |
| **Expression trial with immunoblot** | As above, plus a western blot against your tag or a supplied antibody — for proteins not abundant enough to identify confidently on a stained gel, or where identity must be confirmed. |
| **Multi-variable expression screen** | Expression screened across the variables that matter to your target, with comparative gel and blot data and a recommendation of the best conditions found. |

Fermentation development, purification, larger material quantities and additional analytics are available on discussion. **【VERIFY】** *See the fermentation note at the end — I have deliberately not stated a scale.*

---

### H2 — Design options

Projects are built from a defined and documented set of components rather than a single house protocol. The choices below are made with you at the design stage.

| Component | Options |
|---|---|
| **Promoter** | Methanol-inducible *AOX1*, where expression stays off until methanol is added — useful when the product is burdensome to the cell. Constitutive *UPP*, which runs throughout growth with no methanol handling. Promoterless backbones for a promoter you supply. |
| **Integration** | Standard random integration, where screening selects the best clone. Or targeted integration to a defined locus using our T-series vectors, which carry double-crossover homology arms. |
| **Selection marker** | Zeocin, G418 (geneticin), Hygromycin B or Nourseothricin (NTC). |
| **Marker removal** | J-series vectors leave the resistance marker in the strain — the simplest route. S-series vectors carry the marker between lox sites so it can be excised afterwards, for strains that must end marker-free. |
| **Secretion leaders** | Eight characterized leaders, including the *S. cerevisiae* α-mating factor signal peptide with full, KR and Δ1 pro-peptide variants; the *S. cerevisiae* OST1 signal peptide with and without a pro-peptide; AGA2; and a native *Pichia* HP signal peptide. Where secretion is uncertain, we screen several in parallel. |
| **Host background** | Mut+ or methanol-utilization-slow (*aox1Δ*) hosts. Protease-deficient hosts, single and double deletion, for protease-sensitive targets. GlycoSwitch® Man5 hosts (*och1Δ* with an ER-targeted mannosidase) where Man5 rather than hypermannosylated N-glycans are required. SILAC labelling hosts. |
| **Tags and processing sites** | Purification and detection tags including 6x/8x/10xHis, Strep-tag II, Twin-Strep, FLAG and 3xFLAG, Avi, c-Myc, HA, V5 and S-tag. Cleavable linkers using TEV, HRV 3C/PreScission, thrombin, Factor Xa or enterokinase sites. Flexible and rigid spacers, SpyTag and Sortase A motifs for conjugation. |
| **Gene design** | Pichia-specific codon optimization, with control over restriction sites and sequence features that interfere with synthesis. |

---

### H2 — Where we are strongest

Our differentiation is molecular biology and strain engineering rather than scale. Specifically:

- **Every strain is sequence-verified.** Whole-genome sequencing is part of the standard deliverable, not an extra. You know what integrated, where, and in how many copies before you build a process on it.
- **Secretion is treated as a variable, not an assumption.** Leader choice is the most common reason a protein fails to secrete well in Pichia, and we screen it rather than defaulting to α-mating factor.
- **Strains can end marker-free.** Our lox-flanked S-series supports marker recycling, which matters for multi-cassette strains and for downstream regulatory considerations.
- **Integration can be targeted.** Where clone-to-clone variation is a problem, double-crossover homology arms put the cassette in a defined locus.
- **Independent integrants are screened, not assumed.** Expression varies between clones from the same transformation; we screen multiple independent integrants as a matter of course.

---

### H2 — Prefer to build your own strains?

We also supply the same tools we use. Our catalogue of Pichia expression vectors, engineered host strains, competent cells and related reagents is available to laboratories developing strains in-house.

**CTA (secondary):** Browse vectors and strains

---

### H2 — Start a project

**Primary CTA:** Discuss your project with a scientist

Tell us about your protein and what you need from it. Our scientists review every enquiry directly and respond with options, not a form letter.

**【VERIFY】** *Contact route — see the note at the end.*

---

## Claims needing your sign-off

I wrote nothing into the copy that I could not evidence from the vector, strain,
leader, tag and deliverable catalogues in the beta codebase. These are the points
where I either stopped short or need you to confirm:

1. **Fermentation scale.** Both the report and the chat transcript mention an
   in-house 3 L bioreactor, sourced from "prior company context" rather than from
   anything I can see. I have deliberately written *"available on discussion"*
   with no number. If 3 L is correct and current, say so and I will state it —
   a concrete scale is worth more than a vague offer, and the review notes that
   competitors publish theirs. If BioGrammatics does not currently run
   fermentation in-house, the line should say that partner scale-up is arranged
   rather than implying internal capacity.

2. **Regulatory support, cell banking, genomic sequencing documentation.** The
   report's capability table lists "research cell banking, genomic sequencing
   and strain documentation" under regulatory support. I have included the
   sequencing and documentation parts, because the deliverables in the wizard
   evidence them. I have **left out research cell banking entirely** — I have no
   basis for it. Add it back if you offer it.

3. **"Two decades."** Carried over from the current homepage. Confirm it is
   still the framing you want.

4. **Company facts.** The transcript states "founded in 2008 and based in
   Carlsbad, California." I have **not** put this in the page, because I cannot
   verify it and a wrong founding date on a CRO page is a bad look. If it is
   right, it belongs in the opening paragraph — it is exactly the kind of
   concrete detail that helps an AI system characterize the company, and
   VALIDOGEN's equivalent page carries it.

5. **GlycoSwitch®.** Used as a registered trademark. Confirm your licence
   permits advertising it on a services page, and whether an attribution line
   is required. **【VERIFY】**

6. **SILAC hosts.** Present in the strain catalogue, so I have listed them.
   Confirm they are offered as a service and not only held internally.

7. **Contact route.** The page needs a working primary CTA. On the Wix site
   today that most likely means your existing enquiry form or a mailto. Tell me
   which and I will write the final line. The beta site's strain design wizard
   is not the right target — the review is explicit that this page must work
   without anyone using the interactive tool.

8. **Turnaround times and pricing.** Not included anywhere. Kemp Proteins
   publishes a 4–6 week feasibility window, and the review notes that timelines
   help buyers self-qualify. If you have a defensible range, it is worth adding;
   I would rather omit it than publish a number you cannot meet.

---

## Notes on using this

- **Headings matter.** Paste the H1 as a real H1 in Wix and the H2s as H2s, not
  as styled body text. The review's technical checklist calls descriptive H1
  headings critical, and Wix will only emit the right tags if you use its
  heading styles.
- **The SEO panel is separate from the page.** Set the page title and meta
  description in Wix's SEO settings; they are not the same as the H1.
- **The tables are the valuable part.** They are what let an AI system produce a
  paragraph about BioGrammatics comparable to the ones it produced for
  VALIDOGEN, Kemp, Isomerase and Profacgen. If anything gets cut for length,
  cut prose, not the design options table.
- **This copy is reusable.** It is written to drop into the Next.js site at
  launch with no rewriting, so the work is not thrown away when Wix retires.
