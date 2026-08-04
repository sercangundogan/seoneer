export type CadenceRecommendation = {
  label: string;
  minDaysBetweenActions: number;
  preferUpdatesOverNew: boolean;
  rationale: string;
};

export function recommendCadence(input: {
  blogExists: boolean;
  gscConnected: boolean;
  issueCount: number;
  opportunityCount: number;
  plan: string;
}): CadenceRecommendation {
  if (!input.blogExists || input.issueCount > 3) {
    return {
      label: "Foundation first",
      minDaysBetweenActions: 7,
      preferUpdatesOverNew: true,
      rationale:
        "Technical or structural gaps should be closed before a publishing cadence.",
    };
  }
  if (!input.gscConnected) {
    return {
      label: "Conservative",
      minDaysBetweenActions: 14,
      preferUpdatesOverNew: true,
      rationale: "Without Search Console data, prefer fewer, higher-confidence updates.",
    };
  }
  if (input.opportunityCount > 5 && input.plan !== "free") {
    return {
      label: "Steady",
      minDaysBetweenActions: 7,
      preferUpdatesOverNew: true,
      rationale:
        "Enough opportunities exist to act weekly, still preferring updates over new posts.",
    };
  }
  return {
    label: "Measured",
    minDaysBetweenActions: 10,
    preferUpdatesOverNew: true,
    rationale: "Default measured cadence; never publish for volume alone.",
  };
}
