/**
 * Analyze how much scoring freedom exists for amino acid subsequences
 * that generate repeated 13-mers.
 *
 * For each repeated AA 4-5mer (the core of a 13-mer repeat), look at the
 * 9-mer scoring matrix to see how peaked the score distribution is.
 * If there's a dominant codon path that scores much higher than alternatives,
 * the optimizer is "forced" to pick the same DNA and repeats are inevitable.
 */

import * as fs from 'fs';

// ---- Codon table ----
const GENETIC_CODE: Record<string, string> = {
  'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
  'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
  'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
  'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W',
  'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
  'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
  'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
  'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
  'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M',
  'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
  'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
  'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
  'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
  'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
  'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
  'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
};

// Build reverse mapping: AA -> codons
const AA_TO_CODONS: Record<string, string[]> = {};
for (const [codon, aa] of Object.entries(GENETIC_CODE)) {
  if (aa === '*') continue;
  if (!AA_TO_CODONS[aa]) AA_TO_CODONS[aa] = [];
  AA_TO_CODONS[aa].push(codon);
}

// ---- Load 9-mer scores ----
const scoresPath = '/Users/tom/Claude/exploring-nextjs/company-site/data/codon-optimization/ninemer_scores.json';
const rawScores = JSON.parse(fs.readFileSync(scoresPath, 'utf-8'));
const ninemerScores: Record<string, Record<string, number>> = rawScores.ninemer_scores || rawScores;

function translate(dna: string): string {
  let protein = '';
  for (let i = 0; i + 2 < dna.length; i += 3) {
    protein += GENETIC_CODE[dna.slice(i, i + 3)] || '?';
  }
  return protein;
}

// ---- FASTA + Twist parsing (reuse from analyze-repeat-frames) ----

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

function parseTwistCSV(filePath: string): Array<{name: string; complexity: string; insertSequence: string}> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const results: Array<{name: string; complexity: string; insertSequence: string}> = [];
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"' && content[i + 1] === '"') { currentField += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { currentField += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { currentRow.push(currentField); currentField = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && content[i + 1] === '\n') i++;
        currentRow.push(currentField); currentField = '';
        if (currentRow.length > 1) rows.push(currentRow);
        currentRow = [];
      } else { currentField += ch; }
    }
  }
  if (currentRow.length > 0) { currentRow.push(currentField); rows.push(currentRow); }
  const header = rows[0];
  const nameIdx = header.indexOf('Name');
  const complexityIdx = header.indexOf('Complexity');
  const insertIdx = header.indexOf('Insert sequence');
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    results.push({ name: row[nameIdx], complexity: row[complexityIdx], insertSequence: row[insertIdx] });
  }
  return results;
}

// ---- Enumerate all DNA encodings for an AA triplet and score them ----

/**
 * For a 3-AA triplet, enumerate all possible 9-mer DNA encodings,
 * look up their scores, and return sorted by score descending.
 */
function scoreAllEncodings(aaTriplet: string): Array<{dna: string; score: number}> {
  const aa1 = aaTriplet[0];
  const aa2 = aaTriplet[1];
  const aa3 = aaTriplet[2];

  const codons1 = AA_TO_CODONS[aa1];
  const codons2 = AA_TO_CODONS[aa2];
  const codons3 = AA_TO_CODONS[aa3];

  if (!codons1 || !codons2 || !codons3) return [];

  const results: Array<{dna: string; score: number}> = [];
  const tripletScores = ninemerScores[aaTriplet];

  for (const c1 of codons1) {
    for (const c2 of codons2) {
      for (const c3 of codons3) {
        const dna = c1 + c2 + c3;
        const score = tripletScores?.[dna] ?? 0;
        results.push({ dna, score });
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

// ---- Find repeated k-mers in DNA ----

function findRepeatedKmers(dna: string, k: number): Map<string, number[]> {
  const positions = new Map<string, number[]>();
  for (let i = 0; i <= dna.length - k; i++) {
    const kmer = dna.slice(i, i + k);
    if (!positions.has(kmer)) positions.set(kmer, []);
    positions.get(kmer)!.push(i);
  }
  const repeated = new Map<string, number[]>();
  for (const [kmer, pos] of positions) {
    if (pos.length > 1) repeated.set(kmer, pos);
  }
  return repeated;
}

// ---- Main analysis ----

async function main() {
  const seqs100 = parseFasta('/Users/tom/Claude/codon-optimization/dp_optimized_100.fasta');
  const seqs900 = parseFasta('/Users/tom/Claude/codon-optimization/dp_optimized_900.fasta');
  const allSeqs = new Map([...seqs100, ...seqs900]);

  const twist100 = parseTwistCSV('/Users/tom/Downloads/100 optimization test.csv');
  const twist900 = parseTwistCSV('/Users/tom/Downloads/100 optimization test (1).csv');
  const allTwist = [...twist100, ...twist900];
  const flagged = allTwist.filter(t => t.complexity === 'COMPLEX' || t.complexity === 'NOT ACCEPTED');

  const K = 13;

  console.log('='.repeat(90));
  console.log('SCORING FREEDOM ANALYSIS FOR REPEATED 13-MERS');
  console.log('='.repeat(90));
  console.log();

  // For each repeated 13-mer where the AA context is the same at both positions,
  // look at the AA triplets that make up the repeat and analyze scoring alternatives.

  // Collect unique repeated AA subsequences and their scoring data
  interface AARepeatInfo {
    aaSeq: string;        // the 4-5 AA subsequence
    triplets: string[];   // the 3-AA triplets covering this region
    bestDnaPerTriplet: Array<{dna: string; score: number}>;
    altDnaPerTriplet: Array<{dna: string; score: number}>;  // second-best
    scoreDelta: number;   // sum of (best - 2nd best) across triplets
    totalBestScore: number;
    totalAltScore: number;
    count: number;        // how many times this AA repeat appears
  }

  const aaRepeatMap = new Map<string, AARepeatInfo>();

  let totalSameAAPairs = 0;

  for (const entry of flagged) {
    let dna = allSeqs.get(entry.name);
    if (!dna) dna = entry.insertSequence;
    if (!dna || dna.length < K) continue;

    const dnaForAnalysis = dna.endsWith('TAA') || dna.endsWith('TAG') || dna.endsWith('TGA')
      ? dna.slice(0, -3) : dna;

    const protein = translate(dnaForAnalysis);
    const repeated = findRepeatedKmers(dnaForAnalysis, K);

    for (const [kmer, positions] of repeated) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const pos1 = positions[i];
          const pos2 = positions[j];
          if (pos1 % 3 !== pos2 % 3) continue;

          const aa1 = protein.slice(Math.floor(pos1 / 3), Math.ceil((pos1 + K) / 3));
          const aa2 = protein.slice(Math.floor(pos2 / 3), Math.ceil((pos2 + K) / 3));
          if (aa1 !== aa2) continue; // only same-AA pairs for this analysis

          totalSameAAPairs++;

          // The AA sequence spanning this 13-mer
          const aaSeq = aa1;

          if (!aaRepeatMap.has(aaSeq)) {
            // Analyze the triplets covering this AA region
            const aaStart = Math.floor(pos1 / 3);
            const triplets: string[] = [];
            for (let t = aaStart; t + 2 < aaStart + aaSeq.length; t++) {
              triplets.push(protein.slice(t, t + 3));
            }

            // For each triplet, find best and 2nd-best encoding
            const bestPerTriplet: Array<{dna: string; score: number}> = [];
            const altPerTriplet: Array<{dna: string; score: number}> = [];

            for (const triplet of triplets) {
              const encodings = scoreAllEncodings(triplet);
              if (encodings.length > 0) {
                bestPerTriplet.push(encodings[0]);
                // Find the best ALTERNATIVE that uses a different codon for the middle AA
                // (which is what we'd need to change to break the 9-mer)
                const bestMiddleCodon = encodings[0].dna.slice(3, 6);
                const alt = encodings.find(e => e.dna.slice(3, 6) !== bestMiddleCodon);
                altPerTriplet.push(alt || encodings[Math.min(1, encodings.length - 1)]);
              }
            }

            const totalBest = bestPerTriplet.reduce((s, x) => s + x.score, 0);
            const totalAlt = altPerTriplet.reduce((s, x) => s + x.score, 0);

            aaRepeatMap.set(aaSeq, {
              aaSeq,
              triplets,
              bestDnaPerTriplet: bestPerTriplet,
              altDnaPerTriplet: altPerTriplet,
              scoreDelta: totalBest - totalAlt,
              totalBestScore: totalBest,
              totalAltScore: totalAlt,
              count: 0,
            });
          }

          aaRepeatMap.get(aaSeq)!.count++;
        }
      }
    }
  }

  console.log(`Total same-AA repeat pairs: ${totalSameAAPairs}`);
  console.log(`Unique AA subsequences causing repeats: ${aaRepeatMap.size}`);
  console.log();

  // Sort by count (most common AA repeats)
  const sorted = [...aaRepeatMap.values()].sort((a, b) => b.count - a.count);

  // Show the scoring landscape for the top repeats
  console.log('TOP 40 MOST COMMON REPEATED AA SUBSEQUENCES:');
  console.log('-'.repeat(90));
  console.log(
    'AA Seq'.padEnd(8) +
    'Count'.padEnd(8) +
    'Triplets'.padEnd(20) +
    'BestScore'.padEnd(12) +
    'AltScore'.padEnd(12) +
    'Delta'.padEnd(10) +
    '%Penalty'
  );

  for (const info of sorted.slice(0, 40)) {
    const pctPenalty = info.totalBestScore > 0
      ? ((info.scoreDelta / info.totalBestScore) * 100).toFixed(1)
      : '0.0';
    console.log(
      info.aaSeq.padEnd(8) +
      String(info.count).padEnd(8) +
      info.triplets.join(',').padEnd(20) +
      String(info.totalBestScore).padEnd(12) +
      String(info.totalAltScore).padEnd(12) +
      String(info.scoreDelta).padEnd(10) +
      pctPenalty + '%'
    );
  }

  // Distribution of score penalties
  console.log();
  console.log('='.repeat(90));
  console.log('SCORE PENALTY DISTRIBUTION FOR USING ALTERNATIVE CODONS');
  console.log('='.repeat(90));
  console.log('(How much score we lose per triplet to break a repeat)');
  console.log();

  const penalties = sorted.map(s => ({
    pct: s.totalBestScore > 0 ? (s.scoreDelta / s.totalBestScore * 100) : 0,
    count: s.count,
  }));

  // Weighted by occurrence count
  const buckets = [0, 1, 2, 5, 10, 20, 50, 100];
  for (let b = 0; b < buckets.length - 1; b++) {
    const lo = buckets[b];
    const hi = buckets[b + 1];
    const inBucket = penalties.filter(p => p.pct >= lo && p.pct < hi);
    const totalCount = inBucket.reduce((s, x) => s + x.count, 0);
    const uniqueSeqs = inBucket.length;
    console.log(`  ${lo}-${hi}% penalty: ${uniqueSeqs} unique AA seqs (${totalCount} total occurrences)`);
  }
  const over50 = penalties.filter(p => p.pct >= 50);
  console.log(`  ≥50% penalty: ${over50.length} unique AA seqs (${over50.reduce((s, x) => s + x.count, 0)} total occurrences)`);

  // Now do a deeper per-triplet analysis: for each 3-AA triplet, how many
  // 9-mer alternatives are within X% of the best score?
  console.log();
  console.log('='.repeat(90));
  console.log('PER-TRIPLET SCORING LANDSCAPE');
  console.log('='.repeat(90));
  console.log();

  // Collect all unique triplets involved in repeats
  const tripletSet = new Set<string>();
  for (const info of sorted) {
    for (const t of info.triplets) {
      tripletSet.add(t);
    }
  }

  // For each triplet, show how many distinct 9-mers are within 10%, 20%, 50% of best
  console.log('Triplet  | Best | #Within10% | #Within20% | #Within50% | TotalEncodings | BestDNA');
  for (const triplet of [...tripletSet].sort()) {
    const encodings = scoreAllEncodings(triplet);
    if (encodings.length === 0) continue;

    const best = encodings[0].score;
    const within10 = encodings.filter(e => e.score >= best * 0.9).length;
    const within20 = encodings.filter(e => e.score >= best * 0.8).length;
    const within50 = encodings.filter(e => e.score >= best * 0.5).length;

    console.log(
      `${triplet}    | ${String(best).padEnd(5)}| ${String(within10).padEnd(11)}| ${String(within20).padEnd(11)}| ${String(within50).padEnd(11)}| ${String(encodings.length).padEnd(15)}| ${encodings[0].dna}`
    );
  }

  // Summary: on average how many alternatives are within 10% of best?
  console.log();
  const tripletStats = [...tripletSet].map(triplet => {
    const encodings = scoreAllEncodings(triplet);
    const best = encodings[0]?.score || 0;
    return {
      triplet,
      total: encodings.length,
      within10: encodings.filter(e => e.score >= best * 0.9).length,
      within20: encodings.filter(e => e.score >= best * 0.8).length,
    };
  });

  const avgWithin10 = tripletStats.reduce((s, x) => s + x.within10, 0) / tripletStats.length;
  const avgWithin20 = tripletStats.reduce((s, x) => s + x.within20, 0) / tripletStats.length;
  const avgTotal = tripletStats.reduce((s, x) => s + x.total, 0) / tripletStats.length;

  console.log(`Average across ${tripletStats.length} unique triplets involved in repeats:`);
  console.log(`  Total possible encodings: ${avgTotal.toFixed(1)}`);
  console.log(`  Within 10% of best: ${avgWithin10.toFixed(1)}`);
  console.log(`  Within 20% of best: ${avgWithin20.toFixed(1)}`);
}

main().catch(console.error);
