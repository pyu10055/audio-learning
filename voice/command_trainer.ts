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
import {nextFrame} from '@tensorflow/tfjs-core';
import {EventEmitter} from 'eventemitter3';

// tslint:disable-next-line:max-line-length
import {GOOGLE_CLOUD_STORAGE_DIR, melSpectrogramToInput, MODEL_FILE_URL, WEIGHT_MANIFEST_FILE_URL} from './command_recognizer';
import {Dataset} from './dataset';
import {SoftStreamingFeatureExtractor} from './soft_streaming_feature_extractor';
import {StreamingFeatureExtractor} from './streaming_feature_extractor';
import {TransferModel} from './transfer_model';
// tslint:disable-next-line:max-line-length
import {IS_MFCC_ENABLED} from './types';
import {plotSpectrogram} from './util';

export class CommandTrainer extends EventEmitter {
  model: FrozenModel;
  transferModel: TransferModel;
  streamFeature: StreamingFeatureExtractor;
  dataset: Dataset;
  label: number;
  trained = false;
  withData = false;
  constructor(private canvas: HTMLCanvasElement) {
    super();

    this.streamFeature = new SoftStreamingFeatureExtractor();
    this.streamFeature.config({
      inputBufferLength: 2048,
      bufferLength: 480,
      hopLength: 160,
      melCount: 40,
      targetSr: 16000,
      duration: 1,
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
        [{
          model: this.model,
          bottleneck: 'add_2',
          bottleneckShape: [12],
          output: 'labels_softmax'
        }],
        this.dataset, {
          onBatchEnd: async (batch, logs) => {
            this.emit('loss', logs.loss.toFixed(5));
            await nextFrame();
          }
        });
  }

  record(label: number) {
    this.label = label;
    setTimeout(this.streamFeature.start.bind(this.streamFeature), 250);
    setTimeout(this.stopRecord.bind(this), 1500);
    this.withData = true;
  }

  async train() {
    let loss = Number.MAX_SAFE_INTEGER;
    let count = 0;
    while (loss > 0.002 && count < 10) {
      loss = (await this.transferModel.train()).loss.pop() as number;
      count += 1;
    }
    this.trained = true;
  }

  stopRecord() {
    this.streamFeature.stop();
    this.emit('recorded', this.dataset);
  }

  private addSamples() {
    const spec = this.streamFeature.getFeatures();
    plotSpectrogram(this.canvas, this.streamFeature.getImages());
    const input = melSpectrogramToInput(spec);
    this.dataset.addExample(input, this.label);
  }
}
