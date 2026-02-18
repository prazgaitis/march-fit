import { describe, it, expect } from "vitest";
import { parseCsvEmails } from "../../lib/parse-csv-emails";

describe("parseCsvEmails", () => {
  it("handles header row with lowercase email column", () => {
    const csv = `email,name\nalice@example.com,Alice\nbob@example.com,Bob`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("handles header row with Email (capitalized)", () => {
    const csv = `Email,Name\nalice@example.com,Alice\nbob@example.com,Bob`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("handles header row with EMAIL (uppercase)", () => {
    const csv = `EMAIL,NAME\nalice@example.com,Alice\nbob@example.com,Bob`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("falls back to first column when no email header found", () => {
    const csv = `alice@example.com,Alice\nbob@example.com,Bob`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("strips whitespace and lowercases emails", () => {
    const csv = `email\n  Alice@Example.COM  \n  BOB@TEST.ORG  `;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@test.org"]);
  });

  it("deduplicates emails", () => {
    const csv = `email\nalice@example.com\nalice@example.com\nbob@example.com`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("skips empty rows", () => {
    const csv = `email\nalice@example.com\n\n\nbob@example.com\n`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("handles quoted CSV values", () => {
    const csv = `name,email\n"Alice Smith","alice@example.com"\n"Bob Jones","bob@example.com"`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("handles Windows line endings (CRLF)", () => {
    const csv = `email,name\r\nalice@example.com,Alice\r\nbob@example.com,Bob`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("returns empty array for empty input", () => {
    expect(parseCsvEmails("")).toEqual([]);
    expect(parseCsvEmails("   ")).toEqual([]);
    expect(parseCsvEmails("\n\n\n")).toEqual([]);
  });

  it("skips values without @ sign", () => {
    const csv = `email\nalice@example.com\nnotanemail\nbob@example.com`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("skips values with @ but no domain dot", () => {
    const csv = `email\nalice@example.com\nbad@nodot\nbob@example.com`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("handles email column not being first column", () => {
    const csv = `name,email,phone\nAlice,alice@example.com,555-1234\nBob,bob@example.com,555-5678`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("handles single email with no header", () => {
    const csv = `alice@example.com`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com"]);
  });

  it("handles quoted field with comma inside", () => {
    const csv = `email,name\nalice@example.com,"Smith, Alice"\nbob@example.com,"Jones, Bob"`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com", "bob@example.com"]);
  });

  it("deduplicates case-insensitively", () => {
    const csv = `email\nAlice@Example.COM\nalice@example.com\nALICE@EXAMPLE.COM`;
    expect(parseCsvEmails(csv)).toEqual(["alice@example.com"]);
  });
});
