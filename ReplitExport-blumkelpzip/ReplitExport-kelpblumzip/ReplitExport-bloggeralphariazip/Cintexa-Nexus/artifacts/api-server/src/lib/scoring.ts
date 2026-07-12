// NEXUS Lead Scoring Engine — a transparent, rule-based scoring model in the
// spirit of Zoho/HubSpot lead scoring, but expressed as auditable point
// factors rather than a black box. Every factor is returned in the
// breakdown so a rep can see exactly why a lead scored the way it did.
// AI qualification (see lib/ai.ts qualifyLead) can still override this with
// a richer LLM judgment when OPENAI_API_KEY is configured — this engine is
// what runs everywhere else, instantly and for free.

export type ScoreFactor = {
  label: string;
  points: number;
};

export type ScoreResult = {
  score: number;
  breakdown: ScoreFactor[];
  band: "hot" | "warm" | "cold" | "unqualified";
};

const SOURCE_POINTS: Record<string, number> = {
  referral: 25,
  event: 20,
  website: 15,
  email: 10,
  social: 8,
  cold_call: 5,
  other: 5,
};

const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
]);

export type ScorableLead = {
  email: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  source: string;
  status: string;
  createdAt: Date;
};

export function computeLeadScore(lead: ScorableLead): ScoreResult {
  const breakdown: ScoreFactor[] = [];

  const sourcePoints = SOURCE_POINTS[lead.source] ?? SOURCE_POINTS.other;
  breakdown.push({ label: `Source: ${lead.source.replace("_", " ")}`, points: sourcePoints });

  if (lead.company) {
    breakdown.push({ label: "Company identified", points: 15 });
  }

  const domain = lead.email.split("@")[1]?.toLowerCase();
  if (domain && !FREE_EMAIL_DOMAINS.has(domain)) {
    breakdown.push({ label: "Business email domain", points: 10 });
  }

  if (lead.phone) {
    breakdown.push({ label: "Phone number provided", points: 5 });
  }

  const noteLength = lead.notes?.trim().length ?? 0;
  if (noteLength > 50) {
    breakdown.push({ label: "Rich engagement notes", points: 10 });
  } else if (noteLength > 0) {
    breakdown.push({ label: "Some engagement notes", points: 5 });
  }

  if (lead.status === "contacted") {
    breakdown.push({ label: "Already contacted", points: 10 });
  }

  const ageDays = (Date.now() - lead.createdAt.getTime()) / 86_400_000;
  if (ageDays <= 7) {
    breakdown.push({ label: "Fresh lead (< 7 days old)", points: 10 });
  } else if (ageDays > 30 && lead.status === "new") {
    breakdown.push({ label: "Stale — untouched for 30+ days", points: -15 });
  }

  const raw = breakdown.reduce((sum, f) => sum + f.points, 0);
  const score = Math.max(0, Math.min(100, raw));

  const band: ScoreResult["band"] =
    lead.status === "unqualified"
      ? "unqualified"
      : score >= 70
        ? "hot"
        : score >= 45
          ? "warm"
          : "cold";

  return { score, breakdown, band };
}
