import { Response } from 'express';
import User from '../models/userModel';
import { AuthRequest } from '../middleware/authMiddleware';

// GET /api/users - returns all users except the current one, without sensitive fields
export const getAllUsers = async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user?.id;
    const users = await User.find(
      { _id: { $ne: currentUserId } },
      { password: 0, providerId: 0, __v: 0 }
    ).lean();

    const mapped = users.map((u) => ({
      _id: u._id.toString(),
      name: u.username,
      email: u.email,
      profilePicture: u.profilePicture,
    }));

    res.json(mapped);
  } catch (error) {
    res.status(500).json({ message: "Error fetching users"});
  }
};

