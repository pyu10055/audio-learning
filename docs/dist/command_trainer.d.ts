import { FrozenModel } from '@tensorflow/tfjs-converter';
import { EventEmitter } from 'eventemitter3';
import { StreamingFeatureExtractor } from './streaming_feature_extractor';
import { TransferModel } from './transfer_model';
import { Dataset } from './utils/dataset';
export declare class CommandTrainer extends EventEmitter {
    private canvas;
    model: FrozenModel;
    transferModel: TransferModel;
    streamFeature: StreamingFeatureExtractor;
    dataset: Dataset;
    label: number;
    trained: boolean;
    withData: boolean;
    constructor(canvas: HTMLCanvasElement);
    load(): Promise<void>;
    record(label: number): void;
    train(): Promise<void>;
    stopRecord(): void;
    private addSamples;
}
