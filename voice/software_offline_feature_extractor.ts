import {EventEmitter} from 'eventemitter3';

import {AudioUtils} from './audio_utils';
import {CircularAudioBuffer} from './circular_audio_buffer';
import {FeatureExtractor, Params} from './types';
import {nextPowerOfTwo} from './util';

export class SoftwareOfflineFeatureExtractor extends EventEmitter implements
    FeatureExtractor {
  private source: OfflineAudioContext;
  private buffer: AudioBufferSourceNode;
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
  scriptNode: ScriptProcessorNode;
  // For dealing with a circular buffer of audio samples.
  circularBuffer: CircularAudioBuffer;

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
    this.melFilterbank =
        AudioUtils.createMelFilterbank(this.fftSize / 2 + 1, this.melCount);

    this.circularBuffer = new CircularAudioBuffer(4096);
  }

  private createBufferWithValues(
      audioContext: OfflineAudioContext, xs: Float32Array) {
    const bufferLen = xs.length + 2048;
    const buffer = audioContext.createBuffer(1, bufferLen, 44100);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < xs.length; ++i) {
      channelData[i] = xs[i];
    }
    // padding
    for (let i = xs.length; i < bufferLen; ++i) {
      channelData[1] = Math.random();
    }
    return buffer;
  }

  async start(samples: Float32Array): Promise<Float32Array[]> {
    this.features = [];
    // Clear all buffers.
    this.circularBuffer.clear();
    const sourceSr = 44100;
    const lengthRes = (samples.length + 2048) * this.targetSr / sourceSr;
    this.source = new OfflineAudioContext(1, lengthRes, this.targetSr);

    this.buffer = this.source.createBufferSource();
    this.buffer.buffer = this.createBufferWithValues(this.source, samples);
    this.scriptNode = this.source.createScriptProcessor(2048, 1, 1);
    this.buffer.connect(this.scriptNode);
    this.scriptNode.connect(this.source.destination);
    const promise = new Promise<Float32Array[]>((resolve, reject) => {
      this.scriptNode.onaudioprocess =
          (audioProcessingEvent) => {
            const audioBuffer = audioProcessingEvent.inputBuffer;

            this.circularBuffer.addBuffer(audioBuffer.getChannelData(0));

            // Get buffer(s) out of the circular buffer. Note that there may be
            // multiple available, and if there are, we should get them all.
            const buffers = this.getFullBuffers();

            for (const buffer of buffers) {
              // AudioUtils.playbackArrayBuffer(buffer, 16000);
              // console.log(`Got buffer of length ${buffer.length}.`);
              // Extract the mel values for this new frame of audio data.
              const fft = AudioUtils.fft(buffer);
              const fftEnergies = AudioUtils.fftEnergies(fft);
              const melEnergies =
                  AudioUtils.applyFilterbank(fftEnergies, this.melFilterbank);
              const mfccs = AudioUtils.cepstrumFromEnergySpectrum(melEnergies);

              if (this.features.length < this.bufferCount) {
                if (this.isMfccEnabled) {
                  this.features.push(mfccs);
                } else {
                  this.features.push(melEnergies);
                }
              }

              console.log(this.features.length);
              if (this.features.length === this.bufferCount) {
                // Notify that we have an updated spectrogram.
                resolve(this.features);
              }
            }
          }
    });

    this.buffer.start();
    this.source.startRendering().catch(err => {
      console.log('Failed to render offline audio context:', err);
    });

    return promise;
  }
  stop() {
    this.scriptNode.disconnect(this.source.destination);
    this.buffer.stop();
  }

  transform(data: Float32Array) {
    return data;
  }

  getFeatures(): Float32Array[] {
    return this.features;
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