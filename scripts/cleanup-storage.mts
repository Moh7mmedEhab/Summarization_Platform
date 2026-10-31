import "dotenv/config";
import { cleanupStorage } from "@/lib/storage/cleanup";

/**
 * One-shot storage cleanup (also safe to run from cron):
 *   - removes local files under STORAGE_DIR that no SourceAsset references
 *     (24 h safety margin) — npm run cleanup:storage
 *   - deletes aged-out Gemini Files API copies recorded in asset metadata (48 h)
 */
const report = await cleanupStorage();
console.log(
  `[cleanup] removed ${report.removedOrphans.length} orphaned file(s), ` +
    `${report.removedGemini.length} aged Gemini copy(ies)` +
    (report.errors.length ? ` with ${report.errors.length} error(s)` : ""),
);
for (const line of [...report.removedOrphans, ...report.removedGemini]) console.log(`  - ${line}`);
for (const line of report.errors) console.error(`  ! ${line}`);
process.exit(report.errors.length ? 1 : 0);
