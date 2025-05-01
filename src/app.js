import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; // Optional: Enable Cross-Origin Resource Sharing
import path from 'path';
import { fileURLToPath } from 'url';

import logger from './utils/logger.js';
import videoRoutes from './routes/videoRoutes.js';
import errorHandler from './middlewares/errorHandler.js';
import { ensureDirsExist, processedUploadsPath } from './config/storage.js'; // Import storage config

dotenv.config();

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Ensure upload directories exist before starting
ensureDirsExist();

// Middlewares
app.use(cors()); // Enable CORS for all origins (customize if needed)
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// --- API Routes ---
app.use('/api/videos', videoRoutes);

// --- Static File Serving (Optional: for direct access to processed files if needed) ---
// This makes files in 'uploads/processed' accessible via URL, e.g., http://localhost:3000/processed/processed_filename.mp4
// Be cautious with this in production - consider signed URLs or auth for downloads instead.
// app.use('/processed', express.static(processedUploadsPath));


// --- Simple Health Check Route ---
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Video Editing API is running!' });
});


// --- Not Found Handler (should be after all routes) ---
app.use((req, res, next) => {
    res.status(404).json({ error: { message: 'Resource not found' } });
});


// --- Global Error Handler (should be the last middleware) ---
app.use(errorHandler);

export default app;