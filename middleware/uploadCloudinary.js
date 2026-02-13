import multer from 'multer';



import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cloudinary from './cloudinary.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer to store files temporarily
const storage = multer.diskStorage({
    destination: "uploads",
    filename: (req, file, cb) => {
        return cb(null, `${Date.now()}${file.originalname}`);
    }
});

// Configure multer with file size limit (50MB) and field size limits
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB file size limit
    fieldSize: 10 * 1024 * 1024, // 10MB field size limit (for description, name, etc.)
    fields: 10, // Maximum number of non-file fields
    fieldNameSize: 100 // Maximum field name size
  }
});

// Middleware to upload file to Cloudinary
const uploadToCloudinary = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.json({ success: false, message: 'No file uploaded' });
    }

    const filePath = req.file.path;

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(filePath, {
      folder: "cheese",
      resource_type: "auto",
    });

    // Delete temporary file after upload
    fs.unlink(filePath, (err) => {
      if (err) console.log('Error deleting temp file:', err);
    });

    // Attach Cloudinary result to request
    req.cloudinaryResult = uploadResult;
    next();
  } catch (error) {
    console.log(error);
    // Clean up temp file on error
    if (req.file && req.file.path) {
      fs.unlink(req.file.path, () => {});
    }
    res.json({ success: false, message: 'Error uploading to Cloudinary' });
  }
};

// Combined middleware: multer + cloudinary upload
export const uploadSingle = [upload.single('image'), uploadToCloudinary];

