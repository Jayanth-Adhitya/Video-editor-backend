# Video Editing Platform Backend API

This project provides the backend API service for a web-based video editing platform. It allows users to upload videos, apply basic edits like trimming and subtitles, render the final video asynchronously, and download the result.

## Features

*   **Video Upload:** Accepts `.mp4`, `.mov` video files.
*   **Metadata Storage:** Stores video information (name, duration, size, status) in PostgreSQL.
*   **Video Trimming:** Defines start/end points for trimming.
*   **Subtitle Overlay:** Adds text overlays for specified durations.
*   **Asynchronous Rendering:** Uses FFmpeg via BullMQ and Redis for background processing of edit operations.
*   **Status Tracking:** Provides an endpoint to check the rendering status.
*   **Video Download:** Allows downloading the final processed video.

## Tech Stack

*   **Runtime:** Node.js (v18+)
*   **Framework:** Express.js
*   **Database:** PostgreSQL
*   **ORM:** Prisma
*   **Video Processing:** FFmpeg (via `fluent-ffmpeg`)
*   **File Uploads:** Multer
*   **Background Jobs:** BullMQ
*   **Queue Datastore:** Redis
*   **Logging:** Pino
*   **Validation:** express-validator
*   **Language:** JavaScript (ES Modules)

## Prerequisites

*   Node.js (v18 or later recommended)
*   npm or yarn
*   PostgreSQL Server
*   Redis Server
*   FFmpeg (must be installed and accessible in your system's PATH)

## Setup and Installation

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd video-editor-backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Setup PostgreSQL:**
    *   Create a PostgreSQL database (e.g., `video_editor`).
    *   Ensure your PostgreSQL server is running.

4.  **Setup Redis:**
    *   Ensure your Redis server is running (default port 6379).

5.  **Configure Environment Variables:**
    *   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    *   Edit the `.env` file with your specific configurations:
        *   `DATABASE_URL`: Your PostgreSQL connection string.
        *   `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (if needed).
        *   `PORT`: The port for the API server (default: 3000).
        *   `APP_BASE_URL`: Base URL for accessing files (used potentially in future).

6.  **Run Database Migrations:**
    *   This will create the necessary tables based on `prisma/schema.prisma`.
    *   Make sure your `DATABASE_URL` in `.env` is correct first.
    ```bash
    npx prisma migrate dev --name init
    ```
    *(You might be prompted to reset the database if it already exists with incompatible changes. Be careful in production!)*

7.  **Generate Prisma Client:** (Usually done automatically by `migrate dev`, but good to know)
    ```bash
    npx prisma generate
    ```

8.  **Create Upload Directories:** (If not done automatically)
    ```bash
    mkdir -p uploads/raw uploads/processed
    ```

## Running the Application

You need to run two processes: the API server and the background job worker.

1.  **Run the API Server:**
    ```bash
    npm run dev:server
    ```
    *(This uses nodemon for auto-reloading during development)*

    Or for production:
    ```bash
    npm start
    ```

2.  **Run the Background Worker:** (In a separate terminal)
    ```bash
    npm run dev:worker
    ```
     *(This uses nodemon for auto-reloading during development)*

     Or for production:
    ```bash
     npm run start:worker
     ```

The API server will typically be running on `http://localhost:3000`.

## API Endpoints

*   `POST /api/videos/upload`
    *   Uploads a video file.
    *   Requires `multipart/form-data` with a file field named `video`.
    *   **Response:** `201 Created` with video metadata (`videoId`, `status`, etc.).
*   `POST /api/videos/:id/trim`
    *   Adds a trim operation to the queue for the specified video ID.
    *   Requires JSON body: `{ "startTime": <seconds>, "endTime": <seconds> }`.
    *   **Response:** `201 Created` with edit operation details.
*   `POST /api/videos/:id/subtitles`
    *   Adds a subtitle operation to the queue.
    *   Requires JSON body: `{ "text": "Your subtitle", "startTime": <seconds>, "endTime": <seconds> }`.
    *   **Response:** `201 Created` with edit operation details.
*   `POST /api/videos/:id/render`
    *   Triggers the background rendering process for the video.
    *   Combines all previously added edit operations.
    *   **Response:** `202 Accepted` indicating the job is queued.
*   `GET /api/videos/:id/status`
    *   Checks the current status of the video (`UPLOADED`, `QUEUED`, `PROCESSING`, `READY`, `FAILED`).
    *   **Response:** `200 OK` with status information.
*   `GET /api/videos/:id/download`
    *   Downloads the final rendered video file.
    *   Only works if the video status is `READY`.
    *   **Response:** The video file stream.

*(See Postman collection or Swagger docs for detailed request/response examples - if you add them)*

## Scripts

*   `npm start`: Runs the API server using Node (for production).
*   `npm run start:worker`: Runs the background worker using Node (for production).
*   `npm run dev:server`: Runs the API server using `nodemon` (for development).
*   `npm run dev:worker`: Runs the background worker using `nodemon` (for development).
*   `npm run migrate:dev`: Runs Prisma migrations for development.
*   `npm run prisma:generate`: Generates the Prisma client.
*   `npm run prisma:studio`: Opens Prisma Studio GUI.

## Notes

*   **Error Handling:** Basic error handling is implemented. More specific error types can be added.
*   **Storage:** Currently uses local file storage in the `uploads/` directory. This can be swapped out for cloud storage like AWS S3 by modifying `src/middlewares/fileUpload.js` and the file handling logic in services/controllers.
*   **FFmpeg Path:** Ensure the `ffmpeg` command is globally available in your system's PATH.
*   **Scalability:** The use of BullMQ allows scaling the workers independently of the API server.
*   **Security:** This implementation lacks authentication and authorization. For production use, add appropriate security measures. Input validation is present but should be reviewed for robustness.