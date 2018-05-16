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

import {EventEmitter} from 'eventemitter3';
import FeatureExtractor, {BUFFER_LENGTH, EXAMPLE_SR, HOP_LENGTH, MEL_COUNT,
  IS_MFCC_ENABLED, DURATION} from './FeatureExtractor';
import StreamingFeatureExtractor
    from './StreamingFeatureExtractor';
import {labelArrayToString, argmax} from './util';
import { FrozenModel, loadFrozenModel } from '@tensorflow/tfjs-converter';
import { Tensor1D } from '@tensorflow/tfjs-core';

const GOOGLE_CLOUD_STORAGE_DIR =
    'https://storage.googleapis.com/tfjs-models/savedmodel/';
const MODEL_FILE_URL = 'voice/tensorflowjs_model.pb';
const WEIGHT_MANIFEST_FILE_URL = 'voice/weights_manifest.json';

interface Prediction {
  label: string
  labelArray: Float32Array
  score: number
}

interface RecognizerParams {
  scoreT: number
  commands: string[]
  noOther?: boolean
}


export default class CommandRecognizer extends EventEmitter {
  model: FrozenModel
  streamFeature: StreamingFeatureExtractor
  predictionHistory: Prediction[]

  predictionCount: number
  scoreT: number
  commands: string[]
  nonCommands: string[]
  modelUrl: string

  allLabels: string[]
  lastCommand: string
  lastAverageLabelArray: Float32Array

  constructor(params: RecognizerParams) {
    super();
    const {scoreT, commands, noOther} = params;

    this.scoreT = scoreT;
    this.commands = commands;
    this.nonCommands = ['_silence_', '_unknown_'];

    this.allLabels = commands.concat(this.nonCommands);

    // Calculate how many predictions we want to track based on prediction
    // window time, sample rate and hop size.
    const predsPerSecond = DURATION * EXAMPLE_SR / HOP_LENGTH;
    this.predictionCount = Math.floor(predsPerSecond);
    console.log(`CommandRecognizer will use a history window` +
      ` of ${this.predictionCount}.`);

    const inputShape = FeatureExtractor.getFeatureShape();
    const labelShape = [this.allLabels.length];

    this.streamFeature = new StreamingFeatureExtractor({
      inputBufferLength: 4096,
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

  async load() {
    this.model = await loadFrozenModel(
        GOOGLE_CLOUD_STORAGE_DIR + MODEL_FILE_URL,
        GOOGLE_CLOUD_STORAGE_DIR + WEIGHT_MANIFEST_FILE_URL);
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

  getMicrophoneInputLevel() {
    const energyLevel = this.streamFeature.getEnergyLevel();
    if (!energyLevel) {
      return 0;
    }
    const energyMin = -2;
    const energyMax = 10;
    const percent = Math.max(0, (energyLevel - energyMin) / (energyMax - energyMin));
    return percent;
  }

  /**
   * Returns the latest confidence level for a given command.
   */
  getConfidenceLevel(command: string) {
    const ind = this.allLabels.indexOf(command);
    if (ind == -1) {
      console.error(`Attempting to get confidence level for unknown command ${command}.`);
      return;
    }
    if (!this.lastAverageLabelArray) {
      return null;
    }
    const maxScore = 10;
    const minScore = -3;
    const score = this.lastAverageLabelArray[ind];
    if (!score) {
      return null;
    }
    return Math.max(0, (score - minScore) / (maxScore - minScore));
  }

  getAllLabels() {
    return this.allLabels;
  }

  getCommands() {
    return this.commands;
  }

  private onUpdate() {
    const spec = this.streamFeature.getSpectrogram();
    const input = FeatureExtractor.melSpectrogramToInput(spec);
    const pred = (this.model.execute({'wav_data': input}) as Tensor1D).dataSync() as Float32Array;
    const predLabel = labelArrayToString(pred, this.allLabels);
    const [ind, score] = argmax(pred);

    //console.log(`Got prediction: ${predLabel} with score ${score}.`);

    this.predictionHistory.push({
      label: predLabel,
      labelArray: pred,
      score: score
    });

    if (this.predictionHistory.length > this.predictionCount) {
      this.evaluatePredictions2();
      // Keep the prediction list short.
      this.predictionHistory.splice(0, 1);
      // Keep track of the latest average array over the whole window.
      this.lastAverageLabelArray = this.getAverageLabelArray();
    }
  }

  private evaluatePredictions2() {
    // Get the most common label in the window, and then get the average score.
    const labels = this.predictionHistory.map(item => item.label);
    const topLabel = this.mode(labels);
    const topLabelScores = this.predictionHistory
      .filter(item => (item.label == topLabel)).map(item => item.score);
    const averageScore = mean(topLabelScores);
    //console.log(`Top label: ${topLabel}, score: ${averageScore}.`);

    this.emitCommand(topLabel, averageScore);
  }

  private mode(array: string[]) {
    let freq = {};
    for (let item of array) {
      if (!freq[item]) {
        freq[item] = 1;
      } else {
        freq[item] += 1;
      }
    }
    const keys = Object.keys(freq);
    keys.sort((a, b) => (+freq[b][1] - +freq[a][1]));
    return keys[0];
  }

  /**
   * Gets the average label array for the whole window.
   */
  private getAverageLabelArray() {
    const arrays = this.predictionHistory.map(item => item.labelArray);
    const totalArray = pointwiseSumArrays(arrays);
    return totalArray.map(val => val / arrays.length);
  }


  private emitCommand(command: string, score: number) {
    if (this.lastCommand == command) {
      // Don't emit anything if the command hasn't changed.
      return;
    }

    if (!this.nonCommands.includes(command)) {
      this.emit('command', command, score);
      // If emitting a command, history should be cleared.
      this.predictionHistory = [];
      console.log(`Detected command ${command} with score: ${score}.`);
    } else {
      this.emit('silence');
    }
    this.lastCommand = command;
  }
}

function mean(array: number[]) {
  const sum = array.reduce((a, b) => a + b, 0);
  return sum / array.length;
}

function pointwiseSumArrays(arrays: Float32Array[]) {
  if (!arrays.length) {
    return new Float32Array(0);
  }
  const out = new Float32Array(arrays[0].length);
  out.fill(0);
  for (let array of arrays) {
    for (let i = 0; i < out.length; i++) {
      out[i] += array[i];
    }
  }
  return out;
}
