import * as tf from '@tensorflow/tfjs';
export declare class Dataset {
    numClasses: number;
    xs: tf.Tensor[];
    ys: tf.Tensor;
    constructor(numClasses: number);
    addExamples(examples: tf.Tensor, labels: tf.Tensor): void;
    addExample(example: tf.Tensor | tf.Tensor[], label: number): void;
}
