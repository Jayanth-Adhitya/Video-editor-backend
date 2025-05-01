import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import logger from '../utils/logger.js'; // Assuming logger is set up
import { processVideoJob } from '../jobs/videoProcessor.js'; // Import job processor

const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    // password: process.env.REDIS_PASSWORD, // Uncomment if needed
    maxRetriesPerRequest: null, // Important for BullMQ
});

connection.on('error', (err) => {
    logger.error('Redis connection error:', err);
});

connection.on('connect', () => {
    logger.info('Connected to Redis');
});

const VIDEO_QUEUE_NAME = 'video-processing';

// Create Queue instance
const videoQueue = new Queue(VIDEO_QUEUE_NAME, { connection });

// Create Worker instance (will be run in a separate process or managed)
const createWorker = () => {
    logger.info(`Worker started for queue: ${VIDEO_QUEUE_NAME}`);
    const worker = new Worker(
        VIDEO_QUEUE_NAME,
        async (job) => {
            logger.info(`Processing job ${job.id} of type ${job.name}`);
            await processVideoJob(job.data); // Pass job data to your processor function
            logger.info(`Completed job ${job.id}`);
        },
        {
            connection,
            concurrency: 2, // Adjust concurrency based on server resources
            limiter: {      // Optional: Rate limiting
                max: 10,
                duration: 1000,
            },
        }
    );

    worker.on('completed', (job) => {
        logger.info(`Job ${job.id} completed successfully.`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`Job ${job.id} failed:`, err);
        // Implement specific failure handling logic if needed
        // (e.g., update video status to FAILED in DB, notify user)
    });

    worker.on('error', (err) => {
        logger.error('Worker error:', err);
    });

    return worker;
};


export { videoQueue, createWorker, connection as redisConnection };