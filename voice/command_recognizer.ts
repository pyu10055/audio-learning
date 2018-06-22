/**
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

// tslint:disable-next-line:max-line-length
import {InferenceModel, Tensor, Tensor1D, tensor4d} from '@tensorflow/tfjs-core';
import {EventEmitter} from 'eventemitter3';

// tslint:disable-next-line:max-line-length
import {LayerStreamingFeatureExtractor} from './layer_streaming_feature_extractor';
// tslint:disable-next-line:max-line-length
import {NativeStreamingFeatureExtractor} from './native_streaming_feature_extractor';
// tslint:disable-next-line:max-line-length
import {SoftStreamingFeatureExtractor} from './soft_streaming_feature_extractor';
import {StreamingFeatureExtractor} from './streaming_feature_extractor';
// import {StreamingFFT} from './streaming_fft';
// tslint:disable-next-line:max-line-length
import {BUFFER_LENGTH, DURATION, EXAMPLE_SR, HOP_LENGTH, IS_MFCC_ENABLED, MEL_COUNT, MIN_SAMPLE, MODELS, ModelType, SUPPRESSION_TIME} from './types';
import {normalize, plotSpectrogram} from './util';

export const GOOGLE_CLOUD_STORAGE_DIR =
    'https://storage.googleapis.com/tfjs-models/savedmodel/';
export const MODEL_FILE_URL = 'voice/tensorflowjs_model.pb';
export const TF_MODEL_FILE_URL = 'voice2/model.json';
export const WEIGHT_MANIFEST_FILE_URL = 'voice/weights_manifest.json';

export interface Prediction {
  time: number;
  scores: number[];
}

export interface RecognizerParams {
  scoreT: number;
  commands: string[];
  noOther?: boolean;
  model: InferenceModel;
  threshold: number;
}

export function getFeatureShape() {
  const times =
      Math.floor((DURATION * EXAMPLE_SR - BUFFER_LENGTH) / HOP_LENGTH) + 1;

  return [times, MEL_COUNT, 1];
}

export function melSpectrogramToInput(spec: Float32Array[]): Tensor {
  // Flatten this spectrogram into a 2D array.
  const times = spec.length;
  const freqs = spec[0].length;
  const data = new Float32Array(times * freqs);
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

export class CommandRecognizer extends EventEmitter {
  model: InferenceModel;
  streamFeature: StreamingFeatureExtractor;
  softFFT: SoftStreamingFeatureExtractor;
  nativeFFT: NativeStreamingFeatureExtractor;
  layerFFT: LayerStreamingFeatureExtractor;
  predictionHistory: Prediction[];

  predictionCount: number;
  scoreT: number;
  commands: string[];
  nonCommands: string[];

  allLabels: string[];
  lastCommand: string;
  lastCommandTime: number = Number.MIN_SAFE_INTEGER;
  lastAverageLabelArray: Float32Array;
  threshold: number;
  modelType: ModelType;

  constructor(private canvas: HTMLCanvasElement, params: RecognizerParams) {
    super();
    Object.assign(this, params);

    this.nonCommands = ['_silence_', '_unknown_'];
    this.threshold = params.threshold;

    this.allLabels = this.commands;

    // Calculate how many predictions we want to track based on prediction
    // window time, sample rate and hop size.
    const predsPerSecond = DURATION * EXAMPLE_SR / HOP_LENGTH;
    this.predictionCount = Math.floor(predsPerSecond);
    console.log(
        `CommandRecognizer will use a history window` +
        ` of ${this.predictionCount}.`);

    this.nativeFFT = new NativeStreamingFeatureExtractor();
    this.nativeFFT.config({
      inputBufferLength: 2048,
      bufferLength: 1024,
      hopLength: 444,
      melCount: 40,
      targetSr: 44100,
      duration: 1,
      isMfccEnabled: IS_MFCC_ENABLED,
    });
    this.nativeFFT.on('update', this.onUpdate.bind(this));

    this.softFFT = new SoftStreamingFeatureExtractor();
    this.softFFT.config({
      melCount: 40,
      bufferLength: 480,
      hopLength: 160,
      targetSr: 16000,
      isMfccEnabled: IS_MFCC_ENABLED,
      duration: 1
    });
    this.softFFT.on('update', this.onUpdate.bind(this));

    this.layerFFT = new LayerStreamingFeatureExtractor();
    this.layerFFT.config({
      melCount: 40,
      bufferLength: 1024,
      hopLength: 1024,
      targetSr: 44100,
      isMfccEnabled: false,
      duration: 1
    });
    this.layerFFT.on('update', this.onUpdate.bind(this));

    this.streamFeature = this.softFFT;

    this.predictionHistory = [];
    this.lastCommand = null;
  }

  setModelType(modelType: ModelType, commands: string[]) {
    this.modelType = modelType;
    this.commands = commands;
    this.allLabels = commands;
    this.model = MODELS[modelType];
    switch (modelType) {
      case ModelType.FROZEN_MODEL:
        this.streamFeature = this.softFFT;
        break;
      case ModelType.FROZEN_MODEL_NATIVE:
        this.streamFeature = this.nativeFFT;
        break;
      default:
        this.streamFeature = this.layerFFT;
    }
  }

  start() {
    this.streamFeature.start();
  }

  stop() {
    this.streamFeature.stop();
  }

  isRunning() {
    return this.streamFeature.isStreaming;
  }

  getAllLabels() {
    return this.allLabels;
  }

  getCommands() {
    return this.commands;
  }

  private onUpdate() {
    const spec = this.streamFeature.getFeatures();
    plotSpectrogram(this.canvas, this.streamFeature.getImages());
    let input = melSpectrogramToInput(spec);
    if (this.modelType === ModelType.TF_MODEL) {
      input = normalize(input);
    }
    console.time('prediction');
    const preds = this.model.predict(input, {});
    let scores = [];
    if (Array.isArray(preds)) {
      const output = preds[0].dataSync();
      scores = [
        output[0],
        ...Array.prototype.slice.call((preds[1] as Tensor1D).dataSync())
      ];
    } else {
      scores = Array.prototype.slice.call((preds as Tensor1D).dataSync());
    }
    console.timeEnd('prediction');
    const currentTime = new Date().getTime();
    this.predictionHistory.push({
      time: currentTime,
      scores,
    });

    // Prune any earlier results that are too old for the averaging window.
    const timeLimit = currentTime - DURATION * 1000;
    while (this.predictionHistory[0].time < timeLimit) {
      this.predictionHistory.shift();
    }

    // If there are too few results, assume the result will be unreliable and
    // bail.
    const count = this.predictionHistory.length;
    const earliestTime = this.predictionHistory[0].time;
    const samplesDuration = currentTime - earliestTime;
    if ((count < MIN_SAMPLE) || (samplesDuration < (DURATION / 4))) {
      return;
    }

    // Calculate the average score across all the results in the window.
    const averageScores = new Array(this.allLabels.length).fill(0);
    this.predictionHistory.forEach(pred => {
      const scores = pred.scores;
      for (let i = 0; i < scores.length; ++i) {
        averageScores[i] += scores[i] / this.predictionHistory.length;
      }
    });

    console.log(this.predictionHistory.length);
    const sortedScore =
        averageScores.map((a, i) => [i, a]).sort((a, b) => b[1] - a[1]);
    console.log(sortedScore[0], sortedScore[1]);

    // See if the latest top score is enough to trigger a detection.
    const currentTopIndex = sortedScore[0][0];
    const currentTopLabel = this.allLabels[currentTopIndex];
    const currentTopScore = sortedScore[0][1];
    // If we've recently had another label trigger, assume one that occurs too
    // soon afterwards is a bad result.
    const timeSinceLast = (this.lastCommand === '_silence_') ||
            (this.lastCommandTime === Number.MIN_SAFE_INTEGER) ?
        Number.MAX_SAFE_INTEGER :
        currentTime - this.lastCommandTime;
    if ((currentTopScore > this.threshold) &&
        (currentTopLabel !== this.lastCommand) &&
        (timeSinceLast > SUPPRESSION_TIME)) {
      this.emitCommand(currentTopLabel, currentTopScore, currentTime);
    }
  }

  private emitCommand(command: string, score: number, time: number) {
    if (this.nonCommands.indexOf(command) === -1) {
      this.emit('command', command, score);
      console.log(`Detected command ${command} with score: ${score}.`);
    } else {
      this.emit('silence');
    }
    this.lastCommandTime = time;
    this.lastCommand = command;
  }
}
