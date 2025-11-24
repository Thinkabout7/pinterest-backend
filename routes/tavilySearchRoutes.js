import express from "express";
import { tavilySearch } from "../controllers/tavilySearchController.js";

const router = express.Router();

// /api/ai-search?q=flowers
router.get("/", tavilySearch);

export default router;
