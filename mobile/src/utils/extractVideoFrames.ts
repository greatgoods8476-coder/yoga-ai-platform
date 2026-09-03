import * as VideoThumbnails from 'expo-video-thumbnails';
import * as ImageManipulator from 'expo-image-manipulator';

// Native (iOS/Android) implementation. The web build uses
// extractVideoFrames.web.ts instead (Metro/Expo picks it up automatically
// for web bundles) -- expo-video-thumbnails has no real web target despite
// exporting a getThumbnailAsync stub there; calling it throws
// "ExpoVideoThumbnails.default.getThumbnail is not a function" because its
// web shim never actually implements the method the shared JS wrapper calls.
export async function extractVideoFrames(videoUri: string, timesMs: number[], maxWidth = 800): Promise<string[]> {
  const frames: string[] = [];
  for (const time of timesMs) {
    const thumb = await VideoThumbnails.getThumbnailAsync(videoUri, { time, quality: 0.6 });
    const compressed = await ImageManipulator.manipulateAsync(
      thumb.uri,
      [{ resize: { width: maxWidth } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (compressed.base64) frames.push(compressed.base64);
  }
  return frames;
}
