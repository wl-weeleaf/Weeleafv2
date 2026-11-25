Leafy Live uses MediaPipe Tasks Vision 0.10.32 (Google, Apache License 2.0), and the Google MediaPipe Selfie Segmenter float16 model downloaded from:
https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite
Model source and model card: https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter
The binary model is shipped locally; camera frames are processed on the user's device. `scripts/prepare-live-assets.mjs` copies the runtime from the pinned package after dependency installation. No Google CDN is used at runtime for segmentation.
