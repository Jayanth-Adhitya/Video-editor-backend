import app from './src/app.js';
import logger from './src/utils/logger.js';
import { redisConnection } from './src/config/queue.js'; // Import redis connection for explicit close

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    logger.info(`API Base URL: ${process.env.APP_BASE_URL || `http://localhost:${PORT}`}`);
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
        logger.info('HTTP server closed.');
        // Close database connections, queue connections, etc.
        try {
            // await prisma.$disconnect(); // Close Prisma client
            // logger.info('Database connection closed.');
             if (redisConnection.status === 'ready' || redisConnection.status === 'connecting') {
                await redisConnection.quit();
                 logger.info('Redis connection closed.');
             }
        } catch (error) {
             logger.error('Error during cleanup:', error);
        } finally {
             process.exit(0); // Exit process
        }
    });

    // Force shutdown after timeout
    setTimeout(() => {
        logger.error('Could not close connections in time, forcing shutdown.');
        process.exit(1);
    }, 10000); // 10 seconds timeout
};


process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Catches Ctrl+C

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
  // Consider crashing the process depending on the error:
  // process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Perform cleanup if necessary
  // It's generally recommended to crash the process after an uncaught exception
  gracefulShutdown('uncaughtException').then(() => process.exit(1));
});