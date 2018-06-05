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

import AudioUtils from './audio_utils';
import CircularAudioBuffer from './circular_audio_buffer';
import {EventEmitter} from 'eventemitter3';

const INPUT_BUFFER_LENGTH = 16384;

interface Params {
  inputBufferLength?: number
  bufferLength: number
  hopLength: number
  duration: number
  melCount: number
  targetSr: number
  isMfccEnabled: boolean
}

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
export default class StreamingFFT extends EventEmitter {
  // The length of the input buffer, used in ScriptProcessorNode.
  inputBufferLength: number
  // Target sample rate.
  targetSr: number
  // How long the buffer is.
  bufferLength: number
  // How many buffers to keep in the spectrogram.
  hopTime: number
  // How many mel bins to use.
  melCount: number
  // Number of samples to hop over for every new column.
  hopLength: number
  // How long the total duration is.
  duration: number
  // Whether to use MFCC or Mel features.
  isMfccEnabled: boolean

  // Where to store the latest spectrogram.
  spectrogram: Float32Array[]
  // The mel filterbank (calculate it only once).
  melFilterbank: Float32Array

  // Are we streaming right now?
  isStreaming: boolean

  analyser: AnalyserNode;
  // The active stream.
  stream: MediaStream

  // For dealing with a circular buffer of audio samples.
  circularBuffer: CircularAudioBuffer

  // Time when the streaming began. This is used to check whether
  // ScriptProcessorNode has dropped samples.
  processStartTime: Date

  // Number of samples we've encountered in our ScriptProcessorNode
  // onAudioProcess.
  processSampleCount: number

  // A proxy for loudness.
  lastEnergyLevel: number

  constructor(params: Params) {
    super();

    const {bufferLength, duration, hopLength, isMfccEnabled,
      melCount, targetSr, inputBufferLength} = params;
    this.bufferLength = bufferLength;
    this.inputBufferLength = inputBufferLength || INPUT_BUFFER_LENGTH;
    this.hopLength = hopLength;
    this.melCount = melCount;
    this.isMfccEnabled = isMfccEnabled;
    this.targetSr = targetSr;
    this.duration = duration;
    this.hopTime = this.hopLength * 1000 / this.targetSr;

    if (hopLength > bufferLength) {
      console.error('Hop length must be smaller than buffer length.');
    }

    // The mel filterbank is actually half of the size of the number of samples,
    // since the FFT array is complex valued.
    const fftSize = this.nextPowerOfTwo(this.bufferLength);
    this.spectrogram = [];
    this.isStreaming = false;

    const nativeSr = audioCtx.sampleRate;
  }

  private nextPowerOfTwo(value) {
    const exponent = Math.ceil(Math.log2(value));
    return 1 << exponent;
  }

  getSpectrogram() {
    return this.spectrogram;
  }

  start() {
    // Clear all buffers.
    this.circularBuffer.clear();

    // Reset start time and sample count for ScriptProcessorNode watching.
    this.processStartTime = new Date();
    this.processSampleCount = 0;

    const constraints = {audio: {
      "mandatory": {
        "googEchoCancellation": "false",
        "googAutoGainControl": "false",
        "googNoiseSuppression": "false",
        "googHighpassFilter": "false"
      },
    } , video: false};
    navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints).then(stream => {
      this.stream = stream;
      this.analyser = audioCtx.createAnalyser();
      this.analyser.fftSize = this.bufferCount;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(this.analyser);
      this.isStreaming = true;
      timeout(this.onAudioProcess.bind(this), )
    });
  }

  stop() {
    for (let track of this.stream.getTracks()) {
      track.stop();
    }
    this.analyser.disconnect(audioCtx.destination);
    this.stream = null;
    this.isStreaming = false;
  }

  private onAudioProcess() {
    //console.log(this.spectrogram.length);
    const audioBuffer = audioProcessingEvent.inputBuffer;

    // Add to the playback buffers, but make sure we have enough room.
    const remaining = this.playbackBuffer.getRemainingLength();
    const arrayBuffer = audioBuffer.getChannelData(0);
    this.processSampleCount += arrayBuffer.length;
    if (remaining < arrayBuffer.length) {
      this.playbackBuffer.popBuffer(arrayBuffer.length);
      //console.log(`Freed up ${arrayBuffer.length} in the playback buffer.`);
    }
    this.playbackBuffer.addBuffer(arrayBuffer);

    // Resample the buffer into targetSr.
    //console.log(`Resampling from ${audioCtx.sampleRate} to ${this.targetSr}.`);
    resampleWebAudio(audioBuffer, this.targetSr).then((audioBufferRes: AudioBuffer) => {
      const bufferRes = audioBufferRes.getChannelData(0);
      // Write in a buffer of ~700 samples.
      this.circularBuffer.addBuffer(bufferRes);
    });

    // Get buffer(s) out of the circular buffer. Note that there may be multiple
    // available, and if there are, we should get them all.
    const buffers = this.getFullBuffers();
    if (buffers.length > 0) {
      //console.log(`Got ${buffers.length} buffers of audio input data.`);
    }

    for (let buffer of buffers) {
      //AudioUtils.playbackArrayBuffer(buffer, 16000);
      //console.log(`Got buffer of length ${buffer.length}.`);
      // Extract the mel values for this new frame of audio data.
      const fft = AudioUtils.fft(buffer);
      const fftEnergies = AudioUtils.fftEnergies(fft);
      const melEnergies = AudioUtils.applyFilterbank(fftEnergies, this.melFilterbank);
      const mfccs = AudioUtils.cepstrumFromEnergySpectrum(melEnergies);
      
      if (this.isMfccEnabled) {
        this.spectrogram.push(mfccs);
      } else {
        this.spectrogram.push(melEnergies);
      }
      if (this.spectrogram.length > this.bufferCount) {
        // Remove the first element in the array.
        this.spectrogram.splice(0, 1);
      }
      if (this.spectrogram.length == this.bufferCount) {
        // Notify that we have an updated spectrogram.
        this.emit('update');
        this.spectrogram.splice(0, 15);
      }
      const totalEnergy = melEnergies.reduce((total, num) => total + num);
      this.lastEnergyLevel = totalEnergy / melEnergies.length;
    }

    // const elapsed = (new Date().valueOf() - this.processStartTime.valueOf()) / 1000;
    // const expectedSampleCount = (audioCtx.sampleRate * elapsed);
    // const percentError = Math.abs(expectedSampleCount - this.processSampleCount) /
    //     expectedSampleCount;
    // if (percentError > 0.1) {
    //   console.warn(`ScriptProcessorNode may be dropping samples. Percent error is ${percentError}.`);
    // }    
  }

  /**
   * Get as many full buffers as are available in the circular buffer.
   */
  private getFullBuffers() {
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

function resampleWebAudio(audioBuffer: AudioBuffer, targetSr: number) {
  const sourceSr = audioBuffer.sampleRate;
  const lengthRes = audioBuffer.length * targetSr/sourceSr;
  const offlineCtx = new OfflineAudioContext(1, lengthRes, targetSr);

  return new Promise((resolve, reject) => {
    const bufferSource = offlineCtx.createBufferSource();
    bufferSource.buffer = audioBuffer;
    offlineCtx.oncomplete = function(event) {
      const bufferRes = event.renderedBuffer;
      const len = bufferRes.length;
      //console.log(`Resampled buffer from ${audioBuffer.length} to ${len}.`);
      resolve(bufferRes);
    }
    bufferSource.connect(offlineCtx.destination);
    bufferSource.start();
    offlineCtx.startRendering();
  });
}
