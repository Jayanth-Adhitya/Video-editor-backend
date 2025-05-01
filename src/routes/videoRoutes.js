import express from 'express';
import { uploadVideo as uploadVideoMiddleware } from '../middlewares/fileUpload.js';
import * as videoController from '../controllers/videoController.js';
import { videoIdParam, trimRequest, subtitleRequest } from '../validators/videoValidators.js';
import validateRequest from '../middlewares/validateRequest.js';


const router = express.Router();

// POST /api/videos/upload - Upload a new video
router.post(
    '/upload',
    uploadVideoMiddleware, // Multer middleware first
    videoController.uploadVideo // Then controller
);


// POST /api/videos/:id/trim - Add a trimming operation
router.post(
    '/:id/trim',
    trimRequest,        // Validation rules
    validateRequest,    // Middleware to check validation results
    videoController.addTrimOperation
);

// POST /api/videos/:id/subtitles - Add a subtitle overlay operation
router.post(
    '/:id/subtitles',
    subtitleRequest,    // Validation rules
    validateRequest,    // Middleware to check validation results
    videoController.addSubtitleOperation
);

// POST /api/videos/:id/render - Trigger the rendering process
router.post(
    '/:id/render',
     videoIdParam,       // Validate ID format
     validateRequest,
    videoController.renderVideo
);

// GET /api/videos/:id/status - Check the status of a video
router.get(
    '/:id/status',
    videoIdParam,       // Validate ID format
    validateRequest,
    videoController.getVideoStatus
);


// GET /api/videos/:id/download - Download the final rendered video
router.get(
    '/:id/download',
     videoIdParam,       // Validate ID format
     validateRequest,
    videoController.downloadVideo
);

// Add more routes for other operations (audio mod, text/image overlay etc.) here

export default router;