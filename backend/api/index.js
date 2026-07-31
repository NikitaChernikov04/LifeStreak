// Vercel's Node builder compiles this file itself, with esbuild — which does
// not emit decorator metadata, and Nest's DI cannot resolve constructors
// without it. So nothing here is TypeScript: `vercel-build` runs the real
// `nest build` (tsc, full metadata) and this shim only hands over the result.
module.exports = require('../dist/serverless').default;
