import mongoose, { Schema } from 'mongoose';
import { IRecipe } from './modelTypes';

const URL_REGEX = /^https?:\/\/.+/;

const recipeSchema = new Schema<IRecipe>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [120, 'Title must be at most 120 characters'],
    },
    instructions: {
      type: String,
      required: [true, 'Instructions are required'],
      trim: true,
      minlength: [10, 'Instructions must be at least 10 characters'],
      maxlength: [20000, 'Instructions must be at most 20000 characters'],
    },
    ingredients: {
      type: [String],
      default: [],
    },
    imageUrl: {
      type: String,
      validate: {
        validator: (v: string) => !v || URL_REGEX.test(v),
        message: 'imageUrl must be a valid URL starting with http:// or https://',
      },
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'createdBy is required'],
      index: true,
    },
  },
  { timestamps: true }
);

// Full-text search index across title, instructions, and ingredients
recipeSchema.index({ title: 'text', instructions: 'text', ingredients: 'text' });

export const Recipe = mongoose.model<IRecipe>('Recipe', recipeSchema);
