import path from 'path';
import fs from 'fs/promises'; // Use promises version
import { fileURLToPath } from 'url';

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths relative to the project root (assuming config is 2 levels deep)
const projectRoot = path.resolve(__dirname, '..', '..');

const RAW_UPLOADS_DIR = process.env.RAW_UPLOADS_DIR || 'uploads/raw';
const PROCESSED_UPLOADS_DIR = process.env.PROCESSED_UPLOADS_DIR || 'uploads/processed';

const rawUploadsPath = path.join(projectRoot, RAW_UPLOADS_DIR);
const processedUploadsPath = path.join(projectRoot, PROCESSED_UPLOADS_DIR);

// Function to ensure directories exist
const ensureDirsExist = async () => {
    try {
        await fs.mkdir(rawUploadsPath, { recursive: true });
        await fs.mkdir(processedUploadsPath, { recursive: true });
        // console.log('Upload directories ensured:', rawUploadsPath, processedUploadsPath);
    } catch (error) {
        console.error('Error creating upload directories:', error);
        process.exit(1); // Exit if we can't create essential directories
    }
};

export { rawUploadsPath, processedUploadsPath, ensureDirsExist };