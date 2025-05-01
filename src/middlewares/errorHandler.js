import logger from '../utils/logger.js';

// Basic Error Handler Middleware
const errorHandler = (err, req, res, next) => {
    logger.error(err); // Log the full error stack

    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    // Handle specific error types if needed (e.g., Prisma errors, validation errors)
    // if (err instanceof SpecificError) { ... }

    res.status(statusCode).json({
        error: {
            message: message,
            // Optionally include stack in development
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        },
    });
};

export default errorHandler;