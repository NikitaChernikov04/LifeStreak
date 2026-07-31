// Vercel resolves a service's entrypoint against the *source* tree, before the
// build runs, so the entrypoint cannot be dist/main.js — that file only exists
// afterwards, and a deploy from a git clone fails validation before npm even
// installs. This committed shim is the stable path; dependency tracing happens
// after the build, by which point the require below resolves normally.
require('./dist/main.js');
