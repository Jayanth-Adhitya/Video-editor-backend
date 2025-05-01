import prisma from '../config/db.js';
import { videoQueue } from '../config/queue.js';
import { getVideoDuration, cleanupFiles } from '../services/ffmpegService.js';
import logger from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { processedUploadsPath, rawUploadsPath } from '../config/storage.js';
import createError from 'http-errors'; // For creating HTTP errors


// 1. Upload Video
export const uploadVideo = async (req, res, next) => {
    if (!req.file) {
        return next(createError(400, 'No video file uploaded.'));
    }

    const { originalname, filename, path: filePath, size } = req.file;
    logger.info(`Received upload: ${originalname}, saved as ${filename}`);

    try {
        // Get video duration using ffprobe
        const duration = await getVideoDuration(filePath);

        // Save metadata to database
        const video = await prisma.video.create({
            data: {
                originalName: originalname,
                fileName: filename,
                filePath: filePath, // Store the relative path from multer
                size: BigInt(size), // Prisma expects BigInt
                duration: duration,
                status: 'UPLOADED', // Initial status
            },
        });

        logger.info(`Video metadata saved to DB for ID: ${video.id}`);
        res.status(201).json({
            message: 'Video uploaded successfully',
            videoId: video.id,
            video: { // Return some basic info
                id: video.id,
                originalName: video.originalName,
                duration: video.duration,
                size: video.size.toString(), // Convert BigInt to string for JSON
                status: video.status,
                createdAt: video.createdAt,
            }
        });
    } catch (error) {
        logger.error('Error during video upload processing:', error);
        // Attempt to clean up uploaded file if DB insert fails or ffprobe fails
        try {
            await fs.unlink(filePath);
            logger.info(`Cleaned up failed upload file: ${filePath}`);
        } catch (cleanupError) {
            logger.error(`Failed to cleanup file ${filePath}:`, cleanupError);
        }
        next(createError(500, `Failed to process uploaded video: ${error.message}`));
    }
};


// Helper to add edit operation
const addEditOperation = async (videoId, type, params) => {
    // Find the video and the current highest order number for its edits
    const videoWithEdits = await prisma.video.findUnique({
        where: { id: videoId },
        include: {
            edits: {
                orderBy: { order: 'desc' },
                take: 1, // Get only the one with the highest order
            },
        },
    });

    if (!videoWithEdits) {
        throw createError(404, 'Video not found.');
    }

    // Cannot add edits if video is already processing, ready, or failed
    if (['PROCESSING', 'READY', 'FAILED', 'QUEUED'].includes(videoWithEdits.status)) {
         throw createError(409, `Cannot add edits when video status is ${videoWithEdits.status}.`);
    }


    const nextOrder = videoWithEdits.edits.length > 0 ? videoWithEdits.edits[0].order + 1 : 0;

    const edit = await prisma.editOperation.create({
        data: {
            videoId: videoId,
            type: type,
            order: nextOrder,
            startTime: params.startTime,
            endTime: params.endTime,
            text: params.text,
            // Add other params as needed
        },
    });
    logger.info(`Added edit operation ${type} for video ${videoId} with order ${nextOrder}`);
    return edit;
}

// 2. Add Trim Operation
export const addTrimOperation = async (req, res, next) => {
    const { id } = req.params;
    const { startTime, endTime } = req.body;

    try {
        const edit = await addEditOperation(id, 'TRIM', { startTime, endTime });
        res.status(201).json({
            message: 'Trim operation added successfully.',
            editId: edit.id,
            order: edit.order,
        });
    } catch (error) {
         logger.error(`Error adding trim operation for video ${id}:`, error);
         if (!error.statusCode) error.statusCode = 500; // Ensure status code
         next(error);
    }
};


// 3. Add Subtitle Operation
export const addSubtitleOperation = async (req, res, next) => {
     const { id } = req.params;
    const { text, startTime, endTime } = req.body;

     try {
        const edit = await addEditOperation(id, 'SUBTITLE', { text, startTime, endTime });
        res.status(201).json({
            message: 'Subtitle operation added successfully.',
            editId: edit.id,
            order: edit.order,
        });
    } catch (error) {
         logger.error(`Error adding subtitle operation for video ${id}:`, error);
         if (!error.statusCode) error.statusCode = 500; // Ensure status code
         next(error);
    }
};


// 4. Render Final Video (Trigger Background Job)
export const renderVideo = async (req, res, next) => {
    const { id } = req.params;

    try {
        const video = await prisma.video.findUnique({
            where: { id: id },
             include: { edits: true } // Include edits to check if there are any
        });

        if (!video) {
            return next(createError(404, 'Video not found.'));
        }

        // Prevent re-rendering if already done or in progress
        if (['QUEUED', 'PROCESSING', 'READY'].includes(video.status)) {
            return next(createError(409, `Video is already ${video.status.toLowerCase()} or finished.`));
        }

         if (video.edits.length === 0) {
             return next(createError(400, 'No edit operations found for this video. Nothing to render.'));
         }


        // Update status to QUEUED
        await prisma.video.update({
            where: { id: id },
            data: { status: 'QUEUED' },
        });

        // Add job to the queue
        await videoQueue.add('process-video', { videoId: id });

        logger.info(`Video ${id} added to the processing queue.`);
        res.status(202).json({
            message: 'Video rendering job accepted.',
            videoId: id,
            status: 'QUEUED',
        });
    } catch (error) {
        logger.error(`Error queuing video ${id} for rendering:`, error);
         // Attempt to revert status if queueing fails? Maybe not necessary.
        next(createError(500, 'Failed to queue video for rendering.'));
    }
};

// 5. Get Video Status
export const getVideoStatus = async (req, res, next) => {
    const { id } = req.params;
    try {
         const video = await prisma.video.findUnique({
             where: { id: id },
             select: { // Select only necessary fields
                 id: true,
                 status: true,
                 processedFilePath: true, // To know if download is possible
                 updatedAt: true,
             }
         });

         if (!video) {
             return next(createError(404, 'Video not found.'));
         }

         res.status(200).json({
             videoId: video.id,
             status: video.status,
             isReadyForDownload: video.status === 'READY' && !!video.processedFilePath,
             lastUpdated: video.updatedAt,
         });

    } catch (error) {
         logger.error(`Error fetching status for video ${id}:`, error);
         next(createError(500, 'Failed to retrieve video status.'));
    }
};


// 6. Download Final Video
export const downloadVideo = async (req, res, next) => {
    const { id } = req.params;
    try {
        const video = await prisma.video.findUnique({
            where: { id: id },
        });

        if (!video) {
            return next(createError(404, 'Video not found.'));
        }

        if (video.status !== 'READY' || !video.processedFilePath) {
            return next(createError(409, `Video is not ready for download. Current status: ${video.status}`));
        }

        // Check if the file actually exists on disk
        try {
             await fs.access(video.processedFilePath); // Check file existence
        } catch (fileError) {
             logger.error(`Processed file not found on disk: ${video.processedFilePath} for video ${id}`);
             // Optionally update status back to FAILED?
             // await prisma.video.update({ where: { id }, data: { status: 'FAILED' } });
             return next(createError(404, 'Processed video file not found. Please try rendering again.'));
        }


        // Use res.download to send the file
        // Set a user-friendly filename for the download prompt
        const downloadFilename = `rendered_${video.originalName}`;
        logger.info(`Initiating download for ${video.processedFilePath} as ${downloadFilename}`);

        res.download(video.processedFilePath, downloadFilename, (err) => {
            if (err) {
                // Important: Check if headers were already sent
                if (!res.headersSent) {
                     logger.error(`Error sending file ${video.processedFilePath}:`, err);
                     next(createError(500, `Could not download file: ${err.message}`));
                } else {
                     logger.warn(`Error after headers sent for file ${video.processedFilePath}:`, err);
                     // Cannot send another response here
                }
            } else {
                 logger.info(`File ${video.processedFilePath} downloaded successfully.`);
            }
        });

    } catch (error) {
        logger.error(`Error retrieving video ${id} for download:`, error);
         if (!error.statusCode) error.statusCode = 500;
        next(error);
    }
};