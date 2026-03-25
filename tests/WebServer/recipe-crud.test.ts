import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../src/server';
import { Recipe } from '../../src/models/Recipe';
import User from '../../src/models/userModel';
import RefreshToken from '../../src/models/refreshTokenModel';
import { connectMongo } from '../../src/db';

let user1Token: string;
let user2Token: string;
let user1Id: string;
let user2Id: string;
let recipeId: string;

const user1 = {
  email: 'recipe_crud_test1@test.com',
  username: 'recipe_user1',
  password: 'TestPass123!',
};

const user2 = {
  email: 'recipe_crud_test2@test.com',
  username: 'recipe_user2',
  password: 'TestPass123!',
};

const testRecipe = {
  title: 'Test Recipe for CRUD',
  instructions: 'Mix everything and cook at 350F for 20 minutes.',
  ingredients: ['flour', 'eggs', 'milk'],
  category: 'Breakfast',
};

describe('Recipe CRUD and Authorization Tests', () => {
  beforeAll(async () => {
    await connectMongo();

    // Clean up test users and recipes
    await User.deleteMany({ email: { $in: [user1.email, user2.email] } });
    await Recipe.deleteMany({ title: testRecipe.title });

    // Register user 1
    const res1 = await request(app).post('/api/auth/register').send(user1);
    user1Token = res1.body.accessToken;
    user1Id = res1.body.user.id;

    // Register user 2
    const res2 = await request(app).post('/api/auth/register').send(user2);
    user2Token = res2.body.accessToken;
    user2Id = res2.body.user.id;
  });

  afterAll(async () => {
    await User.deleteMany({ email: { $in: [user1.email, user2.email] } });
    await Recipe.deleteMany({ title: testRecipe.title });
    await mongoose.disconnect();
  });

  describe('Recipe Creation', () => {
    it('should create a recipe with valid data', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${user1Token}`)
        .send(testRecipe);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('recipe');
      expect(res.body.recipe.title).toBe(testRecipe.title);
      // createdBy is returned as a string (ObjectId stringified), not an object
      expect(String(res.body.recipe.createdBy)).toBe(user1Id);
      recipeId = res.body.recipe._id;
    });

    it('should return 401 without authentication', async () => {
      const res = await request(app).post('/api/recipes').send(testRecipe);
      expect(res.status).toBe(401);
    });

    it('should return 400 with invalid data (title too short)', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'ab', // Too short (minimum 3 characters)
          instructions: 'Valid instructions here.',
          ingredients: ['flour'],
          category: 'Breakfast',
        });

      // API returns 400 for validation errors, not 422
      expect(res.status).toBe(400);
    });

    it('should return 400 with missing required fields', async () => {
      const res = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Complete Recipe',
          // Missing instructions
          ingredients: ['flour'],
          category: 'Breakfast',
        });

      // API returns 400 for validation errors, not 422
      expect(res.status).toBe(400);
    });
  });

  describe('Recipe Retrieval', () => {
    it('should get a recipe by ID', async () => {
      const res = await request(app).get(`/api/recipes/${recipeId}`);

      expect(res.status).toBe(200);
      expect(res.body.recipe).toHaveProperty('_id', recipeId);
      expect(res.body.recipe.title).toBe(testRecipe.title);
    });

    it('should return 404 for non-existent recipe', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/recipes/${fakeId}`);

      expect(res.status).toBe(404);
    });

    it('should list recipes with pagination', async () => {
      const res = await request(app).get('/api/recipes?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('page');
      expect(res.body).toHaveProperty('limit');
    });

    it('should search recipes by title', async () => {
      const res = await request(app).get('/api/recipes?search=Test');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    it('should get only authenticated user\'s recipes', async () => {
      const res = await request(app)
        .get('/api/recipes?mine=true')
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.items)).toBe(true);
      // All recipes should belong to user1
      res.body.items.forEach((recipe: any) => {
        // createdBy is populated and has _id field
        expect(String(recipe.createdBy._id)).toBe(user1Id);
      });
    });

    it('should return 401 when requesting mine=true without auth', async () => {
      const res = await request(app).get('/api/recipes?mine=true');
      expect(res.status).toBe(401);
    });
  });

  describe('Recipe Update (Authorization)', () => {
    it('owner should be able to update their recipe', async () => {
      const res = await request(app)
        .put(`/api/recipes/${recipeId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Updated Test Recipe',
          instructions: 'Updated instructions',
        });

      expect(res.status).toBe(200);
      expect(res.body.recipe.title).toBe('Updated Test Recipe');
    });

    it('non-owner should NOT be able to update recipe', async () => {
      const res = await request(app)
        .put(`/api/recipes/${recipeId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          title: 'Hacked Title',
          instructions: 'Hacked instructions',
        });

      expect(res.status).toBe(403);
    });

    it('unauthenticated user cannot update recipe', async () => {
      const res = await request(app)
        .put(`/api/recipes/${recipeId}`)
        .send({
          title: 'Hacked Title',
        });

      expect(res.status).toBe(401);
    });

    it('should return 404 when updating non-existent recipe', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .put(`/api/recipes/${fakeId}`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ title: 'New Title' });

      expect(res.status).toBe(404);
    });
  });

  describe('Recipe Delete (Authorization)', () => {
    let deleteTestRecipeId: string;

    beforeAll(async () => {
      // Create a recipe specifically for delete testing
      const res = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Recipe to Delete',
          instructions: 'Delete this recipe now',
          ingredients: ['test'],
          category: 'Breakfast',
        });
      if (res.status !== 201) {
        console.error('Delete test recipe creation failed:', res.status, res.body);
      }
      deleteTestRecipeId = res.body.recipe?._id;
    });

    it('owner should be able to delete their recipe', async () => {
      const res = await request(app)
        .delete(`/api/recipes/${deleteTestRecipeId}`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('deletedId');

      // Verify recipe is deleted
      const checkRes = await request(app).get(`/api/recipes/${deleteTestRecipeId}`);
      expect(checkRes.status).toBe(404);
    });

    it('non-owner should NOT be able to delete recipe', async () => {
      // Create another recipe for testing
      const createRes = await request(app)
        .post('/api/recipes')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          title: 'Recipe to Protect',
          instructions: 'Protect this recipe now',
          ingredients: ['test'],
          category: 'Breakfast',
        });
      const protectedRecipeId = createRes.body.recipe._id;

      const res = await request(app)
        .delete(`/api/recipes/${protectedRecipeId}`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(res.status).toBe(403);

      // Recipe should still exist
      const checkRes = await request(app).get(`/api/recipes/${protectedRecipeId}`);
      expect(checkRes.status).toBe(200);

      // Clean up
      await request(app)
        .delete(`/api/recipes/${protectedRecipeId}`)
        .set('Authorization', `Bearer ${user1Token}`);
    });

    it('unauthenticated user cannot delete recipe', async () => {
      const res = await request(app).delete(`/api/recipes/${recipeId}`);
      expect(res.status).toBe(401);
    });
  });

  describe('Recipe Categories', () => {
    it('should get recipe categories', async () => {
      const res = await request(app).get('/api/recipes/categories');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('categories');
      expect(Array.isArray(res.body.categories)).toBe(true);
      expect(res.body.categories.length).toBeGreaterThan(0);
    });
  });
});
