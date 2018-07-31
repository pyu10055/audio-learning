import { InferenceModel } from '@tensorflow/tfjs-core';
import { EventEmitter } from 'eventemitter3';
import { LayerStreamingFeatureExtractor } from './layer_streaming_feature_extractor';
import { NativeStreamingFeatureExtractor } from './native_streaming_feature_extractor';
import { SoftStreamingFeatureExtractor } from './soft_streaming_feature_extractor';
import { StreamingFeatureExtractor } from './streaming_feature_extractor';
import { ModelType } from './utils/types';
export declare const GOOGLE_CLOUD_STORAGE_DIR = "https://storage.googleapis.com/tfjs-models/savedmodel/";
export declare const MODEL_FILE_URL = "voice/tensorflowjs_model.pb";
export declare const TF_MODEL_FILE_URL = "voice2/model.json";
export declare const WEIGHT_MANIFEST_FILE_URL = "voice/weights_manifest.json";
export interface Prediction {
    time: number;
    scores: number[];
}
export interface RecognizerParams {
    scoreT: number;
    commands: string[];
    noOther?: boolean;
    model: InferenceModel;
    threshold: number;
}
export declare function getFeatureShape(): number[];
export declare class CommandRecognizer extends EventEmitter {
    private canvas;
    model: InferenceModel;
    streamFeature: StreamingFeatureExtractor;
    softFFT: SoftStreamingFeatureExtractor;
    nativeFFT: NativeStreamingFeatureExtractor;
    layerFFT: LayerStreamingFeatureExtractor;
    predictionHistory: Prediction[];
    predictionCount: number;
    scoreT: number;
    commands: string[];
    nonCommands: string[];
    allLabels: string[];
    lastCommand: string;
    lastCommandTime: number;
    lastAverageLabelArray: Float32Array;
    threshold: number;
    modelType: ModelType;
    constructor(canvas: HTMLCanvasElement, params: RecognizerParams);
    setModelType(modelType: ModelType, commands: string[]): void;
    start(): void;
    stop(): void;
    isRunning(): boolean;
    getAllLabels(): string[];
    getCommands(): string[];
    private onUpdate;
    private emitCommand;
}
