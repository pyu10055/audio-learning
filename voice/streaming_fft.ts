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

import {AudioUtils} from './audio_utils';
import {CircularAudioBuffer} from './circular_audio_buffer';
import {Params} from './types';
import {Interval} from './util';

const INPUT_BUFFER_LENGTH = 16384;

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
export class StreamingFFT extends EventEmitter {
  // The length of the input buffer, used in ScriptProcessorNode.
  inputBufferLength: number;
  // Target sample rate.
  targetSr: number;
  // How long the buffer is.
  bufferLength: number;
  bufferCount: number;
  // How many buffers to keep in the spectrogram.
  hopTime: number;
  // How many mel bins to use.
  melCount: number;
  // Number of samples to hop over for every new column.
  hopLength: number;
  // How long the total duration is.
  duration: number;
  // Whether to use MFCC or Mel features.
  isMfccEnabled: boolean;

  // Where to store the latest spectrogram.
  spectrogram: Float32Array[];
  // The mel filterbank (calculate it only once).
  melFilterbank: Float32Array;

  // Are we streaming right now?
  isStreaming: boolean;

  analyser: AnalyserNode;
  // The active stream.
  stream: MediaStream;

  // For dealing with a circular buffer of audio samples.
  circularBuffer: CircularAudioBuffer;

  // Time when the streaming began. This is used to check whether
  // ScriptProcessorNode has dropped samples.
  processStartTime: Date;

  // Number of samples we've encountered in our ScriptProcessorNode
  // onAudioProcess.
  processSampleCount: number;

  // tslint:disable-next-line:no-any
  timer: any;

  constructor(params: Params) {
    super();

    const {
      bufferLength,
      duration,
      hopLength,
      isMfccEnabled,
      melCount,
      targetSr,
      inputBufferLength
    } = params;
    this.bufferLength = bufferLength;
    this.inputBufferLength = inputBufferLength || INPUT_BUFFER_LENGTH;
    this.hopLength = hopLength;
    this.melCount = melCount;
    this.isMfccEnabled = isMfccEnabled;
    this.targetSr = targetSr;
    this.duration = duration;
    this.hopTime = this.hopLength * 1000 / this.targetSr;
    this.timer = new Interval(this.hopTime, this.onAudioProcess.bind(this));
    this.bufferCount =
        Math.floor((duration * targetSr - bufferLength) / hopLength) + 1;
    this.melFilterbank = AudioUtils.createMelFilterbank(
        this.nextPowerOfTwo(this.bufferLength) / 2 + 1, this.melCount, 20, 4000,
        this.targetSr);
    if (hopLength > bufferLength) {
      console.error('Hop length must be smaller than buffer length.');
    }

    this.spectrogram = [];
    this.isStreaming = false;
  }

  private nextPowerOfTwo(value: number) {
    const exponent = Math.ceil(Math.log2(value));
    return 1 << exponent;
  }

  getSpectrogram() {
    return this.spectrogram;
  }

  start() {
    const constraints = {
      audio: {
        'mandatory': {
          'googEchoCancellation': 'false',
          'googAutoGainControl': 'false',
          'googNoiseSuppression': 'false',
          'googHighpassFilter': 'false'
        },
      },
      video: false
    };
    navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints)
        .then(stream => {
          this.stream = stream;
          this.analyser = audioCtx.createAnalyser();
          this.analyser.fftSize = this.nextPowerOfTwo(this.bufferLength);
          this.analyser.smoothingTimeConstant = 0;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(this.analyser);
          // this.analyser.connect(audioCtx.destination);
          this.isStreaming = true;
          this.timer.run();
          this.onAudioProcess();
        });
  }

  stop() {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
    }
    this.isStreaming = false;
    this.spectrogram = [];

    if (this.timer) {
      this.timer.stop();
    }
  }

  private onAudioProcess() {
    console.log('start', Date.now());
    let buffer = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(buffer);
    buffer = buffer.map(v => Math.pow(10, v / 20) * 2000);
    // const fftEnergies = AudioUtils.fftEnergies(buffer);
    const melEnergies = AudioUtils.applyFilterbank(buffer, this.melFilterbank);
    const mfccs = AudioUtils.cepstrumFromEnergySpectrum(melEnergies);

    if (this.isMfccEnabled) {
      this.spectrogram.push(mfccs);
    } else {
      this.spectrogram.push(melEnergies);
    }
    console.log(this.spectrogram.length);
    if (this.spectrogram.length > this.bufferCount) {
      // Remove the first element in the array.
      this.spectrogram.splice(0, 1);
    }
    if (this.spectrogram.length === this.bufferCount) {
      // Notify that we have an updated spectrogram.
      this.emit('update');
      this.spectrogram.splice(0, 15);
    }
    console.log('end', Date.now());
  }
}
