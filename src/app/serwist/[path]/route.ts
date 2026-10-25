import { createSerwistRoute } from "@serwist/turbopack";

// Revision for the precached offline page: changes with every deploy.
const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
