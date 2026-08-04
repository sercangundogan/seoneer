import { listProjectsForUser } from "@/modules/projects/service";

/**
 * Onboarding is complete once the user has finished the setup flow
 * (primary SEO goal saved — set on the final onboarding step).
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  const projects = await listProjectsForUser(userId);
  return projects.some((project) => Boolean(project.primarySeoGoal));
}

export async function resolvePostAuthPath(
  userId: string,
): Promise<"/onboarding" | "/dashboard"> {
  const done = await hasCompletedOnboarding(userId);
  return done ? "/dashboard" : "/onboarding";
}
