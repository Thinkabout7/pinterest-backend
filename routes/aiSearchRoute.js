// routes/aiSearchRoutes.js
import express from "express";
import { aiSearch } from "../controllers/aiSearchController.js";

const router = express.Router();

// GET /api/ai-search?q=flowers
router.get("/", aiSearch);

export default router;
