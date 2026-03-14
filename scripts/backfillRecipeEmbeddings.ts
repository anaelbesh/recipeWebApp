/**
 * Backfill AI embeddings for all recipes that don't have one yet.
 *
 * Usage:
 *   npx ts-node scripts/backfillRecipeEmbeddings.ts
 *
 * Requires .env to have GEMINI_API_KEY and MongoDB connection vars set.
 */

import 'dotenv/config';
import { connectMongo, disconnectMongo } from '../src/db';
import { Recipe } from '../src/models/Recipe';
import { embedText, buildSearchText } from '../src/services/geminiEmbeddings';

const BATCH_SIZE = 10;
const DELAY_MS   = 300; // stay well within Gemini rate limits

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await connectMongo();

  const total = await Recipe.countDocuments({ $or: [{ embedding: { $exists: false } }, { embedding: { $size: 0 } }] });
  console.log(`Found ${total} recipes without embeddings.`);

  if (total === 0) {
    console.log('Nothing to backfill.');
    await disconnectMongo();
    return;
  }

  let processed = 0;
  let succeeded = 0;
  let failed    = 0;

  while (processed < total) {
    const batch = await Recipe.find({
      $or: [{ embedding: { $exists: false } }, { embedding: { $size: 0 } }],
    })
      .limit(BATCH_SIZE)
      .lean();

    if (batch.length === 0) break;

    for (const recipe of batch) {
      try {
        const searchText = buildSearchText(
          recipe.title,
          recipe.category,
          recipe.ingredients,
          recipe.instructions,
          (recipe as any).kosherType,
          (recipe as any).cookingMethod,
          (recipe as any).dishType,
        );
        const embedding = await embedText(searchText);
        if (embedding) {
          await Recipe.findByIdAndUpdate(recipe._id, { searchText, embedding });
          succeeded++;
          console.log(`  ✅ [${processed + 1}/${total}] ${recipe.title}`);
        } else {
          failed++;
          console.warn(`  ⚠️  [${processed + 1}/${total}] Embedding returned null for: ${recipe.title}`);
        }
      } catch (err: any) {
        failed++;
        console.error(`  ❌ [${processed + 1}/${total}] Error for "${recipe.title}": ${err?.message ?? err}`);
      }

      processed++;
      await sleep(DELAY_MS);
    }
  }

  console.log(`\nDone. Succeeded: ${succeeded}, Failed: ${failed}, Total processed: ${processed}`);
  await disconnectMongo();
}

main().catch((err) => {
  console.error('Backfill script failed:', err);
  process.exit(1);
});
