import * as tf from '@tensorflow/tfjs';
import { Dataset } from './utils/dataset';
export interface TensorInfo {
    name: string;
    shape?: number[];
    dtype: tf.DataType;
}
export interface SourceModelConfig {
    model: tf.InferenceModel;
    bottleneck: string;
    output?: string;
    bottleneckShape: number[];
    outputShape?: number[];
}
export declare class TransferModel implements tf.InferenceModel {
    private configs;
    private dataset;
    private trainCallback?;
    outputs: TensorInfo[];
    inputs: TensorInfo[];
    model: tf.Model;
    constructor(configs: SourceModelConfig[], dataset: Dataset, trainCallback?: tf.CustomCallbackConfig);
    private features;
    private activation;
    train(): Promise<{
        [key: string]: Array<number | tf.Tensor>;
    }>;
    predict(input: tf.Tensor | tf.Tensor[] | tf.NamedTensorMap, config?: tf.ModelPredictConfig): tf.Tensor[];
    execute(inputs: tf.Tensor<tf.Rank> | Array<tf.Tensor<tf.Rank>> | tf.NamedTensorMap, outputs: string | string[]): tf.Tensor<tf.Rank> | Array<tf.Tensor<tf.Rank>>;
}
