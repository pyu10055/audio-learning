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
import * as DCT from 'dct';
import * as KissFFT from 'kissfft-js';

const SR = 16000;

let startIndex = 0;
let endIndex = 0;
let bandMapper: number[] = [];
let context: AudioContext;

export class AudioUtils {
  /**
   * Calculates the FFT for an array buffer. Output is an array.
   */
  static fft(y: Float32Array) {
    const fftr = new KissFFT.FFTR(y.length);
    const transform = fftr.forward(y);
    fftr.dispose();
    return transform;
  }

  static dct(y: Float32Array) {
    const scale = Math.sqrt(2.0 / y.length);
    return DCT(y, scale);
  }

  /**
   * Given an interlaced complex array (y_i is real, y_(i+1) is imaginary),
   * calculates the energies. Output is half the size.
   */
  static fftEnergies(y: Float32Array) {
    const out = new Float32Array(y.length / 2);
    for (let i = 0; i < y.length / 2; i++) {
      out[i] = y[i * 2] * y[i * 2] + y[i * 2 + 1] * y[i * 2 + 1];
    }
    return out;
  }

  static createMelFilterbank(
      fftSize: number, melCount = 40, lowHz = 20, highHz = 4000,
      sr = SR): Float32Array {
    const lowMel = this.hzToMel(lowHz);
    const highMel = this.hzToMel(highHz);

    // Construct linearly spaced array of melCount intervals, between lowMel and
    // highMel.
    const mels = [];

    const melSpan = highMel - lowMel;
    const melSpacing = melSpan / (melCount + 1);
    for (let i = 0; i < melCount + 1; ++i) {
      mels[i] = lowMel + (melSpacing * (i + 1));
    }

    // Always exclude DC; emulate HTK.
    const hzPerSbin = 0.5 * sr / (fftSize - 1);
    startIndex = Math.floor(1.5 + (lowHz / hzPerSbin));
    endIndex = Math.ceil(highHz / hzPerSbin);

    // Maps the input spectrum bin indices to filter bank channels/indices. For
    // each FFT bin, band_mapper tells us which channel this bin contributes to
    // on the right side of the triangle.  Thus this bin also contributes to the
    // left side of the next channel's triangle response.
    bandMapper = [];
    let channel = 0;
    for (let i = 0; i < fftSize; ++i) {
      const melf = this.hzToMel(i * hzPerSbin);
      if ((i < startIndex) || (i > endIndex)) {
        bandMapper[i] = -2;  // Indicate an unused Fourier coefficient.
      } else {
        while ((mels[channel] < melf) && (channel < melCount)) {
          ++channel;
        }
        bandMapper[i] = channel - 1;  // Can be == -1
      }
    }

    // Create the weighting functions to taper the band edges.  The contribution
    // of any one FFT bin is based on its distance along the continuum between
    // two mel-channel center frequencies.  This bin contributes weights_[i] to
    // the current channel and 1-weights_[i] to the next channel.
    const weights = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; ++i) {
      channel = bandMapper[i];
      if ((i < startIndex) || (i > endIndex)) {
        weights[i] = 0.0;
      } else {
        if (channel >= 0) {
          weights[i] = (mels[channel + 1] - this.hzToMel(i * hzPerSbin)) /
              (mels[channel + 1] - mels[channel]);
        } else {
          weights[i] =
              (mels[0] - this.hzToMel(i * hzPerSbin)) / (mels[0] - lowMel);
        }
      }
    }

    return weights;
  }

  /**
   * Given an array of FFT magnitudes, apply a filterbank. Output should be an
   * array with size |filterbank|.
   */
  static applyFilterbank(
      fftEnergies: Float32Array, filterbank: Float32Array,
      melCount = 40): Float32Array {
    const out = new Float32Array(melCount);
    for (let i = startIndex; i <= endIndex; i++) {  // For each FFT bin
      const specVal = Math.sqrt(fftEnergies[i]);
      const weighted = specVal * filterbank[i];
      let channel = bandMapper[i];
      if (channel >= 0)
        out[channel] += weighted;  // Right side of triangle, downward slope
      channel++;
      if (channel < melCount)
        out[channel] += (specVal - weighted);  // Left side of triangle
    }
    for (let i = 0; i < out.length; ++i) {
      let val = out[i];
      if (val < 1e-12) {
        val = 1e-12;
      }
      out[i] = Math.log(val);
    }
    return out;
  }

  static hzToMel(hz: number) {
    return 1127.0 * Math.log(1.0 + hz / 700.0);
  }

  static cepstrumFromEnergySpectrum(melEnergies: Float32Array) {
    return this.dct(melEnergies);
  }

  static playbackArrayBuffer(buffer: Float32Array, sampleRate?: number) {
    if (!context) {
      context = new AudioContext();
    }
    if (!sampleRate) {
      sampleRate = context.sampleRate;
    }
    const audioBuffer = context.createBuffer(1, buffer.length, sampleRate);
    const audioBufferData = audioBuffer.getChannelData(0);
    audioBufferData.set(buffer);

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    source.start();
  }
}
