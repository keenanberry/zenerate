import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js loads the proxy only from the project root or `src/`, never from `src/app/`.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip build output, public files (images, sounds, icons) and Workflow's own routes,
    // which the Workflow backend calls without a session.
    "/((?!_next/static|_next/image|\\.well-known/workflow/|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp3|wav|m4a|webmanifest)$).*)",
  ],
};
