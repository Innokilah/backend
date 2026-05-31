import { Router } from "express";
import { healthCheck } from "../db.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    await healthCheck();
    res.json({ status: "ok" });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

export default router;
