import { ModelType, Params } from './utils/types';
export declare const EVENT_NAME = "update";
export declare const MIN_SCORE = 0.6;
export declare class ModelEvaluation {
    private canvas;
    targetSr: number;
    bufferLength: number;
    melCount: number;
    hopLength: number;
    duration: number;
    isMfccEnabled: boolean;
    private frozenModel;
    private tfModel;
    private model;
    private featureExtractor;
    constructor(canvas: HTMLCanvasElement, params: Params);
    load(): Promise<void>;
    eval(modelType: ModelType, files: File[], labels: number[]): Promise<Array<[number, number]>>;
    private evalFile;
    private featuresToInput;
    private runPrediction;
}
