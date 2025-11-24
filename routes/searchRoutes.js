//searchRoute.js
import express from "express";
import { searchPins } from "../controllers/searchController.js";

const router = express.Router();

router.get("/", searchPins);

export default router;
