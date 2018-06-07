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
import {nextFrame, Tensor, Tensor1D, tensor3d} from '@tensorflow/tfjs-core';
import {EventEmitter} from 'eventemitter3';

import {BUFFER_LENGTH, DETECTION_THRESHOLD, DURATION, EXAMPLE_SR, getFeatureShape, GOOGLE_CLOUD_STORAGE_DIR, HOP_LENGTH, IS_MFCC_ENABLED, MEL_COUNT, melSpectrogramToInput, MIN_SAMPLE, MODEL_FILE_URL, Prediction, RecognizerParams, SUPPRESSION_TIME, WEIGHT_MANIFEST_FILE_URL} from './command_recognizer';
import {Dataset} from './dataset';
import StreamingFFT from './streaming_fft';
import {TransferModel} from './transfer_model';
import {argmax, labelArrayToString} from './util';

export default class CommandTrainer extends EventEmitter {
  model: FrozenModel;
  transferModel: TransferModel;
  streamFeature: StreamingFFT;
  dataset: Dataset;
  label: number;
  trained = false;
  withData = false;
  constructor() {
    super();

    const inputShape = getFeatureShape();

    this.streamFeature = new StreamingFFT({
      inputBufferLength: 2048,
      bufferLength: BUFFER_LENGTH,
      hopLength: HOP_LENGTH,
      melCount: MEL_COUNT,
      targetSr: EXAMPLE_SR,
      duration: DURATION,
      isMfccEnabled: IS_MFCC_ENABLED,
    });
    this.streamFeature.on('update', this.addSamples.bind(this));
    this.dataset = new Dataset(4);
  }

  async load() {
    this.model = await loadFrozenModel(
        GOOGLE_CLOUD_STORAGE_DIR + MODEL_FILE_URL,
        GOOGLE_CLOUD_STORAGE_DIR + WEIGHT_MANIFEST_FILE_URL);
    this.transferModel = new TransferModel(
        [{model: this.model, bottleneck: 'add_2', bottleneckShape: [12], output: 'labels_softmax'}],
        this.dataset, {
          onBatchEnd: async (batch, logs) => {
            this.emit('loss', logs.loss.toFixed(5));
            await nextFrame();
          }
        });
  }

  record(label: number) {
    this.label = label;
    this.streamFeature.start();
    setTimeout(this.stopRecord.bind(this), 1000);
    this.withData = true;
  }

  async train() {
    let loss = Number.MAX_SAFE_INTEGER;
    let count = 0;
    while (loss > 0.002 && count < 10) {
      loss = (await this.transferModel.train()).history.loss.pop() as number;
      count += 1;
    }
    this.trained = true;
  }

  stopRecord() {
    this.streamFeature.stop();
    this.emit('recorded', this.dataset);
  }

  private addSamples() {
    const spec = this.streamFeature.getSpectrogram();
    const input = melSpectrogramToInput(spec);
    this.dataset.addExample(input, this.label);
  }
}
