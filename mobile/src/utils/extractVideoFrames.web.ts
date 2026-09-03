// Web build of frame extraction. expo-video-thumbnails has no real web
// implementation (its web shim only defines getThumbnailAsync, but the
// shared JS wrapper calls .getThumbnail on it -- a naming mismatch that
// throws "getThumbnail is not a function" the moment it's used), so this
// pulls frames the way a browser actually can: load the recorded clip into
// an offscreen <video>, seek to each requested timestamp, and grab the
// current frame onto a <canvas> as a JPEG. No extra dependency needed --
// this is standard browser media API, same idea as the native path, just a
// different mechanism for getting from "video" to "still frame."
function loadVideo(uri: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = uri;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => reject(new Error('Could not load the recorded video for frame extraction.'));
  });
}

function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = Math.min(timeSec, Math.max(video.duration - 0.05, 0));
  });
}

function captureFrame(video: HTMLVideoElement, maxWidth: number): string {
  const scale = Math.min(1, maxWidth / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the recorded video in this browser.');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
  return dataUrl.split(',')[1] || '';
}

export async function extractVideoFrames(videoUri: string, timesMs: number[], maxWidth = 800): Promise<string[]> {
  const video = await loadVideo(videoUri);
  try {
    const frames: string[] = [];
    for (const timeMs of timesMs) {
      await seekTo(video, timeMs / 1000);
      const base64 = captureFrame(video, maxWidth);
      if (base64) frames.push(base64);
    }
    return frames;
  } finally {
    video.src = '';
  }
}
