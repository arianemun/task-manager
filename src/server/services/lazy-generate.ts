import { cache } from "react";
import { lazyGenerateForUser } from "@/server/services/occurrence-generate";

/** حداکثر یک بار lazy generate در هر درخواست React/Next */
export const lazyGenerateOnce = cache((userId: number) => {
  return lazyGenerateForUser(userId);
});
