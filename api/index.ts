/**
 * Vercel Function entry. Deliberately a one-line re-export: every heavy
 * import lives under backend/, where Node resolves them from
 * backend/node_modules, and the NestJS code arrives already compiled by tsc
 * (esbuild, which Vercel uses for this file, cannot emit decorator metadata).
 *
 * vercel.json rewrites every /api/* request here; Nest's own router handles
 * the path from there.
 */
export { default } from '../backend/dist/serverless';
