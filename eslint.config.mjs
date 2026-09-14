import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // `@/lib/audio/signed-url` signs storage paths with a service-role
    // client and performs NO authorization of its own. The only reason it
    // is safe today is that `src/lib/meditation/actions.ts` calls it exclusively
    // on rows already fetched through an RLS-bound client. Importing it
    // anywhere else (a route handler, a component, a script) skips that
    // check entirely and will hand out another user's private audio to
    // whoever asks -- see the SECURITY INVARIANT comment in that file.
    files: ["**/*.{ts,tsx}"],
    ignores: ["src/lib/meditation/actions.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/audio/signed-url",
              message:
                "@/lib/audio/signed-url signs with a service-role client and performs no authorization of its own. Only src/lib/meditation/actions.ts may import it, because every call site there fetches the row through an RLS-bound client first. Add your fetch there and call hydrateAudioUrl/hydrateAudioUrls (or export a new authorized helper), rather than importing this module directly.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
