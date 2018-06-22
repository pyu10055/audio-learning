// tslint:disable-next-line:max-line-length
import {FrozenModel, loadFrozenModel, loadModel, Model, Tensor, tensor4d} from '@tensorflow/tfjs';

// tslint:disable-next-line:max-line-length
import {GOOGLE_CLOUD_STORAGE_DIR, MODEL_FILE_URL, TF_MODEL_FILE_URL, WEIGHT_MANIFEST_FILE_URL} from './command_recognizer';
// tslint:disable-next-line:max-line-length
import {NativeOfflineFeatureExtractor} from './native_offline_feature_extractor';
import {OfflineFeatureExtractor} from './offline_feature_extractor';
// tslint:disable-next-line:max-line-length
import {SoftOfflineFeatureExtractor} from './soft_offline_feature_extractor';
import {FeatureExtractor, MODELS, ModelType, Params} from './types';
import {normalize, plotSpectrogram} from './util';

export const EVENT_NAME = 'update';
export const MIN_SCORE = 0.6;

export class ModelEvaluation {
  // Target sample rate.
  targetSr = 44100;
  // How long the buffer is.
  bufferLength = 1024;
  // How many mel bins to use.
  melCount = 360;
  // Number of samples to hop over for every new column.
  hopLength = 1024;
  // How long the total duration is.
  duration = 1.0;
  // Whether to use MFCC or Mel features.
  isMfccEnabled = true;
  private frozenModel: FrozenModel;
  private tfModel: Model;

  private model: FrozenModel|Model;
  private featureExtractor: FeatureExtractor;

  constructor(private canvas: HTMLCanvasElement, params: Params) {
    Object.assign(this, params);
  }

  async load() {
    this.frozenModel = await loadFrozenModel(
        GOOGLE_CLOUD_STORAGE_DIR + MODEL_FILE_URL,
        GOOGLE_CLOUD_STORAGE_DIR + WEIGHT_MANIFEST_FILE_URL);
    this.tfModel =
        await loadModel(GOOGLE_CLOUD_STORAGE_DIR + TF_MODEL_FILE_URL);
    MODELS[ModelType.FROZEN_MODEL] = this.frozenModel;
    MODELS[ModelType.TF_MODEL] = this.tfModel;
    MODELS[ModelType.FROZEN_MODEL_NATIVE] = this.frozenModel;
  }

  async eval(modelType: ModelType, files: File[], labels: number[]):
      Promise<Array<[number, number]>> {
    const prediction = [];
    switch (modelType) {
      case ModelType.TF_MODEL:
        this.model = this.tfModel;
        this.featureExtractor = new OfflineFeatureExtractor();
        break;
      case ModelType.FROZEN_MODEL:
        this.model = this.frozenModel;
        this.featureExtractor = new SoftOfflineFeatureExtractor();
        break;
      default:
        this.model = this.frozenModel;
        this.featureExtractor = new NativeOfflineFeatureExtractor();
    }

    for (let i = 0; i < files.length; i++) {
      const recordingFile = files[i];
      prediction.push(
          await this.evalFile(recordingFile, this.featureExtractor));
    }

    plotSpectrogram(this.canvas, this.featureExtractor.getImages());
    const correct = prediction.reduce((prev, curr, index) => {
      prev += (curr[0] === labels[index] && curr[1] > MIN_SCORE ? 1.0 : 0.0);
      return prev;
    }, 0.0);

    console.log('correctly predicted: ', correct);
    return prediction;
  }

  private evalFile(file: File, extractor: FeatureExtractor):
      Promise<[number, number]> {
    const temporaryFileReader = new FileReader();
    return new Promise((resolve, reject) => {
      temporaryFileReader.onerror = () => {
        temporaryFileReader.abort();
        reject(new DOMException('Problem parsing input file.'));
      };

      temporaryFileReader.onload = async () => {
        extractor.config({});
        let success = false;
        for (let i = 0; i < 10 && !success; i++) try {
            await extractor.start(new Float32Array(temporaryFileReader.result));
            extractor.stop();
            success = true;
          } catch (error) {
            extractor.stop();
            console.log('retry file ' + file.name);
          }
        resolve(this.runPrediction(extractor.getFeatures()));
      };
      temporaryFileReader.readAsArrayBuffer(file);
    });
  }

  private featuresToInput(spec: Float32Array[]): Tensor {
    const times = spec.length;
    const freqs = spec[0].length;
    const data = new Float32Array(times * freqs);
    for (let i = 0; i < times; i++) {
      const mel = spec[i];
      const offset = i * freqs;
      data.set(mel, offset);
    }
    const shape: [number, number, number, number] = [1, times, freqs, 1];
    return tensor4d(data, shape);
  }

  private runPrediction(dataArray: Float32Array[]): [number, number] {
    if (this.model == null) {
      throw new Error('Model is not set yet');
    }
    dataArray.forEach((array, i) => {
      array.forEach((v, index) => {
        if (v === -Infinity) console.log(i, index);
      });
    });
    const unnormalized = this.featuresToInput(dataArray);
    const normalized = normalize(unnormalized);
    let predictOutTensor: Tensor;
    if (this.model instanceof FrozenModel) {
      predictOutTensor = this.model.predict(unnormalized) as Tensor;
    } else {
      predictOutTensor = this.model.predict(normalized) as Tensor;
    }
    const predictOut = predictOutTensor.dataSync() as Float32Array;
    predictOutTensor.dispose();

    console.log(predictOut);
    let maxScore = -Infinity;
    let winnerIndex = -1;
    predictOut.forEach((score, index) => {
      if (score > maxScore) {
        maxScore = score;
        winnerIndex = index;
      }
    });
    return [winnerIndex, maxScore];
  }
}
