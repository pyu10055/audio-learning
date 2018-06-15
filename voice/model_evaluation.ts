import {InferenceModel, Model, Tensor, tensor4d} from '@tensorflow/tfjs';

import {normalize} from './util';

export const EVENT_NAME = 'update';

export interface Params {
  bufferLength: number
  hopLength: number
  duration: number
  melCount: number
  targetSr: number
  isMfccEnabled: boolean
}

export interface FeatureExtractor extends EventEmitter.EventEmitter {
  config(source: OfflineAudioContext, bufferLength: number, hopLength: number);
  start(samples: Float32Array);
  stop();
  getFeatures(): Float32Array[];
}

export enum ModelType {
  FROZEN_MODEL = 0,
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
  hopLength = 444;
  // How long the total duration is.
  duration = 1.0;
  // Whether to use MFCC or Mel features.
  isMfccEnabled = true;
  private frozenModel: InferenceModel;
  private tfModel: InferenceModel;

  private offlineContext: OfflineAudioContext;
  private reader = new FileReader();
  private model: InferenceModel;

  constructor(private files: File[], private labels: number[], params: Params) {
    Object.assign(this, params);
    this.offlineContext = new OfflineAudioContext(
        1, this.targetSr * this.duration * 4, this.targetSr);
  }

  async load() {
    this.frozenModel = await loadFrozenModel(
        GOOGLE_CLOUD_STORAGE_DIR + MODEL_FILE_URL,
        GOOGLE_CLOUD_STORAGE_DIR + WEIGHT_MANIFEST_FILE_URL);
    this.tfModel =
        await Model.loadModels(GOOGLE_CLOUD_STORAGE_DIR + TF_MODEL_FILE_URL);
  }

  async eval(modelType: ModelType, extractor: FeatureExtractor): number {
    this.model =
        modelType === ModelType.FROZEN_MODEL ? this.frozenModel : this.tfModel;
    this.reader.onloadend = async () => {
      extractor.config(this.offlineContext, this.bufferLength, this.hopLength);
      await extractor.start(this.reader.result);
      if (this.model != null) {
        this.runPrediction(extractor.getFeatures());
      }
      this.offlineContext.startRendering().catch(err => {
        console.log('Failed to render offline audio context:', err);
      });
    };

    for (let i = 0; i < this.files.length; i++) {
      const recordingFile = this.files[i];
      this.reader.readAsArrayBuffer(recordingFile);
    }
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

  private runPrediction(dataArray: Float32Array[]) {
    if (this.model == null) {
      throw new Error('Model is not set yet');
    }
    const unnormalized = this.featuresToInput(dataArray);
    const normalized = normalize(unnormalized);
    const predictOut =
        (this.model.predict(normalized, {}) as Tensor).dataSync() as
        Float32Array;

    let maxScore = -Infinity;
    let winnerIndex = -1;
    predictOut.forEach((score, index) => {
      if (score > maxScore) {
        maxScore = score;
        winnerIndex = index;
      }
    });
    return winnerIndex;
  }
}