/**
 * Parse email addresses from a CSV string.
 * Looks for a column named "email" (case-insensitive).
 * Falls back to first column if no email header found.
 * Returns deduped, lowercased, trimmed email addresses.
 */
export function parseCsvEmails(csvText: string): string[] {
  // Normalize line endings (CRLF → LF)
  const normalized = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const lines = normalized.split("\n");
  if (lines.length === 0) return [];

  // Parse a single CSV row, handling quoted fields
  function parseRow(line: string): string[] {
    const fields: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        // Quoted field
        let value = "";
        i++; // skip opening quote
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') {
            // Escaped quote
            value += '"';
            i += 2;
          } else if (line[i] === '"') {
            i++; // skip closing quote
            break;
          } else {
            value += line[i];
            i++;
          }
        }
        fields.push(value);
        // Skip comma after field if present
        if (i < line.length && line[i] === ",") i++;
      } else {
        // Unquoted field
        const commaIdx = line.indexOf(",", i);
        if (commaIdx === -1) {
          fields.push(line.slice(i));
          break;
        } else {
          fields.push(line.slice(i, commaIdx));
          i = commaIdx + 1;
        }
      }
    }
    return fields;
  }

  // Find non-empty lines
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0);
  if (nonEmptyLines.length === 0) return [];

  // Parse header row
  const headerLine = nonEmptyLines[0];
  const headers = parseRow(headerLine).map((h) => h.trim().toLowerCase());

  // Determine email column index
  let emailColIndex = headers.indexOf("email");
  const hasHeader = emailColIndex !== -1;

  if (!hasHeader) {
    // Fall back to first column (no header row recognized)
    emailColIndex = 0;
  }

  // Parse data rows
  const dataLines = hasHeader ? nonEmptyLines.slice(1) : nonEmptyLines;

  const emails: string[] = [];
  const seen = new Set<string>();

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const fields = parseRow(line);
    const raw = fields[emailColIndex]?.trim() ?? "";
    if (!raw) continue;
    const email = raw.toLowerCase().trim();
    // Basic email validation: must contain @ and a dot after @
    if (!email.includes("@")) continue;
    const atIdx = email.indexOf("@");
    const domain = email.slice(atIdx + 1);
    if (!domain.includes(".")) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    emails.push(email);
  }

  return emails;
}
