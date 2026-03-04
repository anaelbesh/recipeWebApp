import mongoose, { Schema } from 'mongoose';
import { IUser } from './modelTypes';

const userSchema = new Schema<IUser>(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false },
    provider: { type: String, enum: ['local', 'google', 'facebook'], default: 'local' },
    providerId: { type: String, sparse: true, index: true },
    profilePicture: { type: String }
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', userSchema);