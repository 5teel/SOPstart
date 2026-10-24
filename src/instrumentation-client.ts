// ponytail: the file itself, not the zod/v4/core entry -- the entry put all of Zod (+86 KB) into every page's first chunk.
// Same file the rest of Zod imports, so the same globalConfig object.
import { config } from '../node_modules/zod/v4/core/core.js'

// Phase 68 / ADR-0030: the CSP never allows eval. Zod 4 probes for it (`new Function('')`) when an object schema is
// defined, which the browser reports as a script-src violation on every page. Jitless mode skips the probe; Zod then
// parses the same way it already did under the CSP. Runs before the app's own code.
config({ jitless: true })
