/** Stored when OAuth succeeded but the user still needs to pick a property. */
export const GSC_PENDING_SITE = "__pending__";

export function isGscSiteResolved(siteUrl: string | null | undefined): boolean {
  if (!siteUrl) return false;
  if (siteUrl === GSC_PENDING_SITE) return false;
  if (siteUrl.includes("example.com")) return false;
  return true;
}
