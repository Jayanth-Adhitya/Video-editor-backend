import { body, param } from 'express-validator';

const isIsoDuration = (value) => {
    // Basic check for HH:MM:SS or MM:SS format
    // For more robust validation, consider a library like moment-duration-format
     if (!/^(?:(\d{1,2}):)?(\d{1,2}):(\d{1,2})(?:\.(\d+))?$/.test(value)) {
       throw new Error('Invalid time format. Use HH:MM:SS or MM:SS.');
     }
     return true;
    // Alternatively, parse and check ranges if needed
};

// Function to convert HH:MM:SS or MM:SS to seconds
const timeToSeconds = (timeString) => {
    if (!timeString) return null;
    const parts = timeString.split(':').map(Number);
    let seconds = 0;
    if (parts.length === 3) { // HH:MM:SS
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) { // MM:SS
        seconds = parts[0] * 60 + parts[1];
    } else {
         throw new Error('Invalid time format for conversion.'); // Should be caught by isIsoDuration
    }
    return seconds;
};


const videoIdParam = [
    param('id').isUUID().withMessage('Invalid video ID format (must be UUID).'),
];

const trimRequest = [
    ...videoIdParam,
    body('startTime')
       .notEmpty().withMessage('Start time is required.')
       // .custom(isIsoDuration) // Use this if input is HH:MM:SS
       .isFloat({ min: 0 }).withMessage('Start time must be a non-negative number (seconds).')
       .toFloat(), // Convert to float
    body('endTime')
       .notEmpty().withMessage('End time is required.')
       // .custom(isIsoDuration) // Use this if input is HH:MM:SS
       .isFloat({ min: 0 }).withMessage('End time must be a non-negative number (seconds).')
       .toFloat() // Convert to float
       .custom((endTime, { req }) => {
         if (endTime <= req.body.startTime) {
           throw new Error('End time must be greater than start time.');
         }
         return true;
       }),
    // Optional: Convert HH:MM:SS to seconds *after* validation
    // body('startTime').customSanitizer(timeToSeconds),
    // body('endTime').customSanitizer(timeToSeconds),
];


const subtitleRequest = [
    ...videoIdParam,
    body('text').notEmpty().isString().trim().withMessage('Subtitle text is required.'),
    body('startTime')
        .notEmpty().withMessage('Start time is required.')
        .isFloat({ min: 0 }).withMessage('Start time must be a non-negative number (seconds).')
        .toFloat(),
    body('endTime')
        .notEmpty().withMessage('End time is required.')
        .isFloat({ min: 0 }).withMessage('End time must be a non-negative number (seconds).')
        .toFloat()
        .custom((endTime, { req }) => {
            if (endTime <= req.body.startTime) {
                throw new Error('End time must be greater than start time.');
            }
            return true;
        }),
];


export {
    videoIdParam,
    trimRequest,
    subtitleRequest,
};