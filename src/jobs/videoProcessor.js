import prisma from '../config/db.js';
import logger from '../utils/logger.js';
import { applyEdits, cleanupFiles } from '../services/ffmpegService.js';
import path from 'path';
import fs from 'fs/promises';
import { processedUploadsPath } from '../config/storage.js';

// Simulates processing time (e.g., 5 seconds) - Remove/adjust for real use
const simulateProcessingTime = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const processVideoJob = async (jobData) => {
    const { videoId } = jobData;
    logger.info(`[Job ${videoId}] Starting processing...`);

    let video;
    let tempProcessedPath = null; // Path from applyEdits before final rename

    try {
        // 1. Fetch video and its edit operations, ordered correctly
        video = await prisma.video.findUnique({
            where: { id: videoId },
            include: {
                edits: {
                    orderBy: { order: 'asc' },
                },
            },
        });

        if (!video) {
            throw new Error(`Video with ID ${videoId} not found.`);
        }
        if (video.status !== 'QUEUED') {
             logger.warn(`[Job ${videoId}] Video status is ${video.status}, not 'QUEUED'. Skipping redundant processing.`);
             return; // Or throw error? Depends on desired behavior.
        }
        if (!video.filePath) {
             throw new Error(`Original file path missing for video ${videoId}.`);
        }
        if (video.edits.length === 0) {
             // Should ideally be caught before queuing, but double-check
             throw new Error(`No edits found for video ${videoId}. Cannot process.`);
        }


        // 2. Update status to PROCESSING
        await prisma.video.update({
            where: { id: videoId },
            data: { status: 'PROCESSING' },
        });
        logger.info(`[Job ${videoId}] Status updated to PROCESSING.`);

        // Simulate actual work
        await simulateProcessingTime(5000); // Simulate 5 seconds of work

        // 3. Apply FFmpeg operations sequentially
        logger.info(`[Job ${videoId}] Applying ${video.edits.length} edits...`);
        tempProcessedPath = await applyEdits(video.filePath, video.edits);
        logger.info(`[Job ${videoId}] Edits applied. Temporary result at: ${tempProcessedPath}`);


         // 4. Generate final filename and path
        const finalFilename = `processed_${video.fileName}`; // Base final name on original stored name
        const finalProcessedPath = path.join(processedUploadsPath, finalFilename);

        // 5. Move/Rename the final temporary file to its permanent location
        await fs.rename(tempProcessedPath, finalProcessedPath);
        logger.info(`[Job ${videoId}] Renamed final file to: ${finalProcessedPath}`);
        tempProcessedPath = null; // Clear temp path as it's moved


        // 6. Update video status to READY in DB
        await prisma.video.update({
            where: { id: videoId },
            data: {
                status: 'READY',
                processedFilePath: finalProcessedPath, // Store the final path
                processedFileName: finalFilename,
            },
        });
        logger.info(`[Job ${videoId}] Status updated to READY. Processing complete.`);

    } catch (error) {
        logger.error(`[Job ${videoId}] Processing failed:`, error);

        // Attempt to clean up temporary file if it exists
        if (tempProcessedPath) {
            logger.warn(`[Job ${videoId}] Cleaning up intermediate file due to error: ${tempProcessedPath}`);
             await cleanupFiles([tempProcessedPath]);
        }


        // Update status to FAILED in DB
        if (videoId) { // Ensure we have videoId to update status
             try {
                 await prisma.video.update({
                     where: { id: videoId },
                     data: { status: 'FAILED' },
                 });
                 logger.info(`[Job ${videoId}] Status updated to FAILED.`);
             } catch (dbError) {
                 logger.error(`[Job ${videoId}] Failed to update status to FAILED after error:`, dbError);
             }
        }
        // Re-throw the error to let BullMQ know the job failed
        throw error;
    }
};