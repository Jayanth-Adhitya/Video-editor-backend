import dotenv from 'dotenv';
dotenv.config(); // Load .env file

// Re-export configurations
export { default as prisma } from './db.js';
export { videoQueue } from './queue.js';
export * from './storage.js'; // Export storage paths and ensure function