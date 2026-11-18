import { route } from "@/lib/server/api";
import { getSettings } from "@/lib/server/settings";

export const GET = route(async ({ db, user }) => {
  const settings = await getSettings(db);
  return { user, settings };
});
