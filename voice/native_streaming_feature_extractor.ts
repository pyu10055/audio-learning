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

import {StreamingFeatureExtractor} from './streaming_feature_extractor';
import {AudioUtils} from './utils/audio_utils';
import {Interval, nextPowerOfTwo} from './utils/util';

export const audioCtx = new (
        // tslint:disable-next-line:no-any
        (window as any).AudioContext || (window as any).webkitAudioContext)();
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
export class NativeStreamingFeatureExtractor extends StreamingFeatureExtractor {
  // How many buffers to keep in the spectrogram.
  hopTime: number;
  // The mel filterbank (calculate it only once).
  melFilterbank: Float32Array;

  analyser: AnalyserNode;

  // tslint:disable-next-line:no-any
  timer: any;

  audioUtils = new AudioUtils();

  extraConfig() {
    this.hopTime = this.hopLength * 1000 / this.targetSr;
    this.timer = new Interval(this.hopTime, this.onAudioProcess.bind(this));
    this.melFilterbank = this.audioUtils.createMelFilterbank(
        nextPowerOfTwo(this.bufferLength) + 1, this.melCount, 20, 4000,
        this.targetSr);
  }

  setup() {
    this.analyser = audioCtx.createAnalyser();
    this.analyser.fftSize = nextPowerOfTwo(this.bufferLength);
    this.analyser.smoothingTimeConstant = 0;
    const source = audioCtx.createMediaStreamSource(this.stream);
    source.connect(this.analyser);
    // this.analyser.connect(audioCtx.destination);
    this.isStreaming = true;
    this.timer.run();
    this.onAudioProcess();
  }

  tearDown() {
    if (this.timer) {
      this.timer.stop();
    }
  }

  private onAudioProcess() {
    let buffer = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(buffer);
    buffer = buffer.map(v => Math.pow(10, v / 20));
    // const fftEnergies = AudioUtils.fftEnergies(buffer);
    const melEnergies =
        this.audioUtils.applyFilterbank(buffer, this.melFilterbank);
    const mfccs = this.audioUtils.cepstrumFromEnergySpectrum(melEnergies);

    if (this.isMfccEnabled) {
      this.spectrogram.push(mfccs);
    } else {
      this.spectrogram.push(melEnergies);
    }
    this.images.push(melEnergies);
    if (this.spectrogram.length > this.bufferCount) {
      // Remove the first element in the array.
      this.spectrogram.splice(0, 1);
      this.images.splice(0, 1);
    }
    if (this.spectrogram.length === this.bufferCount) {
      // Notify that we have an updated spectrogram.
      this.emit('update');
      this.spectrogram.splice(0, 15);
      this.images.splice(0, 15);
    }
  }
}
