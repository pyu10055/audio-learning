import { EventEmitter } from 'eventemitter3';
import { CircularAudioBuffer } from './circular_audio_buffer';
import { FeatureExtractor, Params } from './types';
export declare class SoftwareOfflineFeatureExtractor extends EventEmitter implements FeatureExtractor {
    private source;
    private buffer;
    private features;
    targetSr: number;
    bufferLength: number;
    melCount: number;
    hopLength: number;
    duration: number;
    isMfccEnabled: boolean;
    fftSize: number;
    bufferCount: number;
    melFilterbank: Float32Array;
    scriptNode: ScriptProcessorNode;
    circularBuffer: CircularAudioBuffer;
    config(params: Params): void;
    private createBufferWithValues;
    start(samples: Float32Array): Promise<Float32Array[]>;
    stop(): void;
    transform(data: Float32Array): Float32Array;
    getFeatures(): Float32Array[];
    private getFullBuffers;
}
