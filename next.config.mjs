/** @type {import('next').NextConfig} */
const nextConfig = {
  // sharp must stay a real node_modules package, never bundled.
  //
  // On 20 August 2026 every image on every title failed the picture gate with
  // "Could not load the sharp module using the linux-x64 runtime:
  // libvips-cpp.so.8.18.3: cannot open shared object file". The bundler was
  // wrapping sharp as a hashed external and the deployment lost the libvips
  // shared library that @img/sharp-libvips-linux-x64 provides. Four QA-passed
  // articles missed their slots while the Designer burned four attempts each on
  // candidates the gate never actually looked at.
  //
  // Externalising it makes Vercel's file tracing carry the whole package tree,
  // native libraries included.
  //
  // onnxruntime-web (the face detector behind the interview overlays) finds
  // its WebAssembly file beside its own script, which only works unbundled;
  // fontkit is externalised for the same peace of mind.
  serverExternalPackages: ["sharp", "onnxruntime-web", "fontkit"],

  // A header photo uploaded by hand on the article page goes through a server
  // action, whose default limit is 1 MB. The page shrinks a photo to about
  // 2400px before sending, which lands well under this; Vercel itself caps a
  // request at 4.5 MB.
  experimental: { serverActions: { bodySizeLimit: "4mb" } },

  // The interview overlays read their model, fonts and logos from disk at
  // runtime, and onnxruntime-web loads its wasm by path, so file tracing
  // cannot see any of it. Listed here for every route that draws one.
  outputFileTracingIncludes: Object.fromEntries(
    // Keys are globs, so "[slug]" would read as a character class: hence "**".
    ["/api/overlay/**", "/api/cron/post-linkedin", "/api/cron/post-instagram"].map((route) => [
      route,
      [
        "./lib/social-overlay/assets/**/*",
        "./node_modules/onnxruntime-web/dist/ort.node.min.mjs",
        "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs",
        "./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm",
        // sharp's native addon finds libvips by a relative path, not a
        // require, so tracing missed it here and the first live overlay died
        // with "libvips-cpp.so.8.18.3: cannot open shared object file", the
        // same failure as 20 Aug 2026. Only present on the Linux build.
        "./node_modules/@img/sharp-linux-x64/**/*",
        "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      ],
    ])
  ),
};

export default nextConfig;
