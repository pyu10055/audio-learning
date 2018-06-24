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

import {CircularAudioBuffer} from './circular_audio_buffer';
import {FeatureExtractor} from './types';
// tslint:disable-next-line:max-line-length
import {BUFFER_LENGTH, DURATION, EXAMPLE_SR, HOP_LENGTH, IS_MFCC_ENABLED, MEL_COUNT, Params} from './types';

export const audioCtx = new AudioContext();
/**
 * Extracts various kinds of features from an input buffer. Designed for
 * extracting features from a live-running audio input stream.
 *
 * This class gets audio from an audio input stream, feeds it into a
 * ScriptProcessorNode, gets audio sampled at the input sample rate
 * (audioCtx.sampleRate).
 *
 * Once complete, we downsample it to EXAMPLE_SR, and then keep track of the
 * last hop index. Once we have enough data for a buffer of BUFFER_LENGTH,
 * process that buffer and add it to the spectrogram.
 */
export abstract class StreamingFeatureExtractor extends EventEmitter implements
    FeatureExtractor {
  // The length of the input buffer, used in ScriptProcessorNode.
  inputBufferLength = BUFFER_LENGTH * 4;
  // Target sample rate.
  targetSr = EXAMPLE_SR;
  // How long the buffer is.
  bufferLength = BUFFER_LENGTH;
  // How many buffers to keep in the spectrogram.
  bufferCount: number;
  // How many mel bins to use.
  melCount = MEL_COUNT;
  // Number of samples to hop over for every new column.
  hopLength = HOP_LENGTH;
  // How long the total duration is.
  duration = DURATION;
  // Whether to use MFCC or Mel features.
  isMfccEnabled = IS_MFCC_ENABLED;

  // Where to store the latest spectrogram.
  images: Float32Array[];
  // Where to store the latest spectrogram.
  spectrogram: Float32Array[];

  // Are we streaming right now?
  isStreaming: boolean;

  // The active stream.
  stream: MediaStream;

  // For dealing with a circular buffer of audio samples.
  circularBuffer: CircularAudioBuffer;

  constructor() {
    super();
  }

  protected abstract extraConfig(): void;

  config(params: Params) {
    Object.assign(this, params);

    this.bufferCount = Math.floor(
                           (this.duration * this.targetSr - this.bufferLength) /
                           this.hopLength) +
        1;

    if (this.hopLength > this.bufferLength) {
      console.error('Hop length must be smaller than buffer length.');
    }

    this.spectrogram = [];
    this.images = [];
    this.isStreaming = false;

    const nativeSr = audioCtx.sampleRate;

    // Allocate the size of the circular analysis buffer.
    const resampledBufferLength =
        Math.max(this.bufferLength, this.inputBufferLength) *
        (this.targetSr / nativeSr) * 4;
    this.circularBuffer = new CircularAudioBuffer(resampledBufferLength);

    this.extraConfig();
  }

  getFeatures() {
    return this.spectrogram;
  }

  getImages() {
    return this.images;
  }

  protected abstract setup(): void;

  protected abstract tearDown(): void;

  start() {
    // Clear all buffers.
    this.circularBuffer.clear();

    const constraints = {
      audio: true
    };
    navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints)
        .then(stream => {
          this.stream = stream;
          this.setup();
          this.isStreaming = true;
        });
  }

  stop() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
    }
    this.tearDown();
    this.isStreaming = false;
  }

  /**
   * Get as many full buffers as are available in the circular buffer.
   */
  protected getFullBuffers() {
    const out = [];
    // While we have enough data in the buffer.
    while (this.circularBuffer.getLength() > this.bufferLength) {
      // Get a buffer of desired size.
      const buffer = this.circularBuffer.getBuffer(this.bufferLength);
      // Remove a hop's worth of data from the buffer.
      this.circularBuffer.popBuffer(this.hopLength);
      out.push(buffer);
    }
    return out;
  }
}
