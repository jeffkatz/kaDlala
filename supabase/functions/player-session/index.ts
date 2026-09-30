import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase({ auth: "user" }, async (_request, context) => {
    const userId = context.userClaims?.id;
    const isAnonymous = context.jwtClaims?.is_anonymous === true;

    if (!userId || !isAnonymous) {
      return Response.json({ error: "An anonymous player session is required." }, { status: 403 });
    }

    return Response.json({ userId, isAnonymous });
  }),
};
