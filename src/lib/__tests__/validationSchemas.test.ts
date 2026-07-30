import { describe, it, expect } from "vitest";
import { patientSourceSchema } from "../validationSchemas";

// phoneSchema and urlSchema are not exported directly, so they are exercised
// through patientSourceSchema, which is where the app uses them.
const base = {
  name: "Smile Dental",
  source: "Office" as const,
};

const phoneResult = (phone?: string) =>
  patientSourceSchema.safeParse({ ...base, phone });
const websiteResult = (website?: string) =>
  patientSourceSchema.safeParse({ ...base, website });

describe("phone validation", () => {
  const valid = [
    "1234567",
    "555-123-4567",
    "(555) 123-4567",
    "+1 555 123 4567",
    "+44 20 7946 0958",
    "555.123.4567".replace(/\./g, "-"),
    "  555 123 4567",
  ];

  it.each(valid)("accepts %j", (phone) => {
    expect(phoneResult(phone).success).toBe(true);
  });

  const invalid = [
    ["too few digits", "12345"],
    ["letters", "call-me-now"],
    ["mixed letters and digits", "555-CALL-123"],
    ["dots as separators", "555.123.4567"],
    ["extension marker", "555-123-4567 ext 9"],
    ["symbols", "555#123#4567"],
    ["leading plus only", "+"],
    ["punctuation only", "()-  "],
  ];

  it.each(invalid)("rejects %s", (_label, phone) => {
    const result = phoneResult(phone as string);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) =>
          i.message.includes("valid phone number")
        )
      ).toBe(true);
    }
  });

  it("accepts exactly 6 digits (the documented minimum)", () => {
    expect(phoneResult("123456").success).toBe(true);
  });

  it("treats an omitted or empty phone as valid (optional field)", () => {
    expect(phoneResult(undefined).success).toBe(true);
    expect(phoneResult("").success).toBe(true);
  });
});

describe("URL validation", () => {
  const valid = [
    "http://example.com",
    "https://example.com",
    "https://www.example.com/path",
    "https://sub.domain.example.co.uk",
    "https://example.com/path?q=1#hash",
    "https://example.com:8443/x",
  ];

  it.each(valid)("accepts %j", (url) => {
    expect(websiteResult(url).success).toBe(true);
  });

  const invalid = [
    ["missing protocol", "example.com"],
    ["www without protocol", "www.example.com"],
    ["unsupported protocol", "ftp://example.com"],
    ["protocol only", "https://"],
    ["no dot in host", "https://localhost"],
    ["nothing after the dot", "https://example."],
    ["nothing before the dot", "https://.com"],
    ["plain text", "not a url"],
  ];

  it.each(invalid)("rejects %s", (_label, url) => {
    const result = websiteResult(url as string);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.message.includes("valid URL"))
      ).toBe(true);
    }
  });

  it("treats an omitted or empty website as valid (optional field)", () => {
    expect(websiteResult(undefined).success).toBe(true);
    expect(websiteResult("").success).toBe(true);
  });
});

describe("patientSourceSchema - other fields", () => {
  it("accepts a minimal valid record", () => {
    expect(patientSourceSchema.safeParse(base).success).toBe(true);
  });

  it("requires a non-empty name", () => {
    expect(patientSourceSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  it("rejects an unknown source", () => {
    expect(
      patientSourceSchema.safeParse({ ...base, source: "Carrier Pigeon" }).success
    ).toBe(false);
  });

  it("accepts ratings between 0 and 5 and rejects those outside", () => {
    for (const rating of ["0", "4.5", "5"]) {
      expect(
        patientSourceSchema.safeParse({ ...base, google_rating: rating }).success
      ).toBe(true);
    }
    for (const rating of ["-1", "5.1", "abc"]) {
      expect(
        patientSourceSchema.safeParse({ ...base, google_rating: rating }).success
      ).toBe(false);
    }
  });

  it("rejects a negative distance", () => {
    expect(
      patientSourceSchema.safeParse({ ...base, distance_from_clinic: "-3" }).success
    ).toBe(false);
    expect(
      patientSourceSchema.safeParse({ ...base, distance_from_clinic: "3.5" }).success
    ).toBe(true);
  });

  it("rejects a negative patient load", () => {
    expect(
      patientSourceSchema.safeParse({ ...base, patient_load: "-1" }).success
    ).toBe(false);
    expect(
      patientSourceSchema.safeParse({ ...base, patient_load: "20" }).success
    ).toBe(true);
  });

  it("allows an empty email but rejects a malformed one", () => {
    expect(patientSourceSchema.safeParse({ ...base, email: "" }).success).toBe(true);
    expect(
      patientSourceSchema.safeParse({ ...base, email: "nope@" }).success
    ).toBe(false);
    expect(
      patientSourceSchema.safeParse({ ...base, email: "hi@example.com" }).success
    ).toBe(true);
  });

  it("enforces max lengths", () => {
    expect(
      patientSourceSchema.safeParse({ ...base, name: "a".repeat(256) }).success
    ).toBe(false);
    expect(
      patientSourceSchema.safeParse({ ...base, notes: "a".repeat(1001) }).success
    ).toBe(false);
  });
});
