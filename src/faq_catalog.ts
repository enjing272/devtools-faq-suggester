export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
  area: "build" | "release" | "diagnostics";
  event: string;
};

export const faqCatalog: FaqEntry[] = [
  {
    id: "build-cache-miss",
    question: "Why did this build miss the dependency cache?",
    answer: "Compare the lockfile digest and runtime version with the previous successful build. Either change produces a new cache key.",
    area: "build",
    event: "build.cache_missed"
  },
  {
    id: "build-artifact-missing",
    question: "Why was no artifact attached to the build?",
    answer: "Check that the output directory matches the artifact path recorded by the build job.",
    area: "build",
    event: "build.artifact_missing"
  },
  {
    id: "release-rollback",
    question: "How do I roll back a release?",
    answer: "Promote the last healthy artifact, then record the replaced release ID in the operation log.",
    area: "release",
    event: "release.rollback_requested"
  },
  {
    id: "release-pending",
    question: "Why is my release still pending?",
    answer: "Inspect the release checks for an unfinished approval or an environment lock held by another operation.",
    area: "release",
    event: "release.pending"
  },
  {
    id: "diagnostic-source-map",
    question: "Why does the stack trace have no source locations?",
    answer: "Upload the source map produced by the exact build and keep its release identifier aligned with the diagnostic event.",
    area: "diagnostics",
    event: "diagnostic.symbolication_failed"
  }
];

export function composeSearchText(entry: FaqEntry): string {
  return `${entry.question}\n${entry.answer}\narea:${entry.area}\nevent:${entry.event}`;
}
