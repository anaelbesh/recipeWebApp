import { Router } from "express";
import { updateComment, deleteComment } from "../controllers/commentController";
import { verifyToken } from "../middleware/authMiddleware";

const router = Router();

router.put("/:commentId", verifyToken, updateComment);
router.delete("/:commentId", verifyToken, deleteComment);

export default router;

