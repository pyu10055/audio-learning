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
import {nextPowerOfTwo} from './utils/util';

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
export class SoftStreamingFeatureExtractor extends StreamingFeatureExtractor {
  // The mel filterbank (calculate it only once).
  melFilterbank: Float32Array;

  // The script node doing the Web Audio processing.
  scriptNode: ScriptProcessorNode;
  audioUtils = new AudioUtils();
  constructor() {
    super();
  }
  extraConfig() {
    // The mel filterbank is actually half of the size of the number of samples,
    // since the FFT array is complex valued.
    const fftSize = nextPowerOfTwo(this.bufferLength);
    this.melFilterbank =
        this.audioUtils.createMelFilterbank(fftSize / 2 + 1, this.melCount);
  }

  setup() {
    this.scriptNode =
        audioCtx.createScriptProcessor(this.inputBufferLength, 1, 1);
    const source = audioCtx.createMediaStreamSource(this.stream);
    source.connect(this.scriptNode);
    this.scriptNode.connect(audioCtx.destination);

    this.scriptNode.onaudioprocess = this.onAudioProcess.bind(this);
  }

  tearDown() {
    if (this.scriptNode) {
      this.scriptNode.disconnect(audioCtx.destination);
    }
    this.scriptNode = null;
    this.stream = null;
  }

  private async onAudioProcess(audioProcessingEvent: AudioProcessingEvent) {
    // console.log(this.spectrogram.length);
    const audioBuffer = audioProcessingEvent.inputBuffer;

    // Resample the buffer into targetSr.
    // console.log(`Resampling from ${audioCtx.sampleRate} to
    // ${this.targetSr}.`);
    const audioBufferRes =
        await this.audioUtils.resampleWebAudio(audioBuffer, this.targetSr);
    const bufferRes = audioBufferRes.getChannelData(0);
    // Write in a buffer of ~700 samples.
    this.circularBuffer.addBuffer(bufferRes);

    // Get buffer(s) out of the circular buffer. Note that there may be multiple
    // available, and if there are, we should get them all.
    const buffers = this.getFullBuffers();
    if (buffers.length > 0) {
      // console.log(`Got ${buffers.length} buffers of audio input data.`);
    }

    for (const buffer of buffers) {
      const fft = this.audioUtils.fft(buffer);
      const fftEnergies = this.audioUtils.fftEnergies(fft);
      const melEnergies =
          this.audioUtils.applyFilterbank(fftEnergies, this.melFilterbank);
      this.images.push(melEnergies);
      const mfccs = this.audioUtils.cepstrumFromEnergySpectrum(melEnergies);

      if (this.isMfccEnabled) {
        this.spectrogram.push(mfccs);
      } else {
        this.spectrogram.push(melEnergies);
      }
      if (this.spectrogram.length > this.bufferCount) {
        // Remove the first element in the array.
        this.spectrogram.splice(0, 1);
        this.images.splice(0, 1);
      }
      if (this.spectrogram.length === this.bufferCount) {
        // Notify that we have an updated spectrogram.
        this.emit('update');
        this.spectrogram.splice(0, 20);
        this.images.splice(0, 20);
      }
    }
  }
}
