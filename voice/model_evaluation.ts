import {FrozenModel, InferenceModel, loadFrozenModel, loadModel, Model, Tensor, tensor4d} from '@tensorflow/tfjs';

import {GOOGLE_CLOUD_STORAGE_DIR, MODEL_FILE_URL, TF_MODEL_FILE_URL, WEIGHT_MANIFEST_FILE_URL} from './command_recognizer';
import {OfflineFeatureExtractor} from './offline_feature_extractor';
import {normalize} from './util';

export const EVENT_NAME = 'update';
export const MIN_SCORE = 0.6;

export interface Params {
  bufferLength: number
  hopLength: number
  duration: number
  melCount: number
  targetSr: number
  isMfccEnabled: boolean
}

export interface FeatureExtractor extends EventEmitter.EventEmitter {
  config(source: OfflineAudioContext, params: Params);
  start(samples: Float32Array);
  stop();
  getFeatures(): Float32Array[];
}

export enum ModelType {
  FROZEN_MODEL = 0,
  FROZEN_MODEL_NATIVE,
  TF_MODEL
}
export class ModelEvaluation {
  // Target sample rate.
  targetSr = 44100;
  // How long the buffer is.
  bufferLength = 1024;
  // How many mel bins to use.
  melCount = 40;
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

  constructor(params: Params) {
    Object.assign(this, params);
  }

  async load() {
    this.frozenModel = await loadFrozenModel(
        GOOGLE_CLOUD_STORAGE_DIR + MODEL_FILE_URL,
        GOOGLE_CLOUD_STORAGE_DIR + WEIGHT_MANIFEST_FILE_URL);
    this.tfModel =
        await loadModel(GOOGLE_CLOUD_STORAGE_DIR + TF_MODEL_FILE_URL);
  }

  async eval(modelType: ModelType, files: File[], labels: number[]):
      Promise<number> {
    const prediction = [];
    this.featureExtractor = new OfflineFeatureExtractor();
    if (modelType === ModelType.TF_MODEL) {
      this.model = this.tfModel;
    } else {
      this.model = this.frozenModel;
    }

    for (let i = 0; i < files.length; i++) {
      const recordingFile = files[i];
      prediction.push(
          await this.evalFile(recordingFile, this.featureExtractor));
    }

    const correct = prediction.reduce((prev, curr, index) => {
      prev += (curr[0] === labels[index] && curr[1] > MIN_SCORE ? 1.0 : 0.0);
    }, 0.0);

    return correct / labels.length;
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
        extractor.config(
            this.offlineContext, this.bufferLength, this.hopLength);
        await extractor.start(new Float32Array(temporaryFileReader.result));
        resolve(this.runPrediction(extractor.getFeatures()));
      };
      temporaryFileReader.readAsArrayBuffer(file);
    });
  }

  private featuresToInput(spec: Float32Array[]): Tensor {
    // Flatten this spectrogram into a 2D array.
    const times = spec.length;
    const freqs = spec[0].length;
    const data = new Float32Array(times * freqs);
    let i = 0;
    for (let i = 0; i < times; i++) {
      const mel = spec[i];
      const offset = i * freqs;
      data.set(mel, offset);
    }
    // Normalize the whole input to be in [0, 1].
    const shape: [number, number, number, number] = [1, times, freqs, 1];
    // this.normalizeInPlace(data, 0, 1);
    return tensor4d(Array.prototype.slice.call(data), shape);
  }

  private runPrediction(dataArray: Float32Array[]): [number, number] {
    if (this.model == null) {
      throw new Error('Model is not set yet');
    }
    const unnormalized = this.featuresToInput(dataArray);
    const normalized = normalize(unnormalized);
    const predictOut = ((this.model instanceof FrozenModel ?
                             this.model.predict(normalized, {}) :
                             this.model.predict(normalized)) as Tensor)
                           .dataSync() as Float32Array;

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