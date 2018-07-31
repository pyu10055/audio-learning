import { OfflineFeatureExtractor } from './offline_feature_extractor';
export declare class MfccOfflineFeatureExtractor extends OfflineFeatureExtractor {
    fftSize: number;
    hopLength: number;
    duration: number;
    isMfccEnabled: boolean;
    private melFilterbank;
    transform(data: Float32Array): Float32Array;
}
