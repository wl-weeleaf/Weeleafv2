let detector;
self.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      const { FaceDetector, FilesetResolver } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs');
      const files = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      detector = await FaceDetector.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.65,
      });
      self.postMessage({ type: 'ready' });
    } else if (data.type === 'frame') {
      try {
        const result = detector.detect(data.bitmap);
        const faces = result.detections.map((d) => d.boundingBox).filter(Boolean).sort((a, b) => b.width * b.height - a.width * a.height);
        const f = faces[0];
        self.postMessage({
          type: 'face',
          point: f ? { x: 1 - (2 * (f.originX + f.width / 2)) / data.bitmap.width, y: 1 - (2 * (f.originY + f.height / 2)) / data.bitmap.height } : null,
        });
      } finally {
        data.bitmap.close();
      }
    }
  } catch {
    self.postMessage({ type: 'error' });
  }
};
