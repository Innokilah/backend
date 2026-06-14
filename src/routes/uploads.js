import { Router } from "express";
import { upload } from "../middleware/upload.js";
import { v2 as cloudinary } from "cloudinary";

const router = Router();

const useCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (useCloudinary) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

router.post("/images", upload.array("images", 10), async (req, res) => {
  const files = req.files || [];

  if (useCloudinary) {
    try {
      const uploaded = await Promise.all(
        files.map((file) => {
          const dataUri = `data:${file.mimetype};base64,${file.buffer.toString(
            "base64"
          )}`;
          return cloudinary.uploader.upload(dataUri, { folder: "erhanive" });
        })
      );

      const items = uploaded.map((u, idx) => ({
        originalName: files[idx].originalname,
        url: u.secure_url || u.url,
      }));
      return res.json({ items });
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      return res.status(500).json({ error: "Upload failed" });
    }
  }

  const urls = files.map((file) => ({
    originalName: file.originalname,
    url: `/uploads/${file.filename}`,
  }));
  res.json({ items: urls });
});

export default router;
