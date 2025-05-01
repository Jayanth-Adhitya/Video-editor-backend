import request from 'supertest';
import path from 'path';
import { fileURLToPath } from 'url';
import app from '../src/app.js'; // Import your configured Express app

// Helper to get __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to your sample video file
const sampleVideoPath = path.join(__dirname, 'fixtures', 'sample.mp4');

// Increase Jest timeout for potential file operations & FFmpeg probing
// jest.setTimeout(20000); // Uncomment and adjust time (in ms) if tests time out

describe('Video API Endpoints (Simple Check)', () => {
    let uploadedVideoId; // Variable to store the ID of the uploaded video

    // Test Video Upload
    it('should upload a video successfully', async () => {
        const response = await request(app)
            .post('/api/videos/upload')
            .attach('video', sampleVideoPath); // Attach the sample video file

        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('message', 'Video uploaded successfully');
        expect(response.body).toHaveProperty('videoId');
        expect(response.body.video).toHaveProperty('status', 'UPLOADED');

        uploadedVideoId = response.body.videoId; // Save the ID for later tests
        console.log(`Uploaded video ID for subsequent tests: ${uploadedVideoId}`);
    });

    it('should fail to upload without a video file', async () => {
        const response = await request(app)
            .post('/api/videos/upload');
            // No file attached

        expect(response.statusCode).toBe(400); // Expecting Bad Request
        expect(response.body).toHaveProperty('error');
        expect(response.body.error.message).toContain('No video file uploaded');
    });

    // Test Adding Edit Operations (depends on successful upload)
    it('should add a trim operation', async () => {
        if (!uploadedVideoId) {
            throw new Error("Cannot run trim test, video upload failed or didn't run.");
        }
        const response = await request(app)
            .post(`/api/videos/${uploadedVideoId}/trim`)
            .send({ startTime: 1.5, endTime: 5.0 });

        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('message', 'Trim operation added successfully.');
        expect(response.body).toHaveProperty('editId');
    });

    it('should add a subtitle operation', async () => {
         if (!uploadedVideoId) {
            throw new Error("Cannot run subtitle test, video upload failed or didn't run.");
        }
        const response = await request(app)
            .post(`/api/videos/${uploadedVideoId}/subtitles`)
            .send({ text: "Hello World Test", startTime: 2.0, endTime: 4.5 });

        expect(response.statusCode).toBe(201);
        expect(response.body).toHaveProperty('message', 'Subtitle operation added successfully.');
        expect(response.body).toHaveProperty('editId');
    });

    // Test Triggering Render (depends on successful upload)
    it('should trigger the render process', async () => {
        if (!uploadedVideoId) {
            throw new Error("Cannot run render test, video upload failed or didn't run.");
        }
        const response = await request(app)
            .post(`/api/videos/${uploadedVideoId}/render`);

        // 202 Accepted means the job was queued
        expect(response.statusCode).toBe(202);
        expect(response.body).toHaveProperty('message', 'Video rendering job accepted.');
        expect(response.body).toHaveProperty('status', 'QUEUED');
    });

    // Test Getting Status (depends on successful upload)
    it('should get the video status', async () => {
         if (!uploadedVideoId) {
            throw new Error("Cannot run status test, video upload failed or didn't run.");
        }
        const response = await request(app)
            .get(`/api/videos/${uploadedVideoId}/status`);

        expect(response.statusCode).toBe(200);
        expect(response.body).toHaveProperty('videoId', uploadedVideoId);
        // Status could be QUEUED or maybe PROCESSING if the worker picked it up instantly
        expect(response.body.status).toMatch(/QUEUED|PROCESSING/);
    });

    // Test Download Attempt (should fail initially)
     it('should fail to download the video before it is ready', async () => {
        if (!uploadedVideoId) {
            throw new Error("Cannot run download test, video upload failed or didn't run.");
        }
        const response = await request(app)
            .get(`/api/videos/${uploadedVideoId}/download`);

        // Expecting 409 Conflict or similar because the video isn't 'READY'
        expect(response.statusCode).toBe(409);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error.message).toContain('Video is not ready for download');
    });

     // Test non-existent video ID
    it('should return 404 for a non-existent video ID', async () => {
        const nonExistentId = '00000000-0000-0000-0000-000000000000'; // Example UUID
        const response = await request(app)
            .get(`/api/videos/${nonExistentId}/status`);

        expect(response.statusCode).toBe(404);
         expect(response.body).toHaveProperty('error');
         expect(response.body.error.message).toContain('Video not found');
    });

});