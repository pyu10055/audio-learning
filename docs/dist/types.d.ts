import { InferenceModel } from "@tensorflow/tfjs";
export interface Params {
    inputBufferLength?: number;
    bufferLength?: number;
    hopLength?: number;
    duration?: number;
    fftSize?: number;
    melCount?: number;
    targetSr?: number;
    isMfccEnabled?: boolean;
}
export interface FeatureExtractor extends EventEmitter.EventEmitter {
    config(params: Params): void;
    start(samples?: Float32Array): Promise<Float32Array[]> | void;
    stop(): void;
    getFeatures(): Float32Array[];
    getImages(): Float32Array[];
}
export declare enum ModelType {
    FROZEN_MODEL = 0,
    FROZEN_MODEL_NATIVE = 1,
    TF_MODEL = 2
}
export declare const BUFFER_LENGTH = 1024;
export declare const HOP_LENGTH = 444;
export declare const MEL_COUNT = 40;
export declare const EXAMPLE_SR = 44100;
export declare const DURATION = 1;
export declare const IS_MFCC_ENABLED: boolean;
export declare const MIN_SAMPLE = 3;
export declare const DETECTION_THRESHOLD = 0.5;
export declare const SUPPRESSION_TIME = 500;
export declare const MODELS: {
    [key: number]: InferenceModel;
};
