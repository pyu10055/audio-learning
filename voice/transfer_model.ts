import * as tf from '@tensorflow/tfjs';
import {InferenceModel, ModelPredictConfig, NamedTensorMap, Tensor, CustomCallbackConfig} from '@tensorflow/tfjs';

import {Dataset} from './dataset';

export interface TransferModelConfig {
  sourceModels: Array<tf.InferenceModel>;
  bottleNecks: string[];
}

const LEARNING_RATE = 0.001;
const BATCH_SIZE_FRACTION = 0.1;
const EPOCHS = 300;
export class TransferModel implements InferenceModel {
  model: tf.Model;


  constructor(
      private config: TransferModelConfig, private dataset: Dataset,
      private shape: number[], private trainCallback: CustomCallbackConfig) {
    this.checkConfig();
    // Creates a 2-layer fully connected model. By creating a separate model,
    // rather than adding layers to the mobilenet model, we "freeze" the weights
    // of the mobilenet model, and only train weights from the new model.
    this.model = tf.sequential({
      layers: [
        // Layer 1
        tf.layers.dense({
          units: 10,
          activation: 'relu',
          kernelInitializer: 'varianceScaling',
          useBias: true,
          inputShape: this.shape
        }),
        // Layer 2. The number of units of the last layer should correspond
        // to the number of classes we want to predict.
        tf.layers.dense({
          units: dataset.numClasses,
          kernelInitializer: 'varianceScaling',
          useBias: false,
          activation: 'softmax'
        })
      ]
    });    
  }

  private checkConfig() {
    if (this.config.bottleNecks && this.config.sourceModels &&
        this.config.bottleNecks.length != this.config.sourceModels.length) {
      throw new Error(`source model count (${
          this.config.sourceModels
              .length}) does not match with bottleneck node count (${
          this.config.bottleNecks.length}).`)
    }
  }

  private features(input: tf.Tensor|tf.Tensor[]) {
    input = input instanceof Array ? input : [input];
    return tf.tidy(() => {
      const activations = this.config.sourceModels.map(
          (model, index) =>
              model.execute(input[index], this.config.bottleNecks[index]) as
              tf.Tensor2D);
      return tf.concat2d(activations, 1);
    });
  }
  /**
   * Sets up and trains the classifier.
   */
  async train() {
    if (this.dataset.xs == null) {
      throw new Error('Add some examples before training!');
    }

    // Creates the optimizers which drives training of the model.
    const optimizer = tf.train.adam(LEARNING_RATE);
    // We use categoricalCrossentropy which is the loss function we use for
    // categorical classification which measures the error between our predicted
    // probability distribution over classes (probability that an input is of
    // each class), versus the label (100% probability in the true class)>
    this.model.compile({optimizer: optimizer, loss: 'categoricalCrossentropy'});
    
    // We parameterize batch size as a fraction of the entire dataset because
    // the number of examples that are collected depends on how many examples
    // the user collects. This allows us to have a flexible batch size.
    const batchSize =
        Math.floor(this.dataset.xs[0].shape[0] * BATCH_SIZE_FRACTION);
    if (!(batchSize > 0)) {
      throw new Error(
          `Batch size is 0 or NaN. Please choose a non-zero fraction.`);
    }

    // Train the model! Model.fit() will shuffle xs & ys so we don't have to.
    return await this.model.fit(this.features(this.dataset.xs), this.dataset.ys, {
      batchSize,
      epochs: EPOCHS,
      callbacks: this.trainCallback
    });
  }


  predict(
      input: tf.Tensor|tf.Tensor[]|NamedTensorMap,
      config?: ModelPredictConfig): tf.Tensor {
    const predictedClass = tf.tidy(() => {
      const activations = this.features(input as tf.Tensor | tf.Tensor[]);

      // Make a prediction through our newly-trained model using the activation
      // from source model as input.
      const predictions = this.model.predict(activations);

      // Returns the index with the maximum probability. This number corresponds
      // to the class the model thinks is the most probable given the input.
      return (predictions as tf.Tensor).softmax();
    });

    return predictedClass;
  }

  execute(
      inputs: tf.Tensor<tf.Rank>|tf.Tensor<tf.Rank>[]|tf.NamedTensorMap,
      outputs: string|string[]): tf.Tensor<tf.Rank>|tf.Tensor<tf.Rank>[] {
    throw new Error('Method not implemented.');
  }
}