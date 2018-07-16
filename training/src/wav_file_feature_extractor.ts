import {EventEmitter} from 'eventemitter3';

import {AudioUtils} from '../../voice/audio_utils';
import {CircularAudioBuffer} from '../../voice/circular_audio_buffer';
import {Params} from '../../voice/types';
import {nextPowerOfTwo} from '../../voice/util';

export class WavFileFeatureExtractor extends EventEmitter {
  private features: Float32Array[];
  // Target sample rate.
  targetSr = 16000;
  // How long the buffer is.
  bufferLength = 480;
  // How many mel bins to use.
  melCount = 40;
  // Number of samples to hop over for every new column.
  hopLength = 160;
  // How long the total duration is.
  duration = 1.0;
  // Whether to use MFCC or Mel features.
  isMfccEnabled = true;
  fftSize = 512;
  // How many buffers to keep in the spectrogram.
  bufferCount: number;
  // The mel filterbank (calculate it only once).
  melFilterbank: Float32Array;
  // The script node doing the Web Audio processing.
  // scriptNode: ScriptProcessorNode;
  // For dealing with a circular buffer of audio samples.
  circularBuffer: CircularAudioBuffer;
  audioUtils = new AudioUtils();
  config(params: Params) {
    Object.assign(this, params);
    this.bufferCount = Math.floor(
                           (this.duration * this.targetSr - this.bufferLength) /
                           this.hopLength) +
        1;

    if (this.hopLength > this.bufferLength) {
      console.error('Hop length must be smaller than buffer length.');
    }

    // The mel filterbank is actually half of the size of the number of samples,
    // since the FFT array is complex valued.
    this.fftSize = nextPowerOfTwo(this.bufferLength);
    this.melFilterbank = this.audioUtils.createMelFilterbank(
        this.fftSize / 2 + 1, this.melCount);

    this.circularBuffer = new CircularAudioBuffer(20000);
  }

  start(samples?: Float32Array): Float32Array[] {
    this.features = [];
    // Clear all buffers.
    this.circularBuffer.clear();
    this.circularBuffer.addBuffer(samples);

    // Get buffer(s) out of the circular buffer. Note that there may be
    // multiple available, and if there are, we should get them all.
    const buffers = this.getFullBuffers();

    for (const buffer of buffers) {
      // console.log(`Got buffer of length ${buffer.length}.`);
      // Extract the mel values for this new frame of audio data.
      const fft = this.audioUtils.fft(buffer);
      const fftEnergies = this.audioUtils.fftEnergies(fft);
      const melEnergies =
          this.audioUtils.applyFilterbank(fftEnergies, this.melFilterbank);
      const mfccs = this.audioUtils.cepstrumFromEnergySpectrum(melEnergies);

      if (this.features.length < this.bufferCount) {
        if (this.isMfccEnabled) {
          this.features.push(mfccs);
        } else {
          this.features.push(melEnergies);
        }
      }
    }
    return this.features;
  }

  stop() {}

  transform(data: Float32Array) {
    return data;
  }

  getFeatures(): Float32Array[] {
    return this.features;
  }

  getImages(): Float32Array[] {
    throw new Error('Method not implemented.');
  }
  /**
   * Get as many full buffers as are available in the circular buffer.
   */
  private getFullBuffers() {
    const out = [];
    // While we have enough data in the buffer.
    while (this.circularBuffer.getLength() >= this.bufferLength) {
      // Get a buffer of desired size.
      const buffer = this.circularBuffer.getBuffer(this.bufferLength);
      // Remove a hop's worth of data from the buffer.
      this.circularBuffer.popBuffer(this.hopLength);
      out.push(buffer);
    }
    return out;
  }
}
