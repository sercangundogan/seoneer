import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/modules/auth";
import { resolvePostAuthPath } from "@/modules/workspaces/post-auth";

/**
 * Post-login gate: send new users to onboarding, ready users to overview.
 */
export default async function HomeGatePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/signin");
  }

  redirect(await resolvePostAuthPath(session.user.id));
}
