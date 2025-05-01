import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import logger from '../utils/logger.js';
import { processedUploadsPath } from '../config/storage.js';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';

// --- Font Path Handling ---
// Define a default font path (use forward slashes for Node.js path module)
// Ensure this font actually exists on your target Windows system.
// You might want to bundle a specific font with your application for reliability.
const DEFAULT_FONT_PATH_WINDOWS = 'C:/Windows/Fonts/arial.ttf';
// Fallback for non-Windows or if the default isn't found (less likely to work without fontconfig)
const DEFAULT_FONT_PATH_GENERIC = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'; // Example for Linux

// Function to get a valid font path
const getFontPath = async () => {
    try {
        // Check Windows path first
        await fs.access(DEFAULT_FONT_PATH_WINDOWS);
        logger.debug(`Using font: ${DEFAULT_FONT_PATH_WINDOWS}`);
        return DEFAULT_FONT_PATH_WINDOWS;
    } catch (err) {
        logger.warn(`Windows default font ${DEFAULT_FONT_PATH_WINDOWS} not accessible. Trying generic path.`);
        try {
            // Check generic path (might work if fontconfig is somehow set up)
            await fs.access(DEFAULT_FONT_PATH_GENERIC);
            logger.debug(`Using font: ${DEFAULT_FONT_PATH_GENERIC}`);
            return DEFAULT_FONT_PATH_GENERIC;
        } catch (err2) {
            logger.error(
                `Cannot access default fonts at ${DEFAULT_FONT_PATH_WINDOWS} or ${DEFAULT_FONT_PATH_GENERIC}. Subtitles may fail or use FFmpeg default.`
            );
            // Return null, drawtext might try its internal default (often fails)
            // Or throw an error if a font is absolutely required:
            // throw new Error("Cannot find a suitable font file for subtitles.");
            return null;
        }
    }
};

/**
 * Escapes a path for use within an FFmpeg filtergraph string.
 * Especially important for Windows paths with colons and backslashes.
 * @param {string} filePath - The path to escape.
 * @returns {string} - The escaped path.
 */
const escapePathForFFmpegFilter = (filePath) => {
    if (!filePath) return '';
    // 1. Replace backslashes with forward slashes (FFmpeg often prefers this)
    // 2. Escape the colon after the drive letter on Windows (e.g., C:)
    return filePath.replace(/\\/g, '/').replace(/([A-Za-z]):\//g, '$1\\:/');
};

/**
 * Escapes text content for use within the FFmpeg drawtext filter's 'text' parameter.
 * Handles characters that have special meaning within the filtergraph.
 * @param {string} text - The text to escape.
 * @returns {string} - The escaped text.
 */
const escapeTextForFFmpegDrawtext = (text) => {
    if (!text) return '';
    return text
        .replace(/\\/g, '\\\\') // Escape backslashes
        .replace(/'/g, "'\\\\''") // Escape single quotes (most robust way)
        .replace(/:/g, '\\:')  // Escape colons
        .replace(/%/g, '\\%') // Escape percent signs
        .replace(/,/g, '\\,') // Escape commas if they might interfere
        .replace(/\[/g, '\\[') // Escape brackets
        .replace(/\]/g, '\\]');
        // Add more escapes if needed based on observed errors
};


/**
 * Promisify ffprobe for getting video metadata
 * @param {string} filePath - Path to the video file
 * @returns {Promise<Object>} - Video metadata
 */
const ffprobePromise = (filePath) => {
    // ... (keep existing implementation)
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) {
                reject(err);
            } else {
                resolve(metadata);
            }
        });
    });
};

/**
 * Get the duration of a video file
 * @param {string} filePath - Path to the video file
 * @returns {Promise<number>} - Duration in seconds
 */
const getVideoDuration = async (filePath) => {
    // ... (keep existing implementation)
    try {
        logger.info(`Probing video duration for: ${filePath}`);
        const metadata = await ffprobePromise(filePath);
        if (metadata && metadata.format && metadata.format.duration) {
            logger.info(`Duration found: ${metadata.format.duration}`);
            return metadata.format.duration;
        }
        logger.warn(`Could not extract duration from metadata for ${filePath}`);
        return null;
    } catch (error) {
        logger.error(`Error probing video ${filePath}:`, error);
        throw new Error(`Failed to get video duration: ${error.message}`);
    }
};

/**
 * Trims a video to specified start and end times
 * @param {string} inputPath - Path to the input video file
 * @param {string} outputPath - Path where the trimmed video will be saved
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @returns {Promise<string>} - Path to the trimmed video
 */
const trimVideo = (inputPath, outputPath, startTime, endTime) => {
     // ... (keep existing implementation)
     return new Promise((resolve, reject) => {
        logger.info(`Trimming video: ${inputPath} from ${startTime} to ${endTime}`);
        ffmpeg(inputPath)
            .setStartTime(startTime)
            .setDuration(endTime - startTime)
            .output(outputPath)
            // Ensure streams are copied or re-encoded appropriately. '-c copy' might be faster if no re-encoding needed.
            // However, trimming often requires re-encoding at least near the cut points unless keyframes align perfectly.
            // Omitting .outputOptions('-c copy') or explicitly setting codecs is safer.
            .outputOptions([
                '-c:v libx264', // Example: Re-encode video
                '-crf 23',      // Example: Quality setting
                '-preset medium', // Example: Encoding speed/compression
                '-c:a aac',     // Example: Re-encode audio
                '-b:a 128k'     // Example: Audio bitrate
            ])
            .on('start', (commandLine) => logger.debug('FFmpeg command:', commandLine))
            .on('error', (err, stdout, stderr) => { // Get stderr for more info
                logger.error(`Error trimming video ${inputPath}:`, err);
                logger.error('FFmpeg stderr:', stderr);
                reject(err);
            })
            .on('end', () => {
                logger.info(`Video trimmed successfully: ${outputPath}`);
                resolve(outputPath);
            })
            .run();
    });
};

/**
 * Execute a raw FFmpeg command using child_process
 * @param {Array<string>} args - FFmpeg command arguments
 * @returns {Promise<void>}
 */
const executeFFmpeg = (args) => {
    // ... (keep existing implementation)
     return new Promise((resolve, reject) => {
        logger.debug('Executing FFmpeg with args:', ['ffmpeg', ...args].join(' ')); // Log the full command

        const ffmpegProcess = spawn('ffmpeg', args, { windowsHide: true }); // windowsHide can prevent console window flashing

        let stdoutData = '';
        let stderrData = ''; // Crucial for FFmpeg errors

        ffmpegProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        ffmpegProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
            // Optionally log stderr in real-time for long processes
            // logger.trace('FFmpeg stderr chunk:', data.toString());
        });

        ffmpegProcess.on('close', (code) => {
            // Log stderr regardless of exit code for debugging
            if (stderrData) {
                 logger.debug(`FFmpeg stderr:\n${stderrData}`);
            }
             if (stdoutData) {
                 logger.debug(`FFmpeg stdout:\n${stdoutData}`);
            }

            if (code === 0) {
                logger.debug('FFmpeg command completed successfully');
                resolve();
            } else {
                logger.error(`FFmpeg exited with code ${code}`);
                // No need to log stderr/stdout again here if already logged above
                reject(new Error(`FFmpeg command failed with code ${code}. See stderr log above for details.`));
            }
        });

        ffmpegProcess.on('error', (err) => {
            logger.error('Failed to start FFmpeg process:', err);
            reject(err);
        });
    });
};

/**
 * Adds subtitles to a video using direct FFmpeg drawtext filter with explicit font path.
 * @param {string} inputPath - Path to input video
 * @param {string} outputPath - Path for output video
 * @param {string} subtitleText - Text to display
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @returns {Promise<string>} - Path to output video
 */
const addSubtitles = async (inputPath, outputPath, subtitleText, startTime, endTime) => {
    logger.info(`Adding subtitle "${subtitleText}" to ${inputPath} from ${startTime} to ${endTime}`);

    // Parameter validation
    if (!inputPath || !outputPath) {
        throw new Error('Input and output paths are required');
    }
    if (subtitleText == null || subtitleText.trim() === '') {
        logger.warn('Subtitle text is empty. Skipping subtitle addition and just copying video.');
        // Fallback: Copy video if text is empty
        const copyArgs = ['-y', '-i', inputPath, '-c', 'copy', outputPath];
        await executeFFmpeg(copyArgs);
        return outputPath;
    }

    const start = Number(startTime);
    const end = Number(endTime);
    if (isNaN(start) || isNaN(end) || start < 0 || end <= start) {
        throw new Error(`Invalid subtitle timing: start=${startTime}, end=${endTime}`);
    }

    try {
        const fontPath = await getFontPath();
        if (!fontPath) {
             logger.error("No valid font path found. Attempting drawtext without explicit fontfile (likely to fail)...");
             // Decide: either throw error here, or let FFmpeg try and likely fail
             // throw new Error("Cannot render subtitles: No suitable font file found.");
        }

        // Escape necessary components for the filtergraph
        const escapedFontPath = escapePathForFFmpegFilter(fontPath);
        const escapedText = escapeTextForFFmpegDrawtext(subtitleText);

        // Construct the drawtext filter string
        // Using fontsize relative to height (e.g., h/20) can be more robust than fixed size
        // Added box=1 for background, adjusted y position
        const filterGraph = `drawtext=${fontPath ? `fontfile='${escapedFontPath}':` : ''}text='${escapedText}':fontcolor=white:fontsize=h/20:box=1:boxcolor=black@0.5:boxborderw=10:x=(w-text_w)/2:y=h-th-h*0.1:enable='between(t,${start},${end})'`;

        const drawTextArgs = [
            '-y',                      // Overwrite output file
            '-i', inputPath,           // Input file
            '-vf', filterGraph,        // Video filtergraph
            '-c:v', 'libx264',         // Re-encode video (necessary for drawtext)
            '-crf', '22',              // Constant Rate Factor (quality, lower is better, 18-28 is common)
            '-preset', 'medium',       // Encoding speed vs compression (ultrafast, superfast, veryfast, faster, fast, medium, slow, slower, veryslow)
            '-c:a', 'copy',            // Copy audio stream (usually safe)
            '-movflags', '+faststart', // Good for web playback
            outputPath                 // Output file
        ];

        await executeFFmpeg(drawTextArgs);
        logger.info(`Successfully added subtitles using drawtext method to ${outputPath}`);
        return outputPath;

    } catch (err) {
        logger.error(`Drawtext subtitle method failed: ${err.message}.`);
        logger.warn('Attempting to copy video without subtitles as fallback.');

        // Fallback: create a copy of the video without subtitles
        const copyArgs = ['-y', '-i', inputPath, '-c', 'copy', outputPath];
        try {
            await executeFFmpeg(copyArgs);
            logger.info(`Copied video without subtitles to ${outputPath} after subtitle failure.`);
            return outputPath; // Return the path to the copied video
        } catch (copyErr) {
            logger.error(`Fallback copy operation also failed: ${copyErr.message}`);
            // Throw the original error enriched with fallback failure info
            throw new Error(`Could not add subtitles (Error: ${err.message}) and fallback copy failed (Error: ${copyErr.message})`);
        }
    }
};

/**
 * Applies multiple edits to a video sequentially
 * @param {string} originalFilePath - Path to the original video
 * @param {Array<Object>} edits - Array of edit operations
 * @returns {Promise<string>} - Path to the final processed video
 */
const applyEdits = async (originalFilePath, edits) => {
    // --- Keep your existing applyEdits logic ---
    // It seems robust in handling sequential edits and cleanup.
    // Ensure it passes the correct parameters to the updated trimVideo and addSubtitles.

    let currentFilePath = originalFilePath;
    const intermediateFiles = [];

    // Sort edits by their 'order' field
    edits.sort((a, b) => a.order - b.order);

    logger.info(`Starting edit pipeline for ${originalFilePath} with ${edits.length} edits.`);

    for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        // Use a more descriptive temporary filename
        const tempOutputPath = path.join(processedUploadsPath, `${uuidv4()}_step${i + 1}_${edit.type.toLowerCase()}${path.extname(currentFilePath)}`);
        intermediateFiles.push(tempOutputPath); // Keep track for cleanup

        try {
            logger.info(`Applying edit ${i + 1}/${edits.length}: ${edit.type} (Order: ${edit.order}, ID: ${edit.id || 'N/A'})`);
            switch (edit.type) {
                case 'TRIM':
                    if (edit.startTime == null || edit.endTime == null || edit.endTime <= edit.startTime) {
                         logger.error(`Invalid TRIM parameters for edit ID ${edit.id}: startTime=${edit.startTime}, endTime=${edit.endTime}`);
                        throw new Error(`Trim operation (ID: ${edit.id}) has invalid or missing start/end time.`);
                    }
                    await trimVideo(currentFilePath, tempOutputPath, edit.startTime, edit.endTime);
                    break;
                case 'SUBTITLE':
                    if (edit.startTime == null || edit.endTime == null || edit.endTime <= edit.startTime || !edit.text) {
                         logger.error(`Invalid SUBTITLE parameters for edit ID ${edit.id}: startTime=${edit.startTime}, endTime=${edit.endTime}, text=${edit.text ? 'present' : 'missing'}`);
                        throw new Error(`Subtitle operation (ID: ${edit.id}) has invalid or missing parameters.`);
                    }
                    await addSubtitles(currentFilePath, tempOutputPath, edit.text, edit.startTime, edit.endTime);
                    break;
                // Add cases for other edit types as needed
                default:
                    logger.warn(`Unsupported edit type: ${edit.type}. Skipping this edit and copying the video.`);
                    // If skipping, copy current to temp to maintain the chain
                     await fs.copyFile(currentFilePath, tempOutputPath);
                    // Alternatively, skip creating a temp file if no operation happened
                    // intermediateFiles.pop(); // Remove the planned temp file if we didn't create it
                    // continue; // Skip cleanup of currentFilePath and setting currentFilePath = tempOutputPath
            }

             // If the operation was successful, the *new* current file is tempOutputPath
             const previousFilePath = currentFilePath;
             currentFilePath = tempOutputPath;
             logger.info(`Edit ${edit.type} applied. Intermediate file: ${currentFilePath}`);

            // Clean up the *previous* intermediate file if it wasn't the original input
            if (previousFilePath !== originalFilePath && intermediateFiles.includes(previousFilePath)) {
                 await fs.unlink(previousFilePath).catch(err =>
                    logger.warn(`Could not delete previous intermediate file ${previousFilePath}: ${err.message}`)
                );
                 // Remove from tracking array after successful deletion attempt
                const index = intermediateFiles.indexOf(previousFilePath);
                if (index > -1) intermediateFiles.splice(index, 1);
            }


        } catch (error) {
            logger.error(`Error applying edit ${edit.type} (ID: ${edit.id}, Step: ${i + 1}):`, error);
            // Clean up all generated intermediate files on error
            await cleanupFiles(intermediateFiles); // Clean up all tracked intermediates
            // Also try cleaning the file that was *being* processed if it's different from the last successful one
            if (currentFilePath !== tempOutputPath && currentFilePath !== originalFilePath) {
                await cleanupFiles([currentFilePath]);
            }
            throw new Error(`Failed during edit operation ${edit.type} (Step ${i+1}): ${error.message}`);
        }
    }

    logger.info(`Edit pipeline completed. Final processed file: ${currentFilePath}`);

    // Clean up any remaining intermediate files *except* the final one
    const filesToClean = intermediateFiles.filter(f => f !== currentFilePath);
    await cleanupFiles(filesToClean);


    // If the final file is still one of the temporary UUID named files,
    // consider renaming it to a more permanent name here before returning.
    // Example:
    // const finalFileName = path.join(processedUploadsPath, `processed_${path.basename(originalFilePath)}`);
    // await fs.rename(currentFilePath, finalFileName);
    // logger.info(`Renamed final file to: ${finalFileName}`);
    // return finalFileName;

    return currentFilePath; // Return the path to the final processed file (might still have UUID name)
};


/**
 * Cleans up temporary files
 * @param {Array<string>} filePaths - Paths to files to clean up
 */
const cleanupFiles = async (filePaths) => {
    // ... (keep existing implementation)
     logger.debug(`Attempting cleanup for files: ${filePaths.join(', ')}`);
    for (const filePath of filePaths) {
        if (filePath) {
            try {
                await fs.access(filePath); // Check if file exists before trying to delete
                await fs.unlink(filePath);
                logger.debug(`Cleaned up temporary file: ${filePath}`);
            } catch (error) {
                // Log only if it's not a "file not found" error
                if (error.code !== 'ENOENT') {
                    logger.warn(`Could not delete temporary file ${filePath}: ${error.message} (Code: ${error.code})`);
                } else {
                     logger.debug(`Temporary file ${filePath} already gone or never created.`);
                }
            }
        }
    }
};

export {
    getVideoDuration,
    applyEdits,
    cleanupFiles, // Keep export if used elsewhere
    // No need to export internal helpers like addSubtitles, trimVideo unless used directly outside this module
};