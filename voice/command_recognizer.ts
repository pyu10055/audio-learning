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

import {FrozenModel, loadFrozenModel} from '@tensorflow/tfjs-converter';
import {Tensor, Tensor1D, tensor3d, InferenceModel} from '@tensorflow/tfjs-core';
import {EventEmitter} from 'eventemitter3';

import StreamingFeatureExtractor from './streaming_feature_extractor';
import {argmax, labelArrayToString} from './util';

export const GOOGLE_CLOUD_STORAGE_DIR =
    'https://storage.googleapis.com/tfjs-models/savedmodel/';
export const MODEL_FILE_URL = 'voice/tensorflowjs_model.pb';
export const WEIGHT_MANIFEST_FILE_URL = 'voice/weights_manifest.json';

export const BUFFER_LENGTH = 480;
export const HOP_LENGTH = 160;
export const MEL_COUNT = 40;
export const EXAMPLE_SR = 16000;
export const DURATION = 1.0;
export const IS_MFCC_ENABLED = true;
export const MIN_SAMPLE = 3;
export const DETECTION_THRESHOLD = 0.4;
export const SUPPRESSION_TIME = 500;

export interface Prediction {
  time: number;
  scores: Float32Array;
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
  let i = 0;
  for (let i = 0; i < times; i++) {
    const mel = spec[i];
    const offset = i * freqs;
    data.set(mel, offset);
  }
  // Normalize the whole input to be in [0, 1].
  const shape: [number, number, number] = [times, freqs, 1];
  // this.normalizeInPlace(data, 0, 1);
  return tensor3d(Array.prototype.slice.call(data), shape);
}

export default class CommandRecognizer extends EventEmitter {
  model: InferenceModel;
  streamFeature: StreamingFeatureExtractor;
  predictionHistory: Prediction[];

  predictionCount: number;
  scoreT: number;
  commands: string[];
  nonCommands: string[];
  modelUrl: string;

  allLabels: string[];
  lastCommand: string;
  lastCommandTime: number = Number.MIN_SAFE_INTEGER;
  lastAverageLabelArray: Float32Array;
  threshold: number;

  constructor(params: RecognizerParams) {
    super();
    const {scoreT, commands, noOther, model} = params;

    this.scoreT = scoreT;
    this.commands = commands;
    this.nonCommands = ['_silence_', '_unknown_'];
    this.model = model;
    this.threshold = params.threshold;

    this.allLabels = commands;

    // Calculate how many predictions we want to track based on prediction
    // window time, sample rate and hop size.
    const predsPerSecond = DURATION * EXAMPLE_SR / HOP_LENGTH;
    this.predictionCount = Math.floor(predsPerSecond);
    console.log(
        `CommandRecognizer will use a history window` +
        ` of ${this.predictionCount}.`);

    const inputShape = getFeatureShape();
    const labelShape = [this.allLabels.length];

    this.streamFeature = new StreamingFeatureExtractor({
      inputBufferLength: 2048,
      bufferLength: BUFFER_LENGTH,
      hopLength: HOP_LENGTH,
      melCount: MEL_COUNT,
      targetSr: EXAMPLE_SR,
      duration: DURATION,
      isMfccEnabled: IS_MFCC_ENABLED,
    });

    this.streamFeature.on('update', this.onUpdate.bind(this));

    this.predictionHistory = [];
    this.lastCommand = null;
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
    const spec = this.streamFeature.getSpectrogram();
    const input = melSpectrogramToInput(spec);
    const pred =
        (this.model.predict([input], {}) as Tensor1D).dataSync() as
        Float32Array;

    console.log(pred);
    const currentTime = new Date().getTime();
    this.predictionHistory.push({
      time: currentTime,
      scores: pred,
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
    console.log(sortedScore[0]); 

    // See if the latest top score is enough to trigger a detection.
    const currentTopIndex = sortedScore[0][0];
    const currentTopLabel = this.allLabels[currentTopIndex];
    const currentTopScore = sortedScore[0][1];
    // If we've recently had another label trigger, assume one that occurs too
    // soon afterwards is a bad result.
    let timeSinceLast = (this.lastCommand == '_silence_') ||
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
    if (!this.nonCommands.includes(command)) {
      this.emit('command', command, score);
      console.log(`Detected command ${command} with score: ${score}.`);
    } else {
      this.emit('silence');
    }
    this.lastCommandTime = time;
    this.lastCommand = command;
  }
}
