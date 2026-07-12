#!/usr/bin/env node

// Compatibility entrypoint: the shared boundary audit covers BookStack OIDC
// with a disposable ordinary front user and verifies admin/creator isolation.
await import("./auth-boundary-smoke.mjs");
