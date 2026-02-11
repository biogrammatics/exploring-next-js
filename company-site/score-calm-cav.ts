import * as fs from 'fs';
import { execSync } from 'child_process';

// Import both optimizers
import {
  NinemerBeamSearchOptimizer,
  type NinemerScores,
} from "./src/lib/beam-search-optimizer";

import {
  DPCodonOptimizer,
} from "./src/lib/dp-optimizer";

// Output files
const OUTPUT_FILE = '/Users/studio/Claude/reverse-translation-optimization/calm_cav_results.txt';
const DNA_FILE = '/Users/studio/Claude/reverse-translation-optimization/dna_sequences.json';

// Parse FASTA
function parseFasta(filepath: string): Array<{ header: string; sequence: string }> {
  const content = fs.readFileSync(filepath, 'utf-8');
  const entries: Array<{ header: string; sequence: string }> = [];
  let currentHeader = '';
  let currentSeq = '';

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('>')) {
      if (currentHeader) {
        entries.push({ header: currentHeader, sequence: currentSeq });
      }
      currentHeader = trimmed.slice(1);
      currentSeq = '';
    } else {
      currentSeq += trimmed.replace(/\s/g, '');
    }
  }
  if (currentHeader) {
    entries.push({ header: currentHeader, sequence: currentSeq });
  }
  return entries;
}

// Analyze single codon usage
function getSingleCodonAAs(dna: string, protein: string): string[] {
  const aaCodons: Record<string, Set<string>> = {};
  const aaCounts: Record<string, number> = {};

  for (let i = 0; i < dna.length; i += 3) {
    const codon = dna.slice(i, i + 3);
    const aa = protein[i / 3];
    if (!aaCodons[aa]) {
      aaCodons[aa] = new Set();
      aaCounts[aa] = 0;
    }
    aaCodons[aa].add(codon);
    aaCounts[aa]++;
  }

  const singleCodonOnly = new Set(['M', 'W']);
  const result: string[] = [];

  for (const [aa, codons] of Object.entries(aaCodons)) {
    if (aaCounts[aa] > 1 && !singleCodonOnly.has(aa) && codons.size === 1) {
      result.push(`${aaCounts[aa]} of ${aaCounts[aa]} ${aa}`);
    }
  }

  return result;
}

async function main() {
  console.error("Loading data...");

  // Load scores and exclusions
  const scoresPath = '/Users/studio/Claude/reverse-translation-optimization/data/ninemer_scores_tripletcounts.json';
  const scoresData = JSON.parse(fs.readFileSync(scoresPath, 'utf-8'));
  const ninemerScores: NinemerScores = scoresData.ninemer_scores;

  const exclusionsPath = './data/codon-optimization/exclusions.txt';
  const exclusionPatterns = fs.readFileSync(exclusionsPath, 'utf-8');
  const exclusionsFasta = fs.readFileSync('/tmp/disallowed_full.fa', 'utf-8');

  // Create optimizers
  const beamOptimizer = new NinemerBeamSearchOptimizer(ninemerScores, {
    beamWidth: 100,
    exclusionPatterns,
    enforceUniqueSixmers: true,
    enforceHomopolymerDiversity: true,
  });

  const dpOptimizer = new DPCodonOptimizer(ninemerScores, {
    beamWidth: 100,
    pathsPerState: 8,
    exclusionPatterns: exclusionsFasta,
  });

  // Load proteins
  const fastaPath = '/Users/studio/Claude/reverse-translation-optimization/human283.fa';
  const proteins = parseFasta(fastaPath);
  console.error(`Loaded ${proteins.length} proteins`);

  // Store DNA sequences for CaLM scoring
  const dnaSequences: Array<{
    header: string;
    protein: string;
    beamDna: string | null;
    dpDna: string | null;
    beamSingleCodon: string[];
    dpSingleCodon: string[];
  }> = [];

  // Process each protein
  for (let i = 0; i < proteins.length; i++) {
    const { header, sequence } = proteins[i];

    if ((i + 1) % 20 === 0) {
      console.error(`Processing ${i + 1}/${proteins.length}...`);
    }

    let beamDna: string | null = null;
    let dpDna: string | null = null;
    let beamSingleCodon: string[] = [];
    let dpSingleCodon: string[] = [];

    // Beam search
    try {
      const beamResult = beamOptimizer.optimize(sequence);
      if (beamResult.success && beamResult.dnaSequence) {
        beamDna = beamResult.dnaSequence;
        beamSingleCodon = getSingleCodonAAs(beamDna, sequence);
      }
    } catch (e) {
      // failure
    }

    // DP
    try {
      const dpResult = dpOptimizer.optimize(sequence);
      if (dpResult.success && dpResult.dnaSequence) {
        dpDna = dpResult.dnaSequence;
        dpSingleCodon = getSingleCodonAAs(dpDna, sequence);
      }
    } catch (e) {
      // failure
    }

    dnaSequences.push({
      header,
      protein: sequence,
      beamDna,
      dpDna,
      beamSingleCodon,
      dpSingleCodon,
    });
  }

  // Save DNA sequences for Python CaLM scoring
  fs.writeFileSync(DNA_FILE, JSON.stringify(dnaSequences, null, 2));
  console.error(`DNA sequences saved to ${DNA_FILE}`);
  console.error("Now run Python script to score with CaLM...");
}

main().catch(console.error);
