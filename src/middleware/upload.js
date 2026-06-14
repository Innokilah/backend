// import multer from "multer";
// import path from "path";

// const storage = multer.diskStorage({
//   destination: "/opt/lampp/htdocs/Erhanive_agent/backend/uploads",
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname || "");
//     const base = path.basename(file.originalname || "file", ext);
//     const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_");
//     cb(null, `${Date.now()}_${safeBase}${ext}`);
//   },
// });

// export const upload = multer({ storage });


import multer from "multer";
import path from "path";
import fs from "fs";

const useCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

// Create a safe uploads directory inside your project
const uploadDir = path.join(process.cwd(), "uploads");

// Ensure folder exists (Render-safe)
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

let storage;
if (useCloudinary) {
  storage = multer.memoryStorage();
} else {
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || "");
      const base = path.basename(file.originalname || "file", ext);

      const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_");

      cb(null, `${Date.now()}_${safeBase}${ext}`);
    },
  });
}

export const upload = multer({ storage });