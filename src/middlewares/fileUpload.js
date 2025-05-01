import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { rawUploadsPath } from '../config/storage.js';
import logger from '../utils/logger.js';


// Configure disk storage for Multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        logger.debug(`Saving file to: ${rawUploadsPath}`);
        cb(null, rawUploadsPath); // Use configured raw uploads path
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = `${uuidv4()}${path.extname(file.originalname)}`;
        logger.debug(`Generated filename: ${uniqueSuffix} for original: ${file.originalname}`);
        cb(null, uniqueSuffix);
    }
});

// File filter (optional: restrict file types)
const fileFilter = (req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|mkv|webm/; // Adjust as needed
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

    if (mimetype || extname) {
        return cb(null, true);
    }
    cb(new Error(`File upload only supports the following filetypes: ${allowedTypes}`), false);
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 500 // 500MB limit (adjust as needed)
    },
    fileFilter: fileFilter
});

// Middleware function for single file upload named 'video'
const uploadVideo = upload.single('video');

export { uploadVideo };