const documentTypePatterns = [
  /\bdriver'?s?\s+licen[cs]e\b/i,
  /\blicen[cs]e\b/i,
  /\bpassport\b/i,
  /\bproof\s+of\s+age\b/i,
  /\bphoto\s*card\b/i,
  /\bidentity\s+card\b/i,
  /\bidentification\s+card\b/i,
  /\bmedicare\b/i,
];

const identityFieldPatterns = [
  /\b(?:date\s+of\s+birth|dob)\b/i,
  /\b(?:surname|family\s+name|given\s+names?)\b/i,
  /\b(?:address|sex|gender)\b/i,
  /\b(?:expiry|expires?|class|licen[cs]e\s*(?:no|number))\b/i,
];

export function hasPhotoIdText(text: string): boolean {
  const documentType = documentTypePatterns.some((pattern) => pattern.test(text));
  const identityFieldCount = identityFieldPatterns.filter((pattern) => pattern.test(text)).length;

  return documentType && identityFieldCount >= 1;
}

export const unrecognizedPhotoIdMessage =
  "We couldn’t recognize this as an ID. Fit the full card in the frame and try again.";
