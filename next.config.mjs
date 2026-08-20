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
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
