import { Hands } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { HAND_CONNECTIONS } from '@mediapipe/hands';

export class HandTracker {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');

        this.gestureCallback = null;
        this.lastGesture = null;
        this.gestureStartTime = 0;
        this.gestureThreshold = 300;

        this.hands = null;
        this.camera = null;
    }

    async initialize() {
        this.hands = new Hands({
            locateFile: (file) => {
                return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
            }
        });

        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5
        });

        this.hands.onResults((results) => this.onResults(results));

        this.camera = new Camera(this.video, {
            onFrame: async () => {
                await this.hands.send({ image: this.video });
            },
            width: 640,
            height: 480
        });

        await this.camera.start();

        this.canvas.width = 640;
        this.canvas.height = 480;
    }

    onResults(results) {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(results.image, 0, 0, this.canvas.width, this.canvas.height);

        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];

            drawConnectors(this.ctx, landmarks, HAND_CONNECTIONS, {
                color: '#00FF00',
                lineWidth: 5
            });

            drawLandmarks(this.ctx, landmarks, {
                color: '#FF0000',
                lineWidth: 2
            });

            const gesture = this.recognizeGesture(landmarks);
            this.handleGesture(gesture);

            document.getElementById('hand-status').textContent = '検出中';
            document.getElementById('gesture-type').textContent = gesture || '-';
        } else {
            document.getElementById('hand-status').textContent = '未検出';
            document.getElementById('gesture-type').textContent = '-';
        }

        this.ctx.restore();
    }

    recognizeGesture(landmarks) {
        const extended = this.getExtendedFingers(landmarks);

        const isPeace = extended[1] && extended[2] && !extended[0] && !extended[3] && !extended[4];
        const isPalmOpen = extended.every(f => f);
        const isFist = extended.every(f => !f);

        if (isPalmOpen) {
            return 'right';   // パーで右移動
        } else if (isPeace) {
            return 'left';    // チョキで左移動
        } else if (isFist) {
            return 'rotate';  // グーで回転
        }

        return null;
    }

    getExtendedFingers(landmarks) {
        return [
            Math.abs(landmarks[4].x - landmarks[2].x) > 0.1,    // 親指（横方向）
            landmarks[8].y < landmarks[5].y - 0.05,            // 人差し指
            landmarks[12].y < landmarks[9].y - 0.05,           // 中指
            landmarks[16].y < landmarks[13].y - 0.05,          // 薬指
            landmarks[20].y < landmarks[17].y - 0.05           // 小指
        ];
    }

    handleGesture(gesture) {
        if (!gesture) {
            this.lastGesture = null;
            this.gestureStartTime = 0;
            return;
        }

        const now = Date.now();

        if (gesture !== this.lastGesture) {
            this.lastGesture = gesture;
            this.gestureStartTime = now;
        } else if (now - this.gestureStartTime > this.gestureThreshold) {
            if (this.gestureCallback) {
                this.gestureCallback(gesture);
            }
        }
    }

    onGesture(callback) {
        this.gestureCallback = callback;
    }
}
