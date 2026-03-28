import { Response } from 'express';
import bcrypt from 'bcrypt';
import User from '../models/userModel';
import RefreshToken from '../models/refreshTokenModel';
import { Comment } from '../models/Comment';
import { AuthRequest } from '../middleware/authMiddleware';

function getAvatarFileName(file: Express.Multer.File): string {
  if (file.filename) return file.filename;
  const normalizedPath = file.path?.replace(/\\/g, '/') ?? '';
  const fromPath = normalizedPath.split('/').filter(Boolean).pop();
  return fromPath ?? 'unknown-avatar.jpg';
}

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err });
  }
};

export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const filter = currentUserId ? { _id: { $ne: currentUserId } } : {};

    const users = await User.find(
      filter,
      { password: 0, providerId: 0, __v: 0 }
    ).lean();

    const mapped = users
      .filter((u) => u && u._id)
      .map((u) => ({
        _id: String(u._id),
        name: u.username,
        email: u.email,
        profilePicture: u.profilePicture,
      }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users"});
  }
};


export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err });
  }
};

export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    const updateData: Record<string, string> = {};

    if (req.body.username) updateData.username = (req.body.username as string).trim();

    if (req.file) {
      const origin = process.env.SERVER_ORIGIN ?? 'http://localhost:4000';
      const avatarPath = `uploads/avatars/${getAvatarFileName(req.file)}`;
      updateData.profilePicture = `${origin}/${avatarPath}`;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const updated = await User.findByIdAndUpdate(req.user!.id, updateData, { new: true }).select('-password');
    if (!updated) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ user: updated });
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile', error: err });
  }
};

export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password } = req.body as {
      username?: string;
      email?: string;
      password?: string;
    };

    const updateData: Record<string, string> = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (password) updateData.password = await bcrypt.hash(password, 10);

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }

    const updated = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password');
    if (!updated) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({ user: updated });
  } catch (err) {
    res.status(500).json({ message: 'Error updating user', error: err });
  }
};

// ── DELETE /api/users/:id ──────────────────────────────────────────────────────
// Cascade: deletes user's comments and refresh tokens, then the user.
// TODO - Recipe(posts) cascade will be added when the Recipe model exists.
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // TODO - need to add when Recipe controller will be added :
    // const posts = await PostModel.find({ user: userId });
    // await Comment.deleteMany({ postId: { $in: posts.map(p => p._id) } });
    // await RecipeModel.deleteMany({ user: userId });

    await Comment.deleteMany({ user: userId });
    await RefreshToken.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting user', error: err });
  }
};
