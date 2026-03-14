/**
 * Fix wrong recipe categories, rebuild searchText, and backfill missing embeddings.
 *
 * Usage:
 *   npx ts-node --require ./preload.js scripts/fixCategoriesAndEmbeddings.ts
 *
 * Requires .env to have GEMINI_API_KEY and MongoDB connection vars set.
 *
 * What it does:
 *   1. For every recipe, infer the correct category from title + ingredients.
 *   2. Rebuild searchText = title + category + ingredients + instructions (first 800 chars).
 *   3. If searchText changed OR embedding is missing/empty, regenerate the embedding.
 */

import 'dotenv/config';
import { connectMongo, disconnectMongo } from '../src/db';
import { Recipe } from '../src/models/Recipe';
import { embedText, buildSearchText } from '../src/services/geminiEmbeddings';
import { RECIPE_CATEGORIES, RecipeCategory } from '../src/constants/recipeCategories';

// ── Category inference rules ─────────────────────────────────────────────────

type RuleSet = Array<{
  category: RecipeCategory;
  titleWords?: RegExp;
  ingredientWords?: RegExp;
}>;

/**
 * Rules are evaluated top-to-bottom; first match wins.
 * ingredientWords is matched against the joined ingredients string (lowercase).
 * The existing category is kept if no rule matches and it is already a valid enum value.
 */
const RULES: RuleSet = [
  // Grill — "grilled X" beats the ingredient-specific category
  {
    category: 'Grill',
    titleWords: /\b(grill(ed)?|bbq|barbecue|smoked)\b/i,
  },
  // Fish
  {
    category: 'Fish',
    titleWords: /\b(salmon|tuna|cod|tilapia|sea.?bass|halibut|trout|shrimp|prawn|fish|seafood|anchov|sardine|herring|mahi)\b/i,
    ingredientWords: /\b(salmon|tuna|cod|tilapia|sea.?bass|halibut|trout|shrimp|prawn|fish|seafood|anchov|sardine|herring|mahi)\b/i,
  },
  // Salad
  {
    category: 'Salad',
    titleWords: /\b(salad|caesar|coleslaw|tabbouleh|fattoush|nicoise|caprese)\b/i,
  },
  // Chicken
  {
    category: 'Chicken',
    titleWords: /\b(chicken|thighs?|drumstick|poultry|wings?|schnitzel)\b/i,
    ingredientWords: /\b(chicken|thighs?|drumstick|poultry|wings?)\b/i,
  },
  // Meat / steak
  {
    category: 'Meat',
    titleWords: /\b(steak|ribeye|brisket|lamb|veal|pork|beef|meatball|meatloaf|roast)\b/i,
    ingredientWords: /\b(steak|ribeye|brisket|lamb|veal|pork chop|beef|sirloin|tenderloin)\b/i,
  },
  // Burger
  {
    category: 'Burger',
    titleWords: /\b(burger|hamburger|smash.?burger)\b/i,
  },
  // Pizza
  {
    category: 'Pizza',
    titleWords: /\b(pizza|flatbread)\b/i,
  },
  // Pasta
  {
    category: 'Pasta',
    titleWords: /\b(pasta|spaghetti|penne|fettuccine|linguine|rigatoni|lasagna|mac.?and.?cheese|noodle)\b/i,
  },
  // Spreads
  {
    category: 'Spreads',
    titleWords: /\b(hummus|tahini|guacamole|dip|spread|pesto|salsa|tapenade)\b/i,
  },
];

/**
 * Infer a category from title and ingredients.
 * Returns the inferred category, or the existing one if it is already valid and no rule fires.
 */
function inferCategory(
  title: string,
  ingredients: string[],
  existingCategory: string,
): RecipeCategory {
  const titleLower = title.toLowerCase();
  const ingredientsLower = ingredients.join(' ').toLowerCase();

  for (const rule of RULES) {
    const titleMatch = rule.titleWords?.test(titleLower) ?? false;
    const ingredientsMatch = rule.ingredientWords?.test(ingredientsLower) ?? false;

    // A rule fires if the title pattern matches, OR (title has no pattern but ingredient pattern matches)
    if (titleMatch || (!rule.titleWords && ingredientsMatch)) {
      return rule.category;
    }
    // Special case: ingredient-only match (rule has both patterns)
    if (rule.titleWords && !titleMatch && ingredientsMatch) {
      return rule.category;
    }
  }

  // Keep existing if it's already a valid enum value
  if ((RECIPE_CATEGORIES as readonly string[]).includes(existingCategory)) {
    return existingCategory as RecipeCategory;
  }

  return 'Other';
}

// ── Main ─────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 10;
const DELAY_MS   = 350; // stay within Gemini rate limits

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  await connectMongo();

  const allRecipes = await Recipe.find({}).lean();
  console.log(`\nTotal recipes: ${allRecipes.length}\n`);

  let catFixed        = 0;
  let embeddingFailed = 0;
  let embeddingDone   = 0;
  let skipped         = 0;

  for (let i = 0; i < allRecipes.length; i += BATCH_SIZE) {
    const batch = allRecipes.slice(i, i + BATCH_SIZE);

    for (const recipe of batch) {
      const idx = i + batch.indexOf(recipe) + 1;
      const tag = `[${idx}/${allRecipes.length}] "${recipe.title}"`;

      // 1. Infer correct category
      const correctCategory = inferCategory(
        recipe.title,
        recipe.ingredients ?? [],
        recipe.category,
      );

      const categoryChanged = correctCategory !== recipe.category;
      if (categoryChanged) {
        console.log(`  🏷  ${tag} category: "${recipe.category}" → "${correctCategory}"`);
        catFixed++;
      }

      // 2. Build proper searchText (always rebuild to use new category)
      const newSearchText = buildSearchText(
        recipe.title,
        correctCategory,
        recipe.ingredients ?? [],
        recipe.instructions,
        (recipe as any).kosherType,
        (recipe as any).cookingMethod,
        (recipe as any).dishType,
      );

      // 3. Check if we need to re-embed
      const needsEmbedding =
        !Array.isArray(recipe.embedding) ||
        recipe.embedding.length === 0 ||
        categoryChanged ||
        !recipe.searchText ||
        recipe.searchText.trim() === '';

      if (!needsEmbedding && !categoryChanged) {
        skipped++;
        console.log(`  ⏭  ${tag} already OK`);
        continue;
      }

      // 4. Save category + searchText first (no API call needed)
      if (!needsEmbedding && categoryChanged) {
        await Recipe.findByIdAndUpdate(recipe._id, {
          category: correctCategory,
          searchText: newSearchText,
        });
        skipped++;
        continue;
      }

      // 5. Generate embedding
      try {
        const embedding = await embedText(newSearchText);
        await Recipe.findByIdAndUpdate(recipe._id, {
          category:   correctCategory,
          searchText: newSearchText,
          embedding,
        });
        embeddingDone++;
        console.log(`  ✅  ${tag} → ${correctCategory} (${embedding.length}-dim vector)`);
      } catch (err: any) {
        embeddingFailed++;
        console.error(`  ❌  ${tag} embed failed: ${err?.message ?? err}`);
        // Still save the category fix even if embed fails
        await Recipe.findByIdAndUpdate(recipe._id, {
          category:   correctCategory,
          searchText: newSearchText,
        });
      }

      await sleep(DELAY_MS);
    }

    // Extra pause between batches
    if (i + BATCH_SIZE < allRecipes.length) {
      await sleep(500);
    }
  }

  console.log(`
─────────────────────────────────────────
 Categories fixed : ${catFixed}
 Embeddings done  : ${embeddingDone}
 Embeddings failed: ${embeddingFailed}
 Already OK       : ${skipped}
 Total recipes    : ${allRecipes.length}
─────────────────────────────────────────`);

  await disconnectMongo();
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
