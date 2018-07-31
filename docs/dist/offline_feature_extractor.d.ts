import { EventEmitter } from 'eventemitter3';
import { FeatureExtractor, Params } from './utils/types';
export declare class OfflineFeatureExtractor extends EventEmitter implements FeatureExtractor {
    private source;
    private buffer;
    private analyser;
    protected features: Float32Array[];
    targetSr: number;
    bufferLength: number;
    melCount: number;
    hopLength: number;
    duration: number;
    isMfccEnabled: boolean;
    fftSize: number;
    config(params: Params): void;
    private createBufferWithValues;
    protected preprocess(): void;
    start(samples: Float32Array): Promise<Float32Array[]>;
    stop(): void;
    transform(data: Float32Array): Float32Array;
    getFeatures(): Float32Array[];
    getImages(): Float32Array[];
}
