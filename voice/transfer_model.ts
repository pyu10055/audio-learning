import * as tf from '@tensorflow/tfjs';
import {Dataset} from './dataset';
import { TensorInfo } from '@tensorflow/tfjs-core/dist/types';

export interface SourceModelConfig {
  model: tf.InferenceModel;
  bottleneck: string;
  output?: string;
  bottleneckShape: number[];
  outputShape?: number[];
}

const LEARNING_RATE = 0.001;
const BATCH_SIZE_FRACTION = 0.1;
const EPOCHS = 300;
export class TransferModel implements tf.InferenceModel {
  outputs: TensorInfo[] = [];
  inputs: TensorInfo[] = [];
  model: tf.Model;

  constructor(
      private configs: SourceModelConfig[], private dataset: Dataset,
      private trainCallback?: tf.CustomCallbackConfig) {
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
          inputShape: this.configs.reduce(
              (shape: number[], config) => {
                config.bottleneckShape.forEach(
                    (dim, index) => shape[index] =
                        !!shape[index] ? shape[index] + dim : dim);
                return shape;
              },
              [])
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

  private features(input: tf.Tensor|tf.Tensor[]) {
    input = input instanceof Array ? input : [input];
    return tf.tidy(() => {
      const activations = this.configs.map(
          (config, index) => config.model.execute(
                                 (input as tf.Tensor[])[index],
                                 config.bottleneck) as tf.Tensor2D);
      return tf.concat2d(activations, 1);
    });
  }

  private activation(input: tf.Tensor|tf.Tensor[]) {
    input = input instanceof Array ? input : [input];
    return tf.tidy(() => {
      const activations = this.configs.map(
          (config, index) => config.model.execute(
              (input as tf.Tensor[])[index],
              [config.bottleneck, config.output].filter(n => n != null)));

      const features = activations.map(
          activation => Array.isArray(activation) ? activation[0] : activation);
      const outputs =
          activations.map(activation => (activation as tf.Tensor[])[1])
              .filter(n => n != null);

      return outputs.length > 0 ?
          [
            tf.concat2d(features as tf.Tensor2D[], 1),
            tf.concat2d(outputs as tf.Tensor2D[], 1)
          ] :
          [tf.concat2d(features as tf.Tensor2D[], 1)];
    });
  }
  /**
   * Sets up and trains the classifier.
   */
  async train(): Promise<{[key: string]: Array<number|tf.Tensor>}> {
    if (this.dataset.xs == null) {
      throw new Error('Add some examples before training!');
    }

    // Creates the optimizers which drives training of the model.
    const optimizer = tf.train.adam(LEARNING_RATE);
    // We use categoricalCrossentropy which is the loss function we use for
    // categorical classification which measures the error between our
    // predicted probability distribution over classes (probability that an
    // input is of each class), versus the label (100% probability in the true
    // class)>
    this.model.compile({optimizer, loss: 'categoricalCrossentropy'});

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
    return (await this.model.fit(
        this.features(this.dataset.xs), this.dataset.ys,
        {batchSize, epochs: EPOCHS, callbacks: this.trainCallback})).history;
  }

  predict(
      input: tf.Tensor|tf.Tensor[]|tf.NamedTensorMap,
      config?: tf.ModelPredictConfig): tf.Tensor[] {
    const predictedClass = tf.tidy(() => {
      const [features, outputs] =
          this.activation(input as tf.Tensor | tf.Tensor[]);

      // Make a prediction through our newly-trained model using the
      // activation from source model as input.
      const predictions = this.model.predict(features);

      // Returns the index with the maximum probability. This number
      // corresponds to the class the model thinks is the most probable given
      // the input.
      return [outputs, (predictions as tf.Tensor).softmax()];
    });

    return predictedClass;
  }

  execute(
      inputs: tf.Tensor<tf.Rank>|Array<tf.Tensor<tf.Rank>>|tf.NamedTensorMap,
      outputs: string|string[]): tf.Tensor<tf.Rank>|Array<tf.Tensor<tf.Rank>> {
    throw new Error('Method not implemented.');
  }
}
