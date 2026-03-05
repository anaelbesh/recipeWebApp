import mongoose, { Document } from 'mongoose';

export interface IPost extends Document {
  title: string;
  content: string;
  sender: mongoose.Schema.Types.ObjectId;
  comments: mongoose.Schema.Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IComment extends Document {
  postId: mongoose.Schema.Types.ObjectId;
  content: string;
  sender: mongoose.Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  provider: 'local' | 'google' | 'facebook';
  providerId?: string;
  profilePicture?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IRecipe extends Document {
  title: string;
  instructions: string;
  ingredients: string[];
  imageUrl?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}