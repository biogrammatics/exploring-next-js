/**
 * FASTA File Parser
 *
 * Ported from Rails service: app/services/fasta_parser_service.rb
 *
 * Parses FASTA format files containing protein sequences.
 * FASTA format:
 *   >SequenceName [Optional description]
 *   AMINOACIDSEQUENCE...
 *
 * Supports multiple sequences per file.
 */

import {
  AMINO_ACIDS,
  cleanSequence,
  normalizeSequence,
} from "./amino-acid-validation";

export interface ParsedProtein {
  name: string;
  description: string;
  aminoAcidSequence: string;
  originalSequence: string;
  sequenceOrder: number;
}

export interface ParseResult {
  success: boolean;
  proteins: ParsedProtein[];
  errors: string[];
  warnings: string[];
}

/**
 * FASTA Parser class for processing protein sequence files.
 */
export class FastaParser {
  private content: string;
  private errors: string[] = [];
  private warnings: string[] = [];
  private proteins: ParsedProtein[] = [];

  constructor(fileContent: string) {
    this.content = fileContent;
  }

  /**
   * Parse the FASTA content and return results.
   */
  parse(): ParseResult {
    this.errors = [];
    this.warnings = [];
    this.proteins = [];

    if (!this.validateContent()) {
      return this.getResult();
    }

    const sequences = this.extractSequences();

    if (sequences.length === 0) {
      this.errors.push("No valid sequences found in file");
      return this.getResult();
    }

    this.proteins = sequences.map((seq, index) => ({
      name: seq.name,
      description: seq.description,
      aminoAcidSequence: seq.sequence,
      originalSequence: seq.originalSequence,
      sequenceOrder: index + 1,
    }));

    this.validateSequences();

    return this.getResult();
  }

  /**
   * Get the parse result.
   */
  private getResult(): ParseResult {
    return {
      success: this.errors.length === 0,
      proteins: this.proteins,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Validate that the content looks like FASTA format.
   */
  private validateContent(): boolean {
    if (!this.content || this.content.trim().length === 0) {
      this.errors.push("File is empty");
      return false;
    }

    if (!this.content.includes(">")) {
      this.errors.push(
        "File does not appear to be in FASTA format (no header lines found)"
      );
      return false;
    }

    return true;
  }

  /**
   * Extract individual sequences from the FASTA content.
   */
  private extractSequences(): Array<{
    name: string;
    description: string;
    sequence: string;
    originalSequence: string;
  }> {
    const sequences: Array<{
      name: string;
      description: string;
      sequence: string;
      originalSequence: string;
    }> = [];

    let currentHeader: string | null = null;
    let currentSequence = "";

    const lines = this.content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (line.startsWith(">")) {
        // Save previous sequence if exists
        if (currentHeader !== null && currentSequence.length > 0) {
          sequences.push(this.processSequence(currentHeader, currentSequence));
        }

        // Start new sequence
        currentHeader = line.substring(1); // Remove ">" character
        currentSequence = "";
      } else if (line.length > 0 && currentHeader !== null) {
        // Accumulate sequence data (remove whitespace, uppercase)
        currentSequence += line.replace(/\s+/g, "").toUpperCase();
      }
    }

    // Don't forget the last sequence
    if (currentHeader !== null && currentSequence.length > 0) {
      sequences.push(this.processSequence(currentHeader, currentSequence));
    }

    return sequences;
  }

  /**
   * Process a single sequence, parsing header and cleaning sequence.
   */
  private processSequence(
    header: string,
    sequence: string
  ): {
    name: string;
    description: string;
    sequence: string;
    originalSequence: string;
  } {
    // Parse header to extract name and description
    // Supports various formats:
    //   >ProteinName [description]
    //   >ProteinName description
    //   >ProteinName|description

    const parsed = this.parseHeader(header);
    const originalSequence = sequence;
    const cleanedSequence = this.cleanAndNormalizeSequence(sequence);

    return {
      name: parsed.name,
      description: parsed.description,
      sequence: cleanedSequence,
      originalSequence: originalSequence,
    };
  }

  /**
   * Parse a FASTA header line to extract name and description.
   */
  private parseHeader(header: string): { name: string; description: string } {
    // Try to extract name (first non-whitespace, non-bracket, non-pipe token)
    const nameMatch = header.match(/^([^\s\[\|]+)/);
    const name = nameMatch ? nameMatch[1].trim() : "Protein";

    let description = "";

    // Try various description formats
    if (header.includes("[") && header.includes("]")) {
      // Format: >Name [Description]
      const descMatch = header.match(/\[([^\]]+)\]/);
      description = descMatch ? descMatch[1].trim() : "";
    } else if (header.includes("|")) {
      // Format: >Name|Description
      const parts = header.split("|");
      description = parts.slice(1).join("|").trim();
    } else {
      // Format: >Name Description (space separated)
      const parts = header.split(/\s+/);
      description = parts.slice(1).join(" ");
    }

    return { name, description };
  }

  /**
   * Clean a sequence and ensure it has proper start/end.
   */
  private cleanAndNormalizeSequence(sequence: string): string {
    // Remove any non-amino acid characters except stop codon
    const aminoAcidPattern = new RegExp(
      `[^${AMINO_ACIDS.join("")}]`,
      "gi"
    );
    let cleaned = sequence.replace(aminoAcidPattern, "").toUpperCase();

    // Use normalizeSequence to add M and * if needed
    cleaned = normalizeSequence(cleaned, true, true);

    return cleaned;
  }

  /**
   * Validate all parsed sequences.
   */
  private validateSequences(): void {
    const aminoAcidSet = new Set<string>(AMINO_ACIDS);

    this.proteins.forEach((protein, index) => {
      const sequence = protein.aminoAcidSequence;
      const proteinLabel = `Protein ${index + 1} (${protein.name})`;

      // Check for minimum length
      if (sequence.length < 3) {
        this.errors.push(
          `${proteinLabel}: sequence too short (minimum 3 amino acids)`
        );
      }

      // Check for valid amino acids (shouldn't happen after cleaning, but double-check)
      const uniqueChars = [...new Set(sequence.split(""))];
      const invalidChars = uniqueChars.filter((char) => !aminoAcidSet.has(char));
      if (invalidChars.length > 0) {
        this.errors.push(
          `${proteinLabel}: contains invalid amino acid codes: ${invalidChars.join(", ")}`
        );
      }

      // Add warnings for auto-corrections
      if (!protein.originalSequence.toUpperCase().startsWith("M")) {
        this.warnings.push(
          `${proteinLabel}: did not start with methionine (M) - added automatically`
        );
      }

      if (!protein.originalSequence.toUpperCase().endsWith("*")) {
        this.warnings.push(
          `${proteinLabel}: did not end with stop codon (*) - added automatically`
        );
      }
    });
  }
}

/**
 * Convenience function to parse FASTA content.
 */
export function parseFasta(content: string): ParseResult {
  const parser = new FastaParser(content);
  return parser.parse();
}

/**
 * Parse FASTA content from a File object.
 */
export async function parseFastaFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        resolve(parseFasta(content));
      } else {
        reject(new Error("Failed to read file as text"));
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsText(file);
  });
}

/**
 * Validate that a file appears to be a FASTA file based on extension and content preview.
 */
export function isFastaFile(file: File): boolean {
  const validExtensions = [".fasta", ".fa", ".faa", ".fas", ".txt"];
  const fileName = file.name.toLowerCase();
  return validExtensions.some((ext) => fileName.endsWith(ext));
}

/**
 * Generate a sample FASTA file content for testing/demonstration.
 */
export function generateSampleFasta(): string {
  return `>GFP [Green Fluorescent Protein]
MSKGEELFTGVVPILVELDGDVNGHKFSVSGEGEGDATYGKLTLKFICTTGKLPVPWPTL
VTTFSYGVQCFSRYPDHMKQHDFFKSAMPEGYVQERTIFFKDDGNYKTRAEVKFEGDTLV
NRIELKGIDFKEDGNILGHKLEYNYNSHNVYIMADKQKNGIKVNFKIRHNIEDGSVQLAD
HYQQNTPIGDGPVLLPDNHYLSTQSALSKDPNEKRDHMVLLEFVTAAGITHGMDELYK*

>mCherry [Red Fluorescent Protein]
MVSKGEEDNMAIIKEFMRFKVHMEGSVNGHEFEIEGEGEGRPYEGTQTAKLKVTKGGPLP
FAWDILSPQFMYGSKAYVKHPADIPDYLKLSFPEGFKWERVMNFEDGGVVTVTQDSSLQD
GEFIYKVKLRGTNFPSDGPVMQKKTMGWEASSERMYPEDGALKGEIKQRLKLKDGGHYDA
EVKTTYKAKKPVQLPGAYNVNIKLDITSHNEDYTIVEQYERAEGRHSTGGMDELYK*
`;
}
