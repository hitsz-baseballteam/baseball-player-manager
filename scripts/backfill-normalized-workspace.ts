import { backfillLegacyWorkspacesToNormalized } from "../src/lib/workspace-store";

async function main() {
  const count = await backfillLegacyWorkspacesToNormalized();
  console.log(`Backfilled ${count} legacy workspace row(s) into normalized tables.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
