import { OfflineFeatureExtractor } from './offline_feature_extractor';
import { AudioUtils } from './utils/audio_utils';
export declare class NativeOfflineFeatureExtractor extends OfflineFeatureExtractor {
    fftSize: number;
    hopLength: number;
    duration: number;
    isMfccEnabled: boolean;
    images: Float32Array[];
    audioUtils: AudioUtils;
    private melFilterbank;
    preprocess(): void;
    transform(data: Float32Array): Float32Array;
    getImages(): Float32Array[];
}
