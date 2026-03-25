import request from "supertest";
import mongoose from "mongoose";
import { app } from "../../src/server";
import { Recipe } from "../../src/models/Recipe";
import User from "../../src/models/userModel";
import RefreshToken from "../../src/models/refreshTokenModel";
import { connectMongo } from "../../src/db";

// Test user credentials
const OWNER = {
  email: "recipe_owner@test.com",
  username: "recipe_owner",
  password: "OwnerPass123!",
};
const OTHER = {
  email: "recipe_other@test.com",
  username: "recipe_other",
  password: "OtherPass123!",
};

let ownerToken: string;
let otherToken: string;
let createdRecipeId: string;

// ── Helpers ────────────────────────────────────────────────────────────────────
async function cleanUser(email: string) {
  const u = await User.findOne({ email });
  if (u) await RefreshToken.deleteMany({ userId: u._id });
  await User.deleteMany({ email });
}

async function registerAndLogin(creds: typeof OWNER): Promise<string> {
  let res = await request(app).post("/api/auth/register").send(creds);
  if (res.status !== 201) {
    res = await request(app).post("/api/auth/login").send(creds);
  }
  return res.body.accessToken as string;
}

// ── Setup / Teardown ───────────────────────────────────────────────────────────
beforeAll(async () => {
  await connectMongo();

  // Clean slate
  await cleanUser(OWNER.email);
  await cleanUser(OTHER.email);

  ownerToken = await registerAndLogin(OWNER);
  otherToken  = await registerAndLogin(OTHER);
});

afterAll(async () => {
  // Remove test recipes created during this suite
  await Recipe.deleteMany({ title: /^Test Recipe/ });
  await cleanUser(OWNER.email);
  await cleanUser(OTHER.email);
  await mongoose.disconnect();
});

// ── Suite ──────────────────────────────────────────────────────────────────────
describe("Recipe CRUD API", () => {
  // ── POST /api/recipes ──────────────────────────────────────────────────────
  describe("POST /api/recipes", () => {
    it("should return 401 when no token is provided", async () => {
      const res = await request(app).post("/api/recipes").send({
        title: "Test Recipe No Auth",
        instructions: "Some instructions here.",
      });
      expect(res.status).toBe(401);
    });

    it("should return 400 when required fields are missing", async () => {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Test Recipe Missing Instructions" });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });

    it("should return 400 when title is too short", async () => {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "AB", instructions: "Some long enough instructions." });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });

    it("should create a recipe and return 201", async () => {
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Test Recipe Pancakes",
          instructions: "Mix flour, eggs, milk. Fry on pan until golden.",
          ingredients: ["flour", "eggs", "milk"],
          imageUrl: "https://example.com/pancakes.jpg",
          category: "Breakfast",
        });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("recipe");
      expect(res.body.recipe).toHaveProperty("_id");
      expect(res.body.recipe.title).toBe("Test Recipe Pancakes");
      expect(res.body.recipe.ingredients).toEqual(["flour", "eggs", "milk"]);
      createdRecipeId = res.body.recipe._id;
    });
  });

  // ── GET /api/recipes ───────────────────────────────────────────────────────
  describe("GET /api/recipes", () => {
    it("should return paginated list without auth", async () => {
      const res = await request(app).get("/api/recipes").query({ page: 1, limit: 5 });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("items");
      expect(res.body).toHaveProperty("page");
      expect(res.body).toHaveProperty("limit");
      expect(res.body).toHaveProperty("total");
      expect(res.body).toHaveProperty("pages");
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it("should return search results matching title", async () => {
      const res = await request(app)
        .get("/api/recipes")
        .query({ search: "Pancakes" });
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(
        res.body.items.some((r: any) => r.title.toLowerCase().includes("pancake"))
      ).toBe(true);
    });

    it("should restrict regular search to title matches", async () => {
      const suffix = Date.now().toString();
      const recipesToCreate = [
        {
          title: `Test Recipe Hamburgler ${suffix}`,
          instructions: "A short note about ham and bread.",
          ingredients: ["ham", "bun"],
          category: "Sandwiches / Wraps",
        },
        {
          title: `Test Recipe Lasagna ${suffix}`,
          instructions: "Contains ham but the title does not include it.",
          ingredients: ["pasta", "tomato", "ham"],
          category: "Comfort Food",
        },
        {
          title: `Test Recipe Pasta Delight ${suffix}`,
          instructions: "Rich with cream and pastry crumbs.",
          ingredients: ["cream", "pasta", "mushroom"],
          category: "Comfort Food",
        },
        {
          title: `Test Recipe Bourekas ${suffix}`,
          instructions: "Flaky pastry that mentions the word paste multiple times.",
          ingredients: ["pastry", "cream"],
          category: "Pastries / Baked Goods",
        },
        {
          title: `Test Recipe Ribeye Steak ${suffix}`,
          instructions: "Grilled steak cooked with herbs.",
          ingredients: ["beef", "herbs"],
          category: "Meat",
        },
      ];

      const createdIds: string[] = [];
      try {
        for (const recipe of recipesToCreate) {
          const res = await request(app)
            .post("/api/recipes")
            .set("Authorization", `Bearer ${ownerToken}`)
            .send(recipe);
          createdIds.push(res.body.recipe._id);
        }

        const runSearch = async (query: string, expectedTitle: string) => {
          const res = await request(app)
            .get("/api/recipes")
            .query({ search: query, limit: 20 });
          expect(res.status).toBe(200);
          const normalized = query.toLowerCase();
          expect(res.body.items.length).toBeGreaterThan(0);
          expect(
            res.body.items.every((r: any) => r.title.toLowerCase().includes(normalized))
          ).toBe(true);
          expect(
            res.body.items.some((r: any) => r.title === expectedTitle)
          ).toBe(true);
        };

        await runSearch(`ham`, `Test Recipe Hamburgler ${suffix}`);
        await runSearch(`pas`, `Test Recipe Pasta Delight ${suffix}`);
        await runSearch(`steak`, `Test Recipe Ribeye Steak ${suffix}`);
      } finally {
        await Promise.all(
          createdIds.map((id) =>
            request(app)
              .delete(`/api/recipes/${id}`)
              .set("Authorization", `Bearer ${ownerToken}`)
          )
        );
      }
    });

    it("should return 401 when mine=true without auth", async () => {
      const res = await request(app).get("/api/recipes").query({ mine: "true" });
      expect(res.status).toBe(401);
    });

    it("should return only owner recipes when mine=true with auth", async () => {
      const res = await request(app)
        .get("/api/recipes")
        .set("Authorization", `Bearer ${ownerToken}`)
        .query({ mine: "true" });
      expect(res.status).toBe(200);
      expect(res.body.items.every((r: any) => r.createdBy !== undefined)).toBe(true);
    });
  });

  // ── GET /api/recipes/:id ───────────────────────────────────────────────────
  describe("GET /api/recipes/:id", () => {
    it("should return 400 for an invalid id", async () => {
      const res = await request(app).get("/api/recipes/not-an-id");
      expect(res.status).toBe(400);
    });

    it("should return 404 for a non-existent id", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      const res    = await request(app).get(`/api/recipes/${fakeId}`);
      expect(res.status).toBe(404);
    });

    it("should return the recipe by id", async () => {
      const res = await request(app).get(`/api/recipes/${createdRecipeId}`);
      expect(res.status).toBe(200);
      expect(res.body.recipe._id).toBe(createdRecipeId);
      expect(res.body.recipe).toHaveProperty("createdBy");
    });
  });

  // ── PUT /api/recipes/:id ───────────────────────────────────────────────────
  describe("PUT /api/recipes/:id", () => {
    it("should return 403 when a non-owner tries to update", async () => {
      const res = await request(app)
        .put(`/api/recipes/${createdRecipeId}`)
        .set("Authorization", `Bearer ${otherToken}`)
        .send({ title: "Test Recipe Hacked Title" });
      expect(res.status).toBe(403);
    });

    it("should return 401 when no token is provided", async () => {
      const res = await request(app)
        .put(`/api/recipes/${createdRecipeId}`)
        .send({ title: "Test Recipe No Auth Update" });
      expect(res.status).toBe(401);
    });

    it("should update the recipe when called by owner", async () => {
      const res = await request(app)
        .put(`/api/recipes/${createdRecipeId}`)
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Test Recipe Pancakes Updated",
          ingredients: ["flour", "eggs", "milk", "butter"],
        });
      expect(res.status).toBe(200);
      expect(res.body.recipe.title).toBe("Test Recipe Pancakes Updated");
      expect(res.body.recipe.ingredients).toContain("butter");
      expect(res.body.recipe.createdBy).toBeTruthy();
      expect(typeof res.body.recipe.createdBy).toBe("object");
      expect(res.body.recipe.createdBy.username).toBe(OWNER.username);
    });

    it("should return 400 for invalid ObjectId", async () => {
      const res = await request(app)
        .put("/api/recipes/bad-id")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({ title: "Test Recipe Bad Id" });
      expect(res.status).toBe(400);
    });
  });

  // ── DELETE /api/recipes/:id ────────────────────────────────────────────────
  describe("DELETE /api/recipes/:id", () => {
    let deleteTargetId: string;

    beforeAll(async () => {
      // Create a recipe specifically for delete tests
      const res = await request(app)
        .post("/api/recipes")
        .set("Authorization", `Bearer ${ownerToken}`)
        .send({
          title: "Test Recipe To Delete",
          instructions: "This recipe will be deleted during testing.",
          category: "Breakfast",
        });
      deleteTargetId = res.body.recipe._id;
    });

    it("should return 403 when a non-owner tries to delete", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${deleteTargetId}`)
        .set("Authorization", `Bearer ${otherToken}`);
      expect(res.status).toBe(403);
    });

    it("should return 401 when no token is provided", async () => {
      const res = await request(app).delete(`/api/recipes/${deleteTargetId}`);
      expect(res.status).toBe(401);
    });

    it("should delete the recipe when called by owner", async () => {
      const res = await request(app)
        .delete(`/api/recipes/${deleteTargetId}`)
        .set("Authorization", `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.deletedId).toBe(deleteTargetId);
    });

    it("should return 404 after deletion", async () => {
      const res = await request(app).get(`/api/recipes/${deleteTargetId}`);
      expect(res.status).toBe(404);
    });
  });
});
