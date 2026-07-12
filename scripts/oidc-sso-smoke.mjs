#!/usr/bin/env node

// Compatibility entrypoint: the canonical SSO audit provisions a disposable
// front user and proves that New API creates/reuses only a normal role=1
// account. Administrator credentials are intentionally excluded.
await import("./new-api-user-isolation-smoke.mjs");
