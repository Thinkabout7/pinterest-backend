import express from "express";
import protect from "../middleware/authMiddleware.js";
import {
  deactivateAccount,
  reactivateAccount,
  deleteAccount,
} from "../controllers/accountController.js";

const router = express.Router();

// Deactivate account
router.put("/deactivate", protect, deactivateAccount);

// Reactivate account
router.put("/reactivate", protect, reactivateAccount);

// Delete account
router.delete("/delete", protect, deleteAccount);

export default router;
