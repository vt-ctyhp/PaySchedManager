import type { PaymentSchedule } from "@shared/schema";

export interface FuzzyMatch {
  schedule: PaymentSchedule;
  similarity: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Normalize string for comparison:
 * - Convert to lowercase
 * - Replace punctuation with spaces
 * - Remove common corporate suffixes and domain extensions
 * - Normalize whitespace
 */
function normalizeString(str: string): string {
  let normalized = str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ')          // Normalize whitespace to single spaces
    .trim();
  
  // Remove common legal/corporate suffixes (order matters - longest first)
  // BUT only if the remaining name would still be substantial (≥6 chars or multiple words)
  // This threshold matches the substring matching gate to ensure consistency
  const suffixes = [
    'incorporated',
    'corporation',
    'company',
    'limited',
    'llc',
    'inc',
    'corp',
    'co',
    'ltd',
    'llp',
    'lp',
    'plc'
  ];
  
  for (const suffix of suffixes) {
    const pattern = new RegExp(`\\b${suffix}\\b\\s*$`, 'i');
    const withoutSuffix = normalized.replace(pattern, '').trim();
    
    // Only remove suffix if remaining name is substantial:
    // - At least 6 characters OR (matches substring matching threshold)
    // - Contains multiple words (has a space)
    if (withoutSuffix.length >= 6 || withoutSuffix.includes(' ')) {
      normalized = withoutSuffix;
    }
  }
  
  // Remove common domain extensions (but only if substantial name remains)
  const domainExtensions = ['com', 'net', 'org', 'io', 'app'];
  for (const ext of domainExtensions) {
    const pattern = new RegExp(`\\b${ext}\\b\\s*$`, 'i');
    const withoutExt = normalized.replace(pattern, '').trim();
    
    // Only remove extension if remaining name is substantial:
    // - At least 6 characters OR (matches substring matching threshold)
    // - Contains multiple words (has a space)
    if (withoutExt.length >= 6 || withoutExt.includes(' ')) {
      normalized = withoutExt;
    }
  }
  
  // Note: Intentionally NOT stripping "co" as a domain extension since it conflicts
  // with common corporate suffix "Co" and would collapse "Gas Co" → "Gas"
  
  return normalized;
}

/**
 * Calculate similarity percentage between two strings (0-100)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const normalized1 = normalizeString(str1);
  const normalized2 = normalizeString(str2);

  if (normalized1 === normalized2) return 100;
  if (normalized1.length === 0 || normalized2.length === 0) return 0;

  // Check for exact substring matches (strong signal of same vendor)
  const longerStr = normalized1.length > normalized2.length ? normalized1 : normalized2;
  const shorterStr = normalized1.length > normalized2.length ? normalized2 : normalized1;
  
  if (longerStr.includes(shorterStr)) {
    // Calculate how much of the longer string is the shorter string
    const ratio = shorterStr.length / longerStr.length;
    
    // Only boost to high confidence if BOTH conditions are met:
    // 1. Shorter string is long enough to be meaningful (≥6 chars) - prevents "bank"/"gas"
    // 2. Shorter string is substantial portion (≥45%) - handles "Spotify"/"Spotify Premium"
    // This allows "Spotify" (7 chars, 47%) but blocks "bank" (4 chars)
    if (shorterStr.length >= 6 && ratio >= 0.45) {
      return Math.round(Math.max(85, ratio * 100));
    }
    
    // For partial overlaps, use weighted Levenshtein distance
    // This ensures "bank"/"citibank" uses edit distance, not just ratio
    const distance = levenshteinDistance(normalized1, normalized2);
    const maxLength = Math.max(normalized1.length, normalized2.length);
    const levScore = ((maxLength - distance) / maxLength) * 100;
    
    // Give modest bonus for substring (max +15) to acknowledge the overlap
    const substringBonus = Math.min(15, ratio * 30);
    return Math.round(Math.min(84, levScore + substringBonus));
  }

  // Standard Levenshtein-based similarity for non-substring matches
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.round(similarity);
}

/**
 * Classify confidence level based on similarity score
 */
function classifyConfidence(similarity: number): 'high' | 'medium' | 'low' {
  if (similarity >= 85) return 'high';
  if (similarity >= 60) return 'medium';
  return 'low';
}

/**
 * Find best matching payment schedule for a vendor name
 */
export function findBestMatch(
  vendorName: string,
  paymentSchedules: PaymentSchedule[]
): FuzzyMatch | null {
  if (!vendorName || paymentSchedules.length === 0) {
    return null;
  }

  let bestMatch: FuzzyMatch | null = null;
  let highestSimilarity = 0;

  for (const schedule of paymentSchedules) {
    const similarity = calculateSimilarity(vendorName, schedule.vendorName);
    
    if (similarity > highestSimilarity) {
      highestSimilarity = similarity;
      bestMatch = {
        schedule,
        similarity,
        confidence: classifyConfidence(similarity)
      };
    }
  }

  // Only return matches with at least 50% similarity
  if (bestMatch && bestMatch.similarity >= 50) {
    return bestMatch;
  }

  return null;
}

/**
 * Find all matches above a minimum threshold, sorted by similarity
 */
export function findAllMatches(
  vendorName: string,
  paymentSchedules: PaymentSchedule[],
  minSimilarity: number = 50
): FuzzyMatch[] {
  if (!vendorName || paymentSchedules.length === 0) {
    return [];
  }

  const matches: FuzzyMatch[] = [];

  for (const schedule of paymentSchedules) {
    const similarity = calculateSimilarity(vendorName, schedule.vendorName);
    
    if (similarity >= minSimilarity) {
      matches.push({
        schedule,
        similarity,
        confidence: classifyConfidence(similarity)
      });
    }
  }

  // Sort by similarity descending
  return matches.sort((a, b) => b.similarity - a.similarity);
}
