# Comments on the Custom Pichia Strain Design Wizard

**Reviewed:** `BioGrammatics-strain-design-package.zip` — wizard HTML, `plasmid_catalog`, `strain_catalog`
**For:** Tom Beardslee

---

## Overall

This is further along than "prototype" suggests. The thing that stands out is that the
hard parts are the ones you got right: the leader catalogue carries real sequences with
the mechanistic classes attached, the vector and strain lists are parsed from our own
files rather than retyped, and the filtering actually narrows as the customer answers.
A few specifics worth calling out because they should survive into the real thing:

- **The s1/s3/s5 rationale is stated, not just asserted.** "One from each class —
  a post-translational leader alongside two SRP-dependent routes covers the ways a
  protein can fail to be secreted, and costs far less than discovering the problem after
  a single construct underperforms." That is the argument, and it is both honest and
  commercially persuasive. Keep that sentence close to verbatim.
- **The SILAC marker clash warning.** Catching that BG09 already carries hygromycin and
  nourseothricin resistance, so a vector using those cannot be selected in it, is exactly
  the kind of thing a customer would discover three weeks in. More of this.
- **The B/J/O/U/X/Z rejection with a per-character explanation** matches the policy the
  website's codon optimizer already enforces. The two tools agree, which saves us a
  support conversation later.
- **Carrying Step 2 answers into Step 3 and saying so** ("Carried over from your earlier
  answers…") is good practice. It shows the customer we were listening and lets them
  override.

Comments below follow your four questions.

---

## 1. Is anything missing that a customer would need to tell us?

Six things. The first three I think are real gaps; the last three are judgement calls.

**Target yield and scale.** Nothing asks how much protein they need or at what scale.
This changes almost everything downstream — copy number strategy, whether Mut+ or MutS
is right, whether fermentation development belongs in the quote at all. Right now we
would quote a shake-flask project and a 100 L campaign off the same form. Even a coarse
three-way ("mg for assay development / gram scale / intended for production") would
sharpen every quote.

**Prior expression history.** Currently this lives inside the Step 5 notes placeholder
("…related projects, prior expression attempts"), which means it arrives as free text or
not at all. It deserves its own question. "Have you expressed this protein before, and
what happened?" is the single most informative thing a customer can tell us — it steers
leader choice, host choice, and our own expectations, and it is a question every customer
can answer. Step 2 already captures proteolysis specifically; this generalises it.

**Biosafety and provenance.** Nothing asks whether the protein is a toxin, an allergen,
derived from a select agent or pathogen, export-controlled, or encumbered by an MTA or
license. We need to know before we accept the work, not after. One checklist question
with an "none of these apply" default would cover it.

**Does the customer have an activity assay?** This determines what "it worked" means —
a band on a gel, or functional protein. It bears directly on which Step 4 deliverable is
the right recommendation, and we are better placed to guide that choice if we know.

**Disulfide expectations.** We count cysteines already. Worth asking whether the customer
expects disulfide bonds, and whether the pairing is known — a heavily disulfide-bonded
protein is a different conversation about secretion than the cysteine count alone implies.

**Shipping destination.** Live GMO strains crossing borders need permits, and that can be
the long pole. Worth knowing at quote time rather than at ship time.

On confidentiality: Step 5 does state that sequences are treated as confidential and used
only to prepare the quote, which is the right instinct. If a customer needs an NDA *before*
pasting a sequence, there is currently no path for that other than not using the form. A
"we can sign an NDA first — contact us" link near the sequence box would catch those
customers instead of losing them silently.

---

## 2. Is anything asked that a customer could not reasonably answer?

Three, and all three are fixable by asking the downstream question instead.

**Methanol utilization phenotype (Mut+ vs MutS).** This is a fermentation engineering
decision. A customer who has not run Pichia at scale has no basis for it. The "advise me"
option rescues it, but the question as posed invites a guess. Consider asking what we
actually need to know — roughly, do they intend to ferment at scale, and do they have
methanol handling — and deriving the phenotype ourselves. Same answer, a question they
can answer.

**"Will you need the antibiotic resistance marker removed later?"** The note explains the
tradeoff well, but the customer has to predict whether they will do a second modification,
which many will not have thought about yet. Reframing as "Do you expect to add further
modifications to this strain later?" is answerable, and we derive J-series versus S-series
from it. Worth also flagging the related trap: if they *do* plan further work, the marker
they pick now is one they cannot reuse.

**The nine screening variables in Step 4.** With no cost signal attached, a customer has
no reason not to tick all nine. Suggest we either indicate which two or three we would
recommend for their specific design, or say plainly that most projects screen two to
three. As it stands the list invites a maximal answer we then have to walk back in the
quote.

One smaller thing: the glycosylation question offers "Not applicable — my protein has no
sequons" while the wizard has already *computed* the sequons from their sequence. If we
detected three and they select "none," something should notice. Either disable the option
or show the contradiction.

And a wording risk on GlycoSwitch® Man5 — the note is accurate, but customers routinely
read "engineered glycosylation" as "human-like glycans." Worth one explicit sentence
saying what Man5 is and is not, so the expectation is set by us rather than by hope.

---

## 3. Does the secreted/intracellular and leader-class explanation match what we advise?

**This one is yours to sign off, not mine** — below are the specific places I would check
rather than conclusions.

- The EAEA / Ste13 note ("trimming can be incomplete and leave EA residues on a fraction
  of the product") reads as appropriately honest. Confirm that is how we would actually
  phrase the risk to a customer who has asked for an authentic N-terminus.
- The strongest scientific argument for the multi-leader screen is that **leader
  performance is protein-specific and not reliably predictable**. The current copy
  presents leaders as a choice the customer makes, with the screen as an upsell. If we
  believe prediction is unreliable — and I think we do — then the screen is the honest
  default recommendation, and saying so is both more accurate and better for us. Worth
  deciding deliberately which framing we want.
- Check whether the intracellular path says enough about what changes: lysis required,
  no Kex2 processing, initiator methionine retained, and protease-deficient hosts
  mattering for different reasons than in the secreted case.
- Does the copy anywhere say when secretion is the *wrong* choice — large multi-domain
  proteins, heavily disulfide-bonded targets, anything membrane-associated? Steering a
  customer away from a format that will not work is worth more than the construct we
  would otherwise sell them.

---

## 4. Are the vector and strain questions the right ones?

The three vector questions (marker removal, promoter, antibiotic) and three strain
questions (methanol phenotype, protease deficiency, glycosylation) cover the main axes.
Two genuine gaps:

**Integration strategy is never asked.** The catalogue contains targeted vectors with
double-crossover homology arms — pSAH-T1, pSAN-T9, pSAZ-T6 — and `VARIANT_NOTE.targeted`
has copy written for them. But no question lets a customer ask for targeted integration.
They surface only as lower-sorted results under the S-series. A customer who wants
defined-locus integration but does *not* need marker removal has no route to them at all.
Either add the question, or decide these are not customer-selectable and say so.

**Copy number is not asked in the vector section.** It appears only as a Step 4 screening
variable. Given it is among the strongest determinants of yield in Pichia, and it
interacts with the ARS-versus-integrating choice the catalogue already encodes, it may
belong as a vector question — or at least as part of the yield/scale question above.

Minor: auxotrophy is in the strain data (his4 on BG12 and SuperMan5-12) but nothing asks
about it. Probably correct to leave it out of the customer-facing flow — but then it is
worth confirming those strains are reachable some other way, or deliberately not offered.

---

## On the items you flagged yourself

**Tags and cleavage sites.** The list is credible and the groupings are sensible. Two
notes. First, the cleavage site entries describe the scissile bond but not the scar left
behind in each case — for a customer who asked for an authentic N-terminus two steps
earlier, the residual scar is the thing they care about, and we should state it per site.
Second, Avi-tag requires BirA, which the note says; worth being explicit about whether
we offer co-expression or whether that is the customer's problem downstream.

**Deliverables and screening variables.** The four levels are a clean ladder and the
"everything in the previous package, plus…" structure makes the progression obvious.
See the note above about guiding the variable selection. The "Something else — let's
discuss" option is the right escape hatch.

**BG08 and BG13.** Holding them out is correct given there is no genotype to show. But
this is a data problem with a fix, not a permanent exclusion — if we have the genotypes
anywhere, getting them into the master sheet makes two more strains available. If we
genuinely do not, that is worth knowing for its own sake.

**The S-series decision tree.** Agreed this is the main structural gap. Right now
answering "yes, the marker must be removable" leads somewhere incomplete. Worth scoping
what those additional questions actually are before the wording work, since they may
change the shape of Step 3.

---

## One thing beyond your questions

The five-step structure maps almost exactly onto a route the website already advertises
and does not have — `/path-to-protein` is linked from our navigation today and 404s.
The database already carries the tables this would need (`ServiceQuote`, then `Project`
with vector and strain roles and milestone tracking), all built and unused.

Two further connections worth knowing about:

- The construct the wizard assembles in Steps 1 and 2 — leader plus tags plus protein —
  is precisely the input our codon optimizer takes. The wizard's own 2,500 aa ceiling
  already tells oversized proteins they are a custom project, which is what this is.
- Combined with the SnapGene writer work, the chain runs end to end: wizard picks the
  vector and leader, the optimizer generates the DNA, and we hand back an openable
  annotated `.dna` map. The vector templates for that writer come from the same
  annotated files this catalogue was parsed from.

Nobody else in the Pichia space offers that. I would rather not bolt the wizard on as a
standalone page when it could be the front of that chain.

The one decision to make deliberately first: the prototype runs entirely in the browser
and nothing leaves the machine. The moment this is a website form, we are storing
customer sequences, and the confidentiality line in Step 5 becomes a commitment we have
to be able to describe precisely — where sequences are held, who can see them, how long
we keep them, and what leaves our systems. Worth settling before the first customer
pastes in their protein.

---

## What would help most next

1. The genotypes for BG08 and BG13, if they exist anywhere.
2. A decision on the targeted-integration vectors — customer-selectable or not.
3. Your call on the leader framing in section 3: is the multi-leader screen our
   recommended default, or an upsell?
4. The S-series question set, even roughly, since it affects Step 3's shape.
