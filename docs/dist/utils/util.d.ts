import * as tf from '@tensorflow/tfjs';
export declare function labelArrayToString(label: Float32Array, allLabels: string[]): string;
export declare function argmax(array: Float32Array): number[];
export declare function getParameterByName(name: string, url?: string): string;
export declare class Interval {
    private duration;
    private fn;
    private baseline;
    private timer;
    constructor(duration: number, fn: Function);
    run(): void;
    stop(): void;
}
export declare function normalize(x: tf.Tensor): tf.Tensor<tf.Rank>;
export declare function nextPowerOfTwo(value: number): number;
export declare function plotSpectrogram(canvas: HTMLCanvasElement, frequencyData: Float32Array[]): void;
export declare function melSpectrogramToInput(spec: Float32Array[]): tf.Tensor;
