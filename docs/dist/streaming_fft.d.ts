import { EventEmitter } from 'eventemitter3';
import { CircularAudioBuffer } from './circular_audio_buffer';
import { Params } from './types';
export declare const audioCtx: AudioContext;
export declare class StreamingFFT extends EventEmitter {
    inputBufferLength: number;
    targetSr: number;
    bufferLength: number;
    bufferCount: number;
    hopTime: number;
    melCount: number;
    hopLength: number;
    duration: number;
    isMfccEnabled: boolean;
    spectrogram: Float32Array[];
    melFilterbank: Float32Array;
    isStreaming: boolean;
    analyser: AnalyserNode;
    stream: MediaStream;
    circularBuffer: CircularAudioBuffer;
    processStartTime: Date;
    processSampleCount: number;
    timer: any;
    constructor(params: Params);
    private nextPowerOfTwo;
    getSpectrogram(): Float32Array[];
    start(): void;
    stop(): void;
    private onAudioProcess;
}