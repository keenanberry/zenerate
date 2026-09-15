import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const SIGNED_URL_RESTRICTION =
  "@/lib/audio/signed-url signs with a service-role client and performs no authorization of its own. Only src/lib/meditation/actions.ts may import it, because every call site there fetches the row through an RLS-bound client first. Add your fetch there and call hydrateAudioUrl/hydrateAudioUrls (or export a new authorized helper), rather than importing this module directly.";

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
    //
    // Matched with `patterns`/`regex` rather than `paths`, because `paths`
    // compares the literal specifier text: it catches
    // `@/lib/audio/signed-url` and misses `../audio/signed-url`,
    // `./signed-url` and every other relative spelling of the same module.
    // A guard that looks like protection but is one `../` away from being
    // bypassed is worse than a documented convention. The regex matches on
    // the module's basename so that every spelling -- aliased, sibling, or
    // arbitrarily deep -- resolves to the same restriction, with an
    // optional extension because `./signed-url.js` is a legal specifier.
    files: ["**/*.{ts,tsx}"],
    // `actions.ts` is the one production caller (see above). The co-located
    // unit test is exempt because a module's own test must be able to import
    // it; it mocks the service-role client and never ships. Exempted by exact
    // path rather than a `*.test.ts` glob, so that a test anywhere else
    // reaching for this module still has to justify itself.
    ignores: [
      "src/lib/meditation/actions.ts",
      "src/lib/audio/signed-url.test.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "(^|/)signed-url(\\.[jt]sx?)?$",
              message: SIGNED_URL_RESTRICTION,
            },
          ],
        },
      ],
      // `no-restricted-imports` only inspects static import/export
      // declarations, so `await import("../audio/signed-url")` walks
      // straight past the rule above. Same hole, different syntax.
      // Statically-analysable dynamic imports are closed here; a computed
      // specifier (`import(someVar)`) cannot be caught by any lint rule and
      // remains a reviewer's responsibility.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'ImportExpression[source.type="Literal"][source.value=/(^|\\u002F)signed-url(\\.[jt]sx?)?$/]',
          message: SIGNED_URL_RESTRICTION,
        },
      ],
    },
  },
]);

export default eslintConfig;
