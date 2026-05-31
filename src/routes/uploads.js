import { Router } from "express";
import { upload } from "../middleware/upload.js";

const router = Router();

router.post("/images", upload.array("images", 10), (req, res) => {
  const files = req.files || [];
  const urls = files.map((file) => ({
    originalName: file.originalname,
    url: `/uploads/${file.filename}`,
  }));
  res.json({ items: urls });
});

export default router;
