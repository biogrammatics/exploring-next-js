/**
 * Analyze whether repeated 13-mers in optimized DNA sequences are:
 * 1. Same-frame repeats (same amino acid context — unavoidable)
 * 2. Frame-shifted repeats (different amino acid context — optimizer could avoid)
 *
 * This answers: are synthesis problems caused by the protein itself, or by our codon choices?
 */

import * as fs from 'fs';
import * as path from 'path';

// ---- Load sequences ----

function parseFasta(filePath: string): Map<string, string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const seqs = new Map<string, string>();
  let name = '';
  let seq = '';
  for (const line of content.split('\n')) {
    if (line.startsWith('>')) {
      if (name) seqs.set(name, seq);
      name = line.slice(1).trim();
      seq = '';
    } else {
      seq += line.trim();
    }
  }
  if (name) seqs.set(name, seq);
  return seqs;
}

// ---- Codon table ----

const CODON_TABLE: Record<string, string> = {
  TTT:'F',TTC:'F',TTA:'L',TTG:'L',CTT:'L',CTC:'L',CTA:'L',CTG:'L',
  ATT:'I',ATC:'I',ATA:'I',ATG:'M',GTT:'V',GTC:'V',GTA:'V',GTG:'V',
  TCT:'S',TCC:'S',TCA:'S',TCG:'S',CCT:'P',CCC:'P',CCA:'P',CCG:'P',
  ACT:'T',ACC:'T',ACA:'T',ACG:'T',GCT:'A',GCC:'A',GCA:'A',GCG:'A',
  TAT:'Y',TAC:'Y',TAA:'*',TAG:'*',CAT:'H',CAC:'H',CAA:'Q',CAG:'Q',
  AAT:'N',AAC:'N',AAA:'K',AAG:'K',GAT:'D',GAC:'D',GAA:'E',GAG:'E',
  TGT:'C',TGC:'C',TGA:'*',TGG:'W',CGT:'R',CGC:'R',CGA:'R',CGG:'R',
  AGT:'S',AGC:'S',AGA:'R',AGG:'R',GGT:'G',GGC:'G',GGA:'G',GGG:'G',
};

function translateCodon(codon: string): string {
  return CODON_TABLE[codon.toUpperCase()] || '?';
}

function translate(dna: string, frame: number = 0): string {
  let protein = '';
  for (let i = frame; i + 2 < dna.length; i += 3) {
    protein += translateCodon(dna.slice(i, i + 3));
  }
  return protein;
}

// ---- Find repeated k-mers ----

function findRepeatedKmers(dna: string, k: number): Map<string, number[]> {
  const positions = new Map<string, number[]>();
  for (let i = 0; i <= dna.length - k; i++) {
    const kmer = dna.slice(i, i + k);
    if (!positions.has(kmer)) {
      positions.set(kmer, []);
    }
    positions.get(kmer)!.push(i);
  }
  // Only keep k-mers that appear more than once
  const repeated = new Map<string, number[]>();
  for (const [kmer, pos] of positions) {
    if (pos.length > 1) {
      repeated.set(kmer, pos);
    }
  }
  return repeated;
}

// ---- Classify repeat pairs ----

interface RepeatPairAnalysis {
  kmer: string;
  pos1: number;
  pos2: number;
  frame1: number;  // pos % 3 (reading frame offset)
  frame2: number;
  sameFrame: boolean;
  // If same frame: do they encode the same amino acids?
  aa1: string;
  aa2: string;
  sameAA: boolean;
}

function analyzeRepeatPairs(dna: string, k: number): RepeatPairAnalysis[] {
  const repeated = findRepeatedKmers(dna, k);
  const pairs: RepeatPairAnalysis[] = [];

  for (const [kmer, positions] of repeated) {
    // Analyze each unique pair of positions
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const pos1 = positions[i];
        const pos2 = positions[j];
        const frame1 = pos1 % 3;
        const frame2 = pos2 % 3;
        const sameFrame = frame1 === frame2;

        // Translate the k-mer region in the context of each position's reading frame
        // We need to align to the reading frame boundary
        const alignedStart1 = pos1 - frame1;
        const alignedEnd1 = pos1 + k + (3 - (pos1 + k) % 3) % 3;
        const aa1 = translate(dna.slice(alignedStart1, alignedEnd1), 0);

        const alignedStart2 = pos2 - frame2;
        const alignedEnd2 = pos2 + k + (3 - (pos2 + k) % 3) % 3;
        const aa2 = translate(dna.slice(alignedStart2, alignedEnd2), 0);

        // Extract just the amino acids that overlap with the k-mer region
        const aaOffset1 = Math.floor(frame1 / 3);
        const aaOffset2 = Math.floor(frame2 / 3);

        // Simpler: translate the k-mer starting from its frame offset
        const kmerAA1 = translate(dna, 0).slice(Math.floor(pos1 / 3), Math.ceil((pos1 + k) / 3));
        const kmerAA2 = translate(dna, 0).slice(Math.floor(pos2 / 3), Math.ceil((pos2 + k) / 3));

        pairs.push({
          kmer,
          pos1, pos2,
          frame1, frame2,
          sameFrame,
          aa1: kmerAA1,
          aa2: kmerAA2,
          sameAA: kmerAA1 === kmerAA2,
        });
      }
    }
  }

  return pairs;
}

// ---- Parse Twist CSV ----

function parseTwistCSV(filePath: string): Array<{name: string; complexity: string; insertSequence: string; warnings: string}> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const results: Array<{name: string; complexity: string; insertSequence: string; warnings: string}> = [];

  // Parse CSV handling quoted fields with newlines
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') {
        currentField += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentField += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && content[i + 1] === '\n') i++;
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.length > 1) rows.push(currentRow);
        currentRow = [];
      } else {
        currentField += ch;
      }
    }
  }
  if (currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  // Header is first row
  const header = rows[0];
  const nameIdx = header.indexOf('Name');
  const complexityIdx = header.indexOf('Complexity');
  const insertIdx = header.indexOf('Insert sequence');
  const warningsIdx = header.indexOf('Warnings');

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row.length > warningsIdx) {
      results.push({
        name: row[nameIdx],
        complexity: row[complexityIdx],
        insertSequence: row[insertIdx],
        warnings: row[warningsIdx],
      });
    }
  }
  return results;
}

// ---- Main analysis ----

async function main() {
  // Load FASTA sequences
  const seqs100 = parseFasta('/Users/tom/Claude/codon-optimization/dp_optimized_100.fasta');
  const seqs900 = parseFasta('/Users/tom/Claude/codon-optimization/dp_optimized_900.fasta');
  const allSeqs = new Map([...seqs100, ...seqs900]);

  // Load Twist results
  const twist100 = parseTwistCSV('/Users/tom/Downloads/100 optimization test.csv');
  const twist900 = parseTwistCSV('/Users/tom/Downloads/100 optimization test (1).csv');
  const allTwist = [...twist100, ...twist900];

  // Filter to flagged sequences
  const flagged = allTwist.filter(t => t.complexity === 'COMPLEX' || t.complexity === 'NOT ACCEPTED');
  console.log(`Total sequences: ${allTwist.length}`);
  console.log(`Flagged (COMPLEX + NOT ACCEPTED): ${flagged.length}`);
  console.log(`  COMPLEX: ${flagged.filter(t => t.complexity === 'COMPLEX').length}`);
  console.log(`  NOT ACCEPTED: ${flagged.filter(t => t.complexity === 'NOT ACCEPTED').length}`);
  console.log();

  const K = 13; // Twist's minimum repeat length

  // Aggregate stats
  let totalKmers = 0;
  let totalPairs = 0;
  let sameFramePairs = 0;
  let diffFramePairs = 0;
  let sameFrameSameAA = 0;
  let sameFrameDiffAA = 0;

  // Per-sequence stats
  const seqStats: Array<{
    name: string;
    complexity: string;
    aaLen: number;
    uniqueRepeats: number;
    totalPairs: number;
    sameFramePairs: number;
    diffFramePairs: number;
    sameFrameSameAA: number;
    sameFrameDiffAA: number;
    pctSameFrame: number;
    pctSameAA: number;
  }> = [];

  // Also check: for same-AA repeats, how long are the amino acid repeat stretches?
  let aaRepeatLengths: number[] = [];

  for (const entry of flagged) {
    // Get the insert DNA sequence (use from FASTA if available, fallback to CSV)
    let dna = allSeqs.get(entry.name);
    if (!dna) {
      // Try the insert sequence from the CSV
      dna = entry.insertSequence;
    }
    if (!dna || dna.length < K) continue;

    // Remove stop codon for translation
    const dnaForAnalysis = dna.endsWith('TAA') || dna.endsWith('TAG') || dna.endsWith('TGA')
      ? dna.slice(0, -3) : dna;

    const pairs = analyzeRepeatPairs(dnaForAnalysis, K);

    // Deduplicate: count unique k-mers, not pairs
    const uniqueKmers = new Set(pairs.map(p => p.kmer));

    let seqSameFrame = 0;
    let seqDiffFrame = 0;
    let seqSameAA = 0;
    let seqDiffAA = 0;

    for (const pair of pairs) {
      if (pair.sameFrame) {
        seqSameFrame++;
        if (pair.sameAA) {
          seqSameAA++;
        } else {
          seqDiffAA++;
        }
      } else {
        seqDiffFrame++;
      }
    }

    totalKmers += uniqueKmers.size;
    totalPairs += pairs.length;
    sameFramePairs += seqSameFrame;
    diffFramePairs += seqDiffFrame;
    sameFrameSameAA += seqSameAA;
    sameFrameDiffAA += seqDiffAA;

    seqStats.push({
      name: entry.name,
      complexity: entry.complexity,
      aaLen: Math.floor(dnaForAnalysis.length / 3),
      uniqueRepeats: uniqueKmers.size,
      totalPairs: pairs.length,
      sameFramePairs: seqSameFrame,
      diffFramePairs: seqDiffFrame,
      sameFrameSameAA: seqSameAA,
      sameFrameDiffAA: seqDiffAA,
      pctSameFrame: pairs.length > 0 ? (seqSameFrame / pairs.length * 100) : 0,
      pctSameAA: seqSameFrame > 0 ? (seqSameAA / seqSameFrame * 100) : 0,
    });

    // Find amino acid repeat lengths for same-AA pairs
    if (seqSameAA > 0) {
      const protein = translate(dnaForAnalysis, 0);
      // Find repeated amino acid subsequences of length ceil(K/3) = 5
      const aaK = Math.ceil(K / 3);
      for (let len = aaK; len <= 20; len++) {
        const aaRepeats = new Map<string, number[]>();
        for (let i = 0; i <= protein.length - len; i++) {
          const sub = protein.slice(i, i + len);
          if (!aaRepeats.has(sub)) aaRepeats.set(sub, []);
          aaRepeats.get(sub)!.push(i);
        }
        for (const [sub, positions] of aaRepeats) {
          if (positions.length > 1) {
            aaRepeatLengths.push(len);
          }
        }
      }
    }
  }

  // ---- Print results ----

  console.log('='.repeat(90));
  console.log('REPEAT FRAME ANALYSIS (k=13)');
  console.log('='.repeat(90));
  console.log();
  console.log(`Total unique repeated 13-mers across all flagged sequences: ${totalKmers}`);
  console.log(`Total repeat pairs analyzed: ${totalPairs}`);
  console.log();
  console.log('PAIR CLASSIFICATION:');
  console.log(`  Same reading frame:     ${sameFramePairs} (${(sameFramePairs/totalPairs*100).toFixed(1)}%)`);
  console.log(`    → Same amino acids:   ${sameFrameSameAA} (${(sameFrameSameAA/totalPairs*100).toFixed(1)}% of all pairs) — UNAVOIDABLE`);
  console.log(`    → Diff amino acids:   ${sameFrameDiffAA} (${(sameFrameDiffAA/totalPairs*100).toFixed(1)}% of all pairs) — same frame, diff codons`);
  console.log(`  Different reading frame: ${diffFramePairs} (${(diffFramePairs/totalPairs*100).toFixed(1)}%) — AVOIDABLE by codon choice`);
  console.log();

  // Break down by complexity
  for (const cat of ['COMPLEX', 'NOT ACCEPTED'] as const) {
    const catSeqs = seqStats.filter(s => s.complexity === cat);
    if (catSeqs.length === 0) continue;

    const catPairs = catSeqs.reduce((s, x) => s + x.totalPairs, 0);
    const catSameFrame = catSeqs.reduce((s, x) => s + x.sameFramePairs, 0);
    const catDiffFrame = catSeqs.reduce((s, x) => s + x.diffFramePairs, 0);
    const catSameAA = catSeqs.reduce((s, x) => s + x.sameFrameSameAA, 0);
    const catDiffAA = catSeqs.reduce((s, x) => s + x.sameFrameDiffAA, 0);

    console.log(`--- ${cat} (${catSeqs.length} sequences, ${catPairs} pairs) ---`);
    console.log(`  Same frame:      ${catSameFrame} (${(catSameFrame/catPairs*100).toFixed(1)}%)`);
    console.log(`    Same AA:       ${catSameAA} (${(catSameAA/catPairs*100).toFixed(1)}%) — unavoidable`);
    console.log(`    Diff AA:       ${catDiffAA} (${(catDiffAA/catPairs*100).toFixed(1)}%)`);
    console.log(`  Different frame: ${catDiffFrame} (${(catDiffFrame/catPairs*100).toFixed(1)}%) — avoidable`);
    console.log();
  }

  // Show per-sequence breakdown for worst cases
  console.log('='.repeat(90));
  console.log('PER-SEQUENCE BREAKDOWN (sorted by total repeat pairs, top 30)');
  console.log('='.repeat(90));
  seqStats.sort((a, b) => b.totalPairs - a.totalPairs);
  console.log(
    'Name'.padEnd(12) +
    'Cat'.padEnd(15) +
    'AA'.padEnd(6) +
    'Kmers'.padEnd(8) +
    'Pairs'.padEnd(8) +
    'SameFrame'.padEnd(12) +
    'SameAA'.padEnd(10) +
    'DiffFrame'.padEnd(12) +
    '%Avoidable'
  );
  for (const s of seqStats.slice(0, 30)) {
    const pctAvoidable = s.totalPairs > 0
      ? ((s.diffFramePairs + s.sameFrameDiffAA) / s.totalPairs * 100).toFixed(0)
      : '0';
    console.log(
      s.name.padEnd(12) +
      s.complexity.padEnd(15) +
      String(s.aaLen).padEnd(6) +
      String(s.uniqueRepeats).padEnd(8) +
      String(s.totalPairs).padEnd(8) +
      String(s.sameFramePairs).padEnd(12) +
      String(s.sameFrameSameAA).padEnd(10) +
      String(s.diffFramePairs).padEnd(12) +
      pctAvoidable + '%'
    );
  }

  // Summary stats
  console.log();
  console.log('='.repeat(90));
  console.log('SUMMARY');
  console.log('='.repeat(90));
  const pctUnavoidable = (sameFrameSameAA / totalPairs * 100).toFixed(1);
  const pctAvoidable = ((diffFramePairs + sameFrameDiffAA) / totalPairs * 100).toFixed(1);
  console.log(`Unavoidable repeats (same AA at same frame): ${pctUnavoidable}% of all pairs`);
  console.log(`Potentially avoidable (diff frame OR same frame diff AA): ${pctAvoidable}% of all pairs`);
  console.log();
  console.log('Interpretation:');
  console.log('  - "Same frame, same AA" repeats are driven by amino acid sequence repeats in the protein.');
  console.log('    No codon optimizer can avoid these — the protein demands identical DNA.');
  console.log('  - "Same frame, diff AA" repeats happen when different amino acids at the same');
  console.log('    frame offset are encoded with codons that create the same 13-mer. Avoidable.');
  console.log('  - "Different frame" repeats are frame-shifted: the same DNA appears at two positions');
  console.log('    with different reading frame offsets. Fully avoidable by codon choice.');

  // ---- Deep dive: "same frame, diff AA" pairs ----
  // For a 13-mer at frame offset f:
  //   f=0: [CCC][CCC][CCC][CCC][C]   — 4 full codons + 1nt overhang (5 AA touched)
  //   f=1: [CC][CCC][CCC][CCC][CC]    — 3 full codons + 2nt on each end (5 AA touched)
  //   f=2: [C][CCC][CCC][CCC][CCC]    — 4 full codons + 1nt overhang (5 AA touched)
  // In all cases, ~5 amino acid positions are spanned.

  console.log();
  console.log('='.repeat(90));
  console.log('DEEP DIVE: "Same frame, diff AA" pairs');
  console.log('='.repeat(90));

  // Re-analyze just the diff-AA pairs
  let diffAAPairs: Array<{
    kmer: string;
    aa1: string;
    aa2: string;
    numDiffPositions: number;
    diffPositions: number[];  // which AA positions differ (0-indexed within the 5-AA window)
    frame: number;
  }> = [];

  for (const entry of flagged) {
    let dna = allSeqs.get(entry.name);
    if (!dna) dna = entry.insertSequence;
    if (!dna || dna.length < K) continue;

    const dnaForAnalysis = dna.endsWith('TAA') || dna.endsWith('TAG') || dna.endsWith('TGA')
      ? dna.slice(0, -3) : dna;

    const protein = translate(dnaForAnalysis, 0);
    const repeated = findRepeatedKmers(dnaForAnalysis, K);

    for (const [kmer, positions] of repeated) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const pos1 = positions[i];
          const pos2 = positions[j];
          if (pos1 % 3 !== pos2 % 3) continue; // only same-frame

          const aa1 = protein.slice(Math.floor(pos1 / 3), Math.ceil((pos1 + K) / 3));
          const aa2 = protein.slice(Math.floor(pos2 / 3), Math.ceil((pos2 + K) / 3));
          if (aa1 === aa2) continue; // only diff-AA

          // Count how many positions differ
          const minLen = Math.min(aa1.length, aa2.length);
          const diffPositions: number[] = [];
          for (let p = 0; p < minLen; p++) {
            if (aa1[p] !== aa2[p]) diffPositions.push(p);
          }

          diffAAPairs.push({
            kmer,
            aa1, aa2,
            numDiffPositions: diffPositions.length,
            diffPositions,
            frame: pos1 % 3,
          });
        }
      }
    }
  }

  // Distribution of number of differing AA positions
  const diffCountDist: Record<number, number> = {};
  for (const pair of diffAAPairs) {
    diffCountDist[pair.numDiffPositions] = (diffCountDist[pair.numDiffPositions] || 0) + 1;
  }

  console.log();
  console.log(`Total "same frame, diff AA" pairs: ${diffAAPairs.length}`);
  console.log();
  console.log('Number of differing AA positions in the 5-AA window:');
  for (const [n, count] of Object.entries(diffCountDist).sort((a, b) => +a[0] - +b[0])) {
    const pct = (count / diffAAPairs.length * 100).toFixed(1);
    console.log(`  ${n} AA differ: ${count} pairs (${pct}%)`);
  }

  // Which positions in the 5-AA window tend to differ?
  const positionDiffCounts = [0, 0, 0, 0, 0, 0]; // up to 6 positions possible
  for (const pair of diffAAPairs) {
    for (const p of pair.diffPositions) {
      if (p < positionDiffCounts.length) positionDiffCounts[p]++;
    }
  }
  console.log();
  console.log('Which AA positions within the window tend to differ:');
  console.log('  (Position 0 = first AA overlapping the 13-mer, etc.)');
  for (let i = 0; i < 6; i++) {
    if (positionDiffCounts[i] > 0) {
      console.log(`  Position ${i}: ${positionDiffCounts[i]} times`);
    }
  }

  // Frame offset distribution
  const frameOfDiffAA: Record<number, number> = {};
  for (const pair of diffAAPairs) {
    frameOfDiffAA[pair.frame] = (frameOfDiffAA[pair.frame] || 0) + 1;
  }
  console.log();
  console.log('Frame offset of diff-AA pairs:');
  for (const [f, count] of Object.entries(frameOfDiffAA)) {
    console.log(`  Frame ${f}: ${count} pairs`);
  }

  // Codon freedom analysis: how many synonymous codons exist for the differing positions?
  // Build reverse codon table: AA -> list of codons
  const AA_TO_CODONS: Record<string, string[]> = {};
  for (const [codon, aa] of Object.entries(CODON_TABLE)) {
    if (aa === '*') continue;
    if (!AA_TO_CODONS[aa]) AA_TO_CODONS[aa] = [];
    AA_TO_CODONS[aa].push(codon);
  }

  console.log();
  console.log('Codon freedom at differing positions:');
  console.log('  (How many synonymous codons exist for the AA that differs)');
  const freedomDist: Record<number, number> = {};
  let totalDiffPositions = 0;
  for (const pair of diffAAPairs) {
    for (const p of pair.diffPositions) {
      // The amino acid at the differing position in both occurrences
      const aa = pair.aa1[p]; // could use aa2[p] too, they differ
      const numCodons1 = AA_TO_CODONS[pair.aa1[p]]?.length || 0;
      const numCodons2 = AA_TO_CODONS[pair.aa2[p]]?.length || 0;
      // The freedom to break the repeat comes from EITHER occurrence
      // We need at least one alternative codon at one of the positions
      const maxFreedom = Math.max(numCodons1, numCodons2);
      freedomDist[maxFreedom] = (freedomDist[maxFreedom] || 0) + 1;
      totalDiffPositions++;
    }
  }
  for (const [n, count] of Object.entries(freedomDist).sort((a, b) => +a[0] - +b[0])) {
    console.log(`  ${n} synonymous codons available: ${count} (${(count/totalDiffPositions*100).toFixed(1)}%)`);
  }

  // Show some examples of diff-AA pairs where only 1 AA differs
  console.log();
  console.log('Examples of single-AA-difference pairs (first 20):');
  const singleDiffPairs = diffAAPairs.filter(p => p.numDiffPositions === 1);
  for (const pair of singleDiffPairs.slice(0, 20)) {
    const pos = pair.diffPositions[0];
    const codons1 = AA_TO_CODONS[pair.aa1[pos]]?.length || 0;
    const codons2 = AA_TO_CODONS[pair.aa2[pos]]?.length || 0;
    console.log(`  13mer: ${pair.kmer}  frame:${pair.frame}  AA1:${pair.aa1} AA2:${pair.aa2}  diff@${pos}: ${pair.aa1[pos]}(${codons1}codons)/${pair.aa2[pos]}(${codons2}codons)`);
  }
}

main().catch(console.error);
