// src/worker.js
import dotenv from 'dotenv';
dotenv.config(); // Load .env variables for the worker process as well

import logger from './utils/logger.js';
import { createWorker, redisConnection } from './config/queue.js';
// import prisma from './config/db.js'; // Prisma client needed for worker jobs

logger.info('Starting video processing worker...');

const worker = createWorker(); // Initialize the worker defined in queue.js

// Graceful shutdown for the worker
const shutdownWorker = async (signal) => {
    logger.info(`Received ${signal}. Shutting down worker gracefully...`);
    try {
        await worker.close();
        logger.info('BullMQ Worker closed.');
         if (redisConnection.status === 'ready' || redisConnection.status === 'connecting') {
             await redisConnection.quit();
             logger.info('Redis connection closed.');
         }
        // await prisma.$disconnect();
        // logger.info('Database connection closed.');
    } catch (err) {
        logger.error('Error closing worker:', err);
    } finally {
        process.exit(0);
    }
};

process.on('SIGTERM', () => shutdownWorker('SIGTERM'));
process.on('SIGINT', () => shutdownWorker('SIGINT'));

// Keep the worker process alive
logger.info('Worker is ready and waiting for jobs.');

// Handle potential errors during worker initialization or operation
worker.on('error', (error) => {
    logger.error('Unhandled error in BullMQ Worker:', error);
    // Consider if the worker should exit on certain errors
});