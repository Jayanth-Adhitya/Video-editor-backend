# ===================================================================
# Configuration - MODIFY THESE VALUES
# ===================================================================
$inputFile = "test/fixtures/sample.mp4" # Relative or absolute path to your input video
$outputFile = "my_processed_video.mp4"   # Desired name/path for the final downloaded video

$subtitleText = "Processed via PowerShell Script!"
$subtitleStartTime = 1.5 # Start time in seconds
$subtitleEndTime = 5.0   # End time in seconds

$baseApiUrl = "http://localhost:3000/api/videos" # Your API base URL

$statusCheckDelaySeconds = 5 # How many seconds to wait between status checks
$maxStatusChecks = 60      # Maximum number of times to check status (prevents infinite loop)
# ===================================================================

# Function to handle API Errors from Invoke-WebRequest
function Handle-ApiError {
    param(
        [Parameter(Mandatory=$true)]
        [System.Exception]
        $Exception,

        [Parameter(Mandatory=$true)]
        [string]
        $ActionMessage
    )
    Write-Error "Error during '$ActionMessage': $($Exception.Message)"
    if ($Exception.Response) {
        # Try to get more details from the response body if available
        try {
            $errorBody = $Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorBody)
            $responseBody = $reader.ReadToEnd();
            Write-Warning "Server Response Body: $responseBody"
            $reader.Close()
            $errorBody.Close()
        } catch {
            Write-Warning "Could not read error response body."
        }
    }
    # Exit the script on error
    exit 1
}

# --- Step 1: Upload Video ---
Write-Host "STEP 1: Uploading video '$inputFile'..." -ForegroundColor Yellow
$uploadForm = @{
    video = Get-Item -Path $inputFile
}
try {
    $uploadResponse = Invoke-WebRequest -Uri "$baseApiUrl/upload" -Method Post -Form $uploadForm
    $uploadData = $uploadResponse.Content | ConvertFrom-Json
    $videoId = $uploadData.videoId
    if (-not $videoId) {
        Write-Error "Failed to extract videoId from upload response: $($uploadResponse.Content)"
        exit 1
    }
    Write-Host " -> Video uploaded successfully. Video ID: $videoId" -ForegroundColor Green
} catch {
    Handle-ApiError -Exception $_ -ActionMessage "Video Upload"
}


# --- Step 2: Add Subtitle ---
Write-Host "STEP 2: Adding subtitle..." -ForegroundColor Yellow
$subtitlePayload = @{
    text      = $subtitleText
    startTime = $subtitleStartTime
    endTime   = $subtitleEndTime
} | ConvertTo-Json

try {
    Invoke-WebRequest -Uri "$baseApiUrl/$videoId/subtitles" -Method Post -ContentType "application/json" -Body $subtitlePayload
    Write-Host " -> Subtitle operation added successfully." -ForegroundColor Green
} catch {
    Handle-ApiError -Exception $_ -ActionMessage "Add Subtitle"
}


# --- Step 3: Trigger Render ---
Write-Host "STEP 3: Triggering render..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "$baseApiUrl/$videoId/render" -Method Post
    Write-Host " -> Render job queued successfully." -ForegroundColor Green
} catch {
    Handle-ApiError -Exception $_ -ActionMessage "Trigger Render"
}


# --- Step 4: Wait and Check Status ---
Write-Host "STEP 4: Waiting for video processing (checking status every $statusCheckDelaySeconds seconds)..." -ForegroundColor Yellow
$currentStatus = $null
$checks = 0
do {
    $checks++
    Write-Host " -> Checking status (Attempt $checks/$maxStatusChecks)..."

    try {
        $statusResponse = Invoke-WebRequest -Uri "$baseApiUrl/$videoId/status" -Method Get
        $statusData = $statusResponse.Content | ConvertFrom-Json
        $currentStatus = $statusData.status
        Write-Host "    -> Current status: $currentStatus"

        if ($currentStatus -eq "READY") {
            Write-Host " -> Video is READY!" -ForegroundColor Green
            break # Exit the loop
        } elseif ($currentStatus -eq "FAILED") {
            Write-Error "Video processing FAILED on the server."
            exit 1
        }
        # Otherwise, status is UPLOADED, QUEUED, or PROCESSING - wait and retry
        Start-Sleep -Seconds $statusCheckDelaySeconds

    } catch {
        Handle-ApiError -Exception $_ -ActionMessage "Check Status"
    }

    if ($checks -ge $maxStatusChecks) {
        Write-Error "Maximum status checks ($maxStatusChecks) reached. Video did not become READY. Last status: $currentStatus"
        exit 1
    }

} while ($currentStatus -ne "READY")


# --- Step 5: Download Video ---
Write-Host "STEP 5: Downloading processed video to '$outputFile'..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "$baseApiUrl/$videoId/download" -Method Get -OutFile $outputFile
    Write-Host " -> Video downloaded successfully!" -ForegroundColor Green
    Write-Host " -> Final file saved as: $(Resolve-Path $outputFile)" # Show full path
} catch {
    Handle-ApiError -Exception $_ -ActionMessage "Download Video"
}


Write-Host "`n--- Script Complete ---" -ForegroundColor Cyan