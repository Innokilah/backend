import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: "/opt/lampp/htdocs/Erhanive_agent/backend/uploads",
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const base = path.basename(file.originalname || "file", ext);
    const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  },
});

export const upload = multer({ storage });
