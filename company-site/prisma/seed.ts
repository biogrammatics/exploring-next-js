import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// =============================================================================
// REFERENCE DATA
// =============================================================================

const productStatuses = [
  { name: "Active", description: "Available for purchase", isAvailable: true },
  { name: "Discontinued", description: "No longer available", isAvailable: false },
  { name: "Development", description: "Under development", isAvailable: false },
];

const promoters = [
  { name: "AOX1", fullName: "Alcohol oxidase 1", inducible: true, strength: "STRONG" as const },
  { name: "GAP", fullName: "Glyceraldehyde-3-phosphate dehydrogenase", inducible: false, strength: "STRONG" as const },
  { name: "PGK1", fullName: "Phosphoglycerate kinase", inducible: false, strength: "MEDIUM" as const },
  { name: "FLD1", fullName: "Formaldehyde dehydrogenase", inducible: true, strength: "MEDIUM" as const },
  { name: "TEF1", fullName: "Translation elongation factor 1 alpha", inducible: false, strength: "VERY_STRONG" as const },
];

const selectionMarkers = [
  { name: "Zeocin", resistance: "Zeocin", concentration: "100 μg/mL" },
  { name: "G418", resistance: "Geneticin", concentration: "200 μg/mL" },
  { name: "Hygromycin", resistance: "Hygromycin B", concentration: "300 μg/mL" },
  { name: "Blasticidin", resistance: "Blasticidin S", concentration: "10 μg/mL" },
];

const vectorTypes = [
  { name: "Expression", description: "For protein expression", applications: "Recombinant protein production" },
  { name: "Integration", description: "For genomic integration", applications: "Stable cell line creation" },
  { name: "Episomal", description: "Autonomously replicating", applications: "Transient expression" },
  { name: "CRISPR", description: "For genome editing", applications: "Gene knockouts and insertions" },
];

const hostOrganisms = [
  { commonName: "Pichia pastoris", scientificName: "Komagataella phaffii", description: "Methylotrophic yeast, excellent for secreted protein production" },
  { commonName: "E. coli", scientificName: "Escherichia coli", description: "Bacterial expression system, fast growth" },
  { commonName: "S. cerevisiae", scientificName: "Saccharomyces cerevisiae", description: "Baker's yeast, well-characterized eukaryotic system" },
];

const strainTypes = [
  { name: "Wild Type", description: "Standard laboratory strain", applications: "General purpose expression" },
  { name: "Protease Deficient", description: "Reduced protease activity", applications: "Sensitive protein production" },
  { name: "Glycosylation Modified", description: "Altered glycosylation pattern", applications: "Therapeutic protein production" },
  { name: "Methanol Utilization Slow", description: "Slower methanol metabolism", applications: "Controlled induction" },
];

const secretionSignals = [
  {
    name: "Alpha-factor",
    sequence: "MRFPSIFTAVLFAASSALAAPVNTTTEDETAQIPAEAVIGYSDLEGDFDVAVLPFSNSTNNGLLFINTTIASIAAKEEGVSLDKRT",
    organism: "Saccharomyces cerevisiae",
    description: "Most commonly used secretion signal for yeast expression. Works well in Pichia pastoris.",
  },
  {
    name: "Invertase",
    sequence: "MLLQAFLFLLAGFAAKISA",
    organism: "Saccharomyces cerevisiae",
    description: "Alternative secretion signal, shorter than alpha-factor but effective.",
  },
  {
    name: "Killer toxin",
    sequence: "MKTLLFSFVFAAIFSVSALA",
    organism: "Pichia pastoris",
    description: "Native Pichia pastoris secretion signal for optimal compatibility.",
  },
  {
    name: "Acid phosphatase",
    sequence: "MKKLSAIFALFASAPAQA",
    organism: "Pichia pastoris",
    description: "Another native Pichia secretion signal, good for acidic proteins.",
  },
  {
    name: "Human serum albumin",
    sequence: "MKWVTFISLLLLFSSAYSRGVFRRD",
    organism: "Homo sapiens",
    description: "Human-derived signal, useful for expressing human therapeutic proteins.",
  },
];

const proteinTags = [
  // N-terminal tags
  { name: "6xHis (N)", sequence: "HHHHHH", tagType: "N_TERMINAL" as const, description: "Hexahistidine tag for metal affinity purification (Ni-NTA, IMAC)" },
  { name: "10xHis (N)", sequence: "HHHHHHHHHH", tagType: "N_TERMINAL" as const, description: "Decahistidine tag for stronger metal affinity binding" },
  { name: "GST", sequence: "MSPILGYWKIKGLVQPTRLLLEYLEEKYEEHLYERDEGDKWRNKKFELGLEFPNLPYYIDGDVKLTQSMAIIRYIADKHNMLGGCPKERAEISMLEGAVLDIRYGVSRIAYSKDFETLKVDFLSKLPEMLKMFEDRLCHKTYLNGDHVTHPDFMLYDALDVVLYMDPMCLDAFPKLVCFKKRIEAIPQIDKYLKSSKYIAWPLQGWQATFGGGDHPPK", tagType: "N_TERMINAL" as const, description: "Glutathione S-transferase tag for glutathione affinity purification" },
  { name: "MBP", sequence: "MKIEEGKLVIWINGDKGYNGLAEVGKKFEKDTGIKVTVEHPDKLEEKFPQVAATGDGPDIIFWAHDRFGGYAQSGLLAEITPDKAFQDKLYPFTWDAVRYNGKLIAYPIAVEALSLIYNKDLLPNPPKTWEEIPALDKELKAKGKSALMFNLQEPYFTWPLIAADGGYAFKYENGKYDIKDVGVDNAGAKAGLTFLVDLIKNKHMNADTDYSIAEAAFNKGETAMTINGPWAWSNIDTSKVNYGVTVLPTFKGQPSKPFVGVLSAGINAASPNKELAKEFLENYLLTDEGLEAVNKDKPLGAVALKSYEEELAKDPRIAATMENAQKGEIMPNIPQMSAFWYAVRTAVINAASGRQTVDEALKDAQT", tagType: "N_TERMINAL" as const, description: "Maltose binding protein for maltose affinity purification and increased solubility" },
  { name: "SUMO", sequence: "MSDSEVNQEAKPEVKPEVKPETHINLKVSDGSSEIFFKIKKTTPLRRLMEAFAKRQGKEMDSLRFLYDGIRIQADQTPEDLDMEDNDIIEAHREQIGG", tagType: "N_TERMINAL" as const, description: "Small ubiquitin-like modifier for improved protein folding and solubility" },
  { name: "FLAG (N)", sequence: "DYKDDDDK", tagType: "N_TERMINAL" as const, description: "FLAG octapeptide for anti-FLAG antibody purification and detection" },
  { name: "Strep-tag II (N)", sequence: "WSHPQFEK", tagType: "N_TERMINAL" as const, description: "Streptavidin-binding peptide for Strep-Tactin affinity purification" },
  // C-terminal tags
  { name: "6xHis (C)", sequence: "HHHHHH", tagType: "C_TERMINAL" as const, description: "Hexahistidine tag for metal affinity purification (Ni-NTA, IMAC)" },
  { name: "10xHis (C)", sequence: "HHHHHHHHHH", tagType: "C_TERMINAL" as const, description: "Decahistidine tag for stronger metal affinity binding" },
  { name: "FLAG (C)", sequence: "DYKDDDDK", tagType: "C_TERMINAL" as const, description: "FLAG octapeptide for anti-FLAG antibody purification and detection" },
  { name: "Strep-tag II (C)", sequence: "WSHPQFEK", tagType: "C_TERMINAL" as const, description: "Streptavidin-binding peptide for Strep-Tactin affinity purification" },
  { name: "V5", sequence: "GKPIPNPLLGLDST", tagType: "C_TERMINAL" as const, description: "V5 epitope tag for anti-V5 antibody detection and purification" },
  { name: "Myc", sequence: "EQKLISEEDL", tagType: "C_TERMINAL" as const, description: "c-Myc epitope tag for anti-Myc antibody detection" },
  { name: "HA", sequence: "YPYDVPDYA", tagType: "C_TERMINAL" as const, description: "Hemagglutinin epitope tag for anti-HA antibody detection" },
];

// =============================================================================
// SERVICE PACKAGES (6-Step Pathway)
// =============================================================================

const servicePackages = [
  {
    name: "Gene Design & Optimization",
    slug: "gene-design",
    stepNumber: 1,
    description: "Design and optimize your gene sequence for expression",
    diyOption: "Use free online tools like OPTIMIZER or JCat for codon optimization",
    serviceOption: "Professional codon optimization with proprietary algorithms",
    diyChallenges: "Generic algorithms may not account for host-specific biases, mRNA structure issues",
    serviceBenefits: "Optimized for Pichia-specific codon usage, avoided problematic sequences",
    whatsIncluded: "Codon optimization, rare codon analysis, mRNA structure prediction",
    estimatedPrice: 25000, // $250
    estimatedTurnaround: "2-3 business days",
  },
  {
    name: "Gene Synthesis",
    slug: "gene-synthesis",
    stepNumber: 2,
    description: "Synthesize your optimized gene",
    diyOption: "Order gene synthesis from various commercial providers",
    serviceOption: "Integrated gene synthesis with our design process",
    diyChallenges: "Managing multiple vendors, format compatibility, quality verification",
    serviceBenefits: "Seamless integration, quality controlled, ready for cloning",
    whatsIncluded: "Gene synthesis, sequence verification, delivery in expression-ready format",
    estimatedPrice: 15000, // $150 base + per bp
    estimatedTurnaround: "5-7 business days",
  },
  {
    name: "Vector Construction",
    slug: "vector-construction",
    stepNumber: 3,
    description: "Clone your gene into an expression vector",
    diyOption: "Perform cloning in your own laboratory",
    serviceOption: "Professional cloning into optimized expression vectors",
    diyChallenges: "Requires molecular biology expertise, equipment, and troubleshooting",
    serviceBenefits: "Guaranteed successful cloning, sequence-verified constructs",
    whatsIncluded: "Cloning, transformation, colony screening, sequence verification",
    estimatedPrice: 35000, // $350
    estimatedTurnaround: "5-7 business days",
  },
  {
    name: "Strain Generation",
    slug: "strain-generation",
    stepNumber: 4,
    description: "Transform and select expression strains",
    diyOption: "Transform Pichia strains in your laboratory",
    serviceOption: "Professional strain generation with optimized protocols",
    diyChallenges: "Requires electroporator, sterile technique, selection experience",
    serviceBenefits: "Multiple clones screened, highest expresser identified",
    whatsIncluded: "Transformation, selection, single colony isolation, glycerol stocks",
    estimatedPrice: 45000, // $450
    estimatedTurnaround: "2-3 weeks",
  },
  {
    name: "Expression Testing",
    slug: "expression-testing",
    stepNumber: 5,
    description: "Test and optimize protein expression",
    diyOption: "Perform small-scale expression tests in your lab",
    serviceOption: "Comprehensive expression screening and optimization",
    diyChallenges: "Requires fermentation equipment, analytical methods",
    serviceBenefits: "Systematic optimization, detailed expression data",
    whatsIncluded: "Small-scale expression, SDS-PAGE analysis, Western blot, yield estimation",
    estimatedPrice: 75000, // $750
    estimatedTurnaround: "2-3 weeks",
  },
  {
    name: "Scale-Up Production",
    slug: "scale-up",
    stepNumber: 6,
    description: "Scale up to larger production volumes",
    diyOption: "Scale up fermentation in your own facility",
    serviceOption: "Professional scale-up and production",
    diyChallenges: "Requires fermentation expertise, larger equipment, process development",
    serviceBenefits: "Optimized fed-batch protocols, consistent production",
    whatsIncluded: "Process development, fed-batch fermentation, purification support",
    estimatedPrice: 250000, // $2,500+
    estimatedTurnaround: "4-6 weeks",
  },
];

// =============================================================================
// SAMPLE PRODUCTS
// =============================================================================

const genericProducts = [
  {
    name: "Basic Plan",
    description: "Perfect for individuals and small projects",
    price: 999, // $9.99
    imageUrl: "https://placehold.co/400x300/e2e8f0/475569?text=Basic",
  },
  {
    name: "Pro Plan",
    description: "For growing teams with advanced needs",
    price: 2999, // $29.99
    imageUrl: "https://placehold.co/400x300/dbeafe/1e40af?text=Pro",
  },
  {
    name: "Enterprise Plan",
    description: "Full-featured solution for large organizations",
    price: 9999, // $99.99
    imageUrl: "https://placehold.co/400x300/fae8ff/86198f?text=Enterprise",
  },
];

// =============================================================================
// MAIN SEED FUNCTION
// =============================================================================

async function main() {
  console.log("🌱 Seeding BioGrammatics database...\n");

  // Seed Product Statuses
  console.log("Creating product statuses...");
  const statusMap: Record<string, string> = {};
  for (const status of productStatuses) {
    const created = await prisma.productStatus.upsert({
      where: { name: status.name },
      update: status,
      create: status,
    });
    statusMap[status.name] = created.id;
  }
  console.log(`✓ Created ${productStatuses.length} product statuses`);

  // Seed Promoters
  console.log("Creating promoters...");
  const promoterMap: Record<string, string> = {};
  for (const promoter of promoters) {
    const created = await prisma.promoter.upsert({
      where: { name: promoter.name },
      update: promoter,
      create: promoter,
    });
    promoterMap[promoter.name] = created.id;
  }
  console.log(`✓ Created ${promoters.length} promoters`);

  // Seed Selection Markers
  console.log("Creating selection markers...");
  const markerMap: Record<string, string> = {};
  for (const marker of selectionMarkers) {
    const created = await prisma.selectionMarker.upsert({
      where: { name: marker.name },
      update: marker,
      create: marker,
    });
    markerMap[marker.name] = created.id;
  }
  console.log(`✓ Created ${selectionMarkers.length} selection markers`);

  // Seed Vector Types
  console.log("Creating vector types...");
  const vectorTypeMap: Record<string, string> = {};
  for (const vt of vectorTypes) {
    const created = await prisma.vectorType.upsert({
      where: { name: vt.name },
      update: vt,
      create: vt,
    });
    vectorTypeMap[vt.name] = created.id;
  }
  console.log(`✓ Created ${vectorTypes.length} vector types`);

  // Seed Host Organisms
  console.log("Creating host organisms...");
  const hostMap: Record<string, string> = {};
  for (const host of hostOrganisms) {
    const created = await prisma.hostOrganism.upsert({
      where: { id: host.commonName.toLowerCase().replace(/\s+/g, "-") },
      update: host,
      create: {
        id: host.commonName.toLowerCase().replace(/\s+/g, "-"),
        ...host,
      },
    });
    hostMap[host.commonName] = created.id;
  }
  console.log(`✓ Created ${hostOrganisms.length} host organisms`);

  // Seed Strain Types
  console.log("Creating strain types...");
  const strainTypeMap: Record<string, string> = {};
  for (const st of strainTypes) {
    const created = await prisma.strainType.upsert({
      where: { name: st.name },
      update: st,
      create: st,
    });
    strainTypeMap[st.name] = created.id;
  }
  console.log(`✓ Created ${strainTypes.length} strain types`);

  // Seed Secretion Signals
  console.log("Creating secretion signals...");
  for (const signal of secretionSignals) {
    await prisma.secretionSignal.upsert({
      where: { name: signal.name },
      update: signal,
      create: signal,
    });
  }
  console.log(`✓ Created ${secretionSignals.length} secretion signals`);

  // Seed Protein Tags
  console.log("Creating protein tags...");
  for (const tag of proteinTags) {
    await prisma.proteinTag.upsert({
      where: { name: tag.name },
      update: tag,
      create: tag,
    });
  }
  console.log(`✓ Created ${proteinTags.length} protein tags`);

  // Seed Service Packages
  console.log("Creating service packages...");
  for (const pkg of servicePackages) {
    await prisma.servicePackage.upsert({
      where: { slug: pkg.slug },
      update: pkg,
      create: {
        ...pkg,
        position: pkg.stepNumber,
      },
    });
  }
  console.log(`✓ Created ${servicePackages.length} service packages`);

  // Seed Generic Products (for backward compatibility)
  console.log("Creating generic products...");
  for (const product of genericProducts) {
    await prisma.product.upsert({
      where: { id: product.name.toLowerCase().replace(/\s+/g, "-") },
      update: product,
      create: {
        id: product.name.toLowerCase().replace(/\s+/g, "-"),
        ...product,
      },
    });
  }
  console.log(`✓ Created ${genericProducts.length} generic products`);

  // Seed Vectors
  console.log("Creating vectors...");
  const vectors = [
    {
      name: "pPICZ-A",
      description: "Inducible expression vector for Pichia pastoris with alpha-factor secretion signal",
      category: "HETEROLOGOUS_PROTEIN_EXPRESSION" as const,
      salePrice: 12500, // $125.00
      subscriptionPrice: 7500, // $75.00
      promoterId: promoterMap["AOX1"],
      selectionMarkerId: markerMap["Zeocin"],
      vectorTypeId: vectorTypeMap["Expression"],
      hostOrganismId: hostMap["Pichia pastoris"],
      productStatusId: statusMap["Active"],
      vectorSize: 3593,
      features: "AOX1 promoter, Zeocin resistance, alpha-factor secretion signal, multiple cloning site, C-terminal 6xHis and c-myc tags",
    },
    {
      name: "pPICZ-B",
      description: "Inducible expression vector with alternative reading frame",
      category: "HETEROLOGOUS_PROTEIN_EXPRESSION" as const,
      salePrice: 12500,
      subscriptionPrice: 7500,
      promoterId: promoterMap["AOX1"],
      selectionMarkerId: markerMap["Zeocin"],
      vectorTypeId: vectorTypeMap["Expression"],
      hostOrganismId: hostMap["Pichia pastoris"],
      productStatusId: statusMap["Active"],
      vectorSize: 3594,
      features: "AOX1 promoter, Zeocin resistance, reading frame B, multiple cloning site",
    },
    {
      name: "pGAPZ-A",
      description: "Constitutive expression vector for Pichia pastoris",
      category: "HETEROLOGOUS_PROTEIN_EXPRESSION" as const,
      salePrice: 13500, // $135.00
      subscriptionPrice: 8500,
      promoterId: promoterMap["GAP"],
      selectionMarkerId: markerMap["Zeocin"],
      vectorTypeId: vectorTypeMap["Expression"],
      hostOrganismId: hostMap["Pichia pastoris"],
      productStatusId: statusMap["Active"],
      vectorSize: 4200,
      features: "GAP promoter, Zeocin resistance, constitutive expression, no methanol induction required",
    },
    {
      name: "pPIC9K",
      description: "High-copy integration vector with multi-copy selection",
      category: "HETEROLOGOUS_PROTEIN_EXPRESSION" as const,
      salePrice: 15000, // $150.00
      subscriptionPrice: 9500,
      promoterId: promoterMap["AOX1"],
      selectionMarkerId: markerMap["G418"],
      vectorTypeId: vectorTypeMap["Integration"],
      hostOrganismId: hostMap["Pichia pastoris"],
      productStatusId: statusMap["Active"],
      vectorSize: 9000,
      features: "AOX1 promoter, G418 multi-copy selection, alpha-factor secretion signal, high expression potential",
      hasLoxSites: true,
    },
    {
      name: "pTEF1-Zeo",
      description: "Very strong constitutive expression vector",
      category: "HETEROLOGOUS_PROTEIN_EXPRESSION" as const,
      salePrice: 14500,
      subscriptionPrice: 9000,
      promoterId: promoterMap["TEF1"],
      selectionMarkerId: markerMap["Zeocin"],
      vectorTypeId: vectorTypeMap["Expression"],
      hostOrganismId: hostMap["Pichia pastoris"],
      productStatusId: statusMap["Active"],
      vectorSize: 4500,
      features: "TEF1 promoter, highest constitutive expression, Zeocin resistance",
    },
    {
      name: "pCRISPR-Pichia",
      description: "CRISPR/Cas9 genome editing vector for Pichia",
      category: "GENOME_ENGINEERING" as const,
      salePrice: 22500, // $225.00
      subscriptionPrice: 15000,
      promoterId: promoterMap["GAP"],
      selectionMarkerId: markerMap["Hygromycin"],
      vectorTypeId: vectorTypeMap["CRISPR"],
      hostOrganismId: hostMap["Pichia pastoris"],
      productStatusId: statusMap["Active"],
      vectorSize: 8500,
      features: "Cas9 expression, sgRNA cloning site, Hygromycin resistance, genome editing capabilities",
    },
  ];

  for (const vector of vectors) {
    await prisma.vector.upsert({
      where: { name: vector.name },
      update: vector,
      create: vector,
    });
  }
  console.log(`✓ Created ${vectors.length} vectors`);

  // Seed Pichia Strains
  console.log("Creating Pichia strains...");
  const strains = [
    {
      name: "GS115",
      description: "Standard Pichia pastoris strain for protein expression. His4 auxotroph with fast methanol utilization.",
      strainTypeId: strainTypeMap["Wild Type"],
      productStatusId: statusMap["Active"],
      genotype: "his4",
      phenotype: "His⁻, Mut⁺",
      advantages: "Fast methanol utilization, high expression levels, well-characterized",
      applications: "General recombinant protein production, secreted and intracellular proteins",
      salePrice: 8500, // $85.00
      availability: "In Stock",
      shippingRequirements: "Ships on dry ice, overnight delivery required",
      storageConditions: "-80°C for long-term storage, -20°C glycerol stocks for routine use",
      viabilityPeriod: "2 years when stored at -80°C",
      cultureMedia: "YPD (routine), BMGY/BMMY (expression), MD (selection)",
      growthConditions: "30°C, 250-300 rpm shaking, pH 6.0 for optimal growth",
    },
    {
      name: "KM71H",
      description: "Methanol utilization slow strain for controlled induction kinetics.",
      strainTypeId: strainTypeMap["Methanol Utilization Slow"],
      productStatusId: statusMap["Active"],
      genotype: "arg4 aox1Δ::ARG4",
      phenotype: "Arg⁺, Mut⁺ (slow)",
      advantages: "Slower, more controlled methanol induction, reduced heat generation during fermentation",
      applications: "Large-scale fermentation, heat-sensitive proteins",
      salePrice: 9500, // $95.00
      availability: "In Stock",
      shippingRequirements: "Ships on dry ice, overnight delivery required",
      storageConditions: "-80°C for long-term storage",
      viabilityPeriod: "2 years when stored properly",
      cultureMedia: "YPD, BMGY/BMMY",
      growthConditions: "30°C, 250 rpm shaking",
    },
    {
      name: "SMD1168H",
      description: "Protease-deficient strain for sensitive protein production.",
      strainTypeId: strainTypeMap["Protease Deficient"],
      productStatusId: statusMap["Active"],
      genotype: "his4 pep4Δ",
      phenotype: "His⁻, Protease A deficient",
      advantages: "Reduced protein degradation, ideal for protease-sensitive targets",
      applications: "Therapeutic proteins, antibody fragments, enzymes",
      salePrice: 12500, // $125.00
      availability: "In Stock",
      shippingRequirements: "Ships on dry ice, overnight delivery required",
      storageConditions: "-80°C for long-term storage",
      viabilityPeriod: "2 years when stored properly",
      cultureMedia: "YPD, BMGY/BMMY, supplemented with histidine as needed",
      growthConditions: "30°C, 250 rpm shaking",
    },
    {
      name: "SuperMan5",
      description: "Glycoengineered strain producing human-like mannose-5 glycans.",
      strainTypeId: strainTypeMap["Glycosylation Modified"],
      productStatusId: statusMap["Active"],
      genotype: "his4 och1Δ MNN4 MNN6",
      phenotype: "His⁻, Man5 glycosylation",
      advantages: "Human-compatible glycosylation pattern, reduced immunogenicity",
      applications: "Therapeutic glycoproteins, antibodies, replacement enzymes",
      salePrice: 35000, // $350.00
      availability: "Made to Order",
      shippingRequirements: "Ships on dry ice, overnight delivery required",
      storageConditions: "-80°C for long-term storage",
      viabilityPeriod: "1 year when stored properly",
      cultureMedia: "Specialized glycoengineering media",
      growthConditions: "30°C, 250 rpm shaking, controlled pH",
    },
  ];

  for (const strain of strains) {
    await prisma.pichiaStrain.upsert({
      where: { name: strain.name },
      update: strain,
      create: strain,
    });
  }
  console.log(`✓ Created ${strains.length} Pichia strains`);

  // Create admin user
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      email: adminEmail,
      name: "Admin User",
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });
  console.log(`✓ Created admin user: ${adminEmail}`);

  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Seeding complete! Summary:");
  console.log("=".repeat(50));
  console.log(`  Product Statuses: ${await prisma.productStatus.count()}`);
  console.log(`  Promoters: ${await prisma.promoter.count()}`);
  console.log(`  Selection Markers: ${await prisma.selectionMarker.count()}`);
  console.log(`  Vector Types: ${await prisma.vectorType.count()}`);
  console.log(`  Host Organisms: ${await prisma.hostOrganism.count()}`);
  console.log(`  Strain Types: ${await prisma.strainType.count()}`);
  console.log(`  Secretion Signals: ${await prisma.secretionSignal.count()}`);
  console.log(`  Protein Tags: ${await prisma.proteinTag.count()}`);
  console.log(`  Service Packages: ${await prisma.servicePackage.count()}`);
  console.log(`  Generic Products: ${await prisma.product.count()}`);
  console.log(`  Vectors: ${await prisma.vector.count()}`);
  console.log(`  Pichia Strains: ${await prisma.pichiaStrain.count()}`);
  console.log(`  Users: ${await prisma.user.count()}`);
  console.log("=".repeat(50));
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
