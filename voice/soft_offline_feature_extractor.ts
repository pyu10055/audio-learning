import {EventEmitter} from 'eventemitter3';

import {AudioUtils} from './utils/audio_utils';
import {CircularAudioBuffer} from './utils/circular_audio_buffer';
import {FeatureExtractor, Params} from './utils/types';
import {nextPowerOfTwo} from './utils/util';

export class SoftOfflineFeatureExtractor extends EventEmitter implements
    FeatureExtractor {
  private source: OfflineAudioContext;
  private buffer: AudioBufferSourceNode;
  private features: Float32Array[];
  private images: Float32Array[];
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
  playbackBuffer: CircularAudioBuffer;
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
    this.playbackBuffer = new CircularAudioBuffer(20000);
  }

  private createBufferWithValues(
      audioContext: OfflineAudioContext, xs: Float32Array) {
    const bufferLen = xs.length;
    const buffer = audioContext.createBuffer(1, bufferLen, 44100);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < xs.length; ++i) {
      channelData[i] = xs[i];
    }
    return buffer;
  }

  async start(samples: Float32Array): Promise<Float32Array[]> {
    this.features = [];
    this.images = [];
    // Clear all buffers.
    this.circularBuffer.clear();
    this.playbackBuffer.clear();

    const audioCtx = new AudioContext();
    const buffer = await audioCtx.decodeAudioData(samples.buffer);
    const sourceSr = 44100;
    const lengthRes = (buffer.length) * this.targetSr / sourceSr;
    this.source = new OfflineAudioContext(1, lengthRes, this.targetSr);

    this.buffer = this.source.createBufferSource();
    this.buffer.buffer =
        this.createBufferWithValues(this.source, buffer.getChannelData(0));
    // this.scriptNode = this.source.createScriptProcessor(2048, 1, 1);
    // this.buffer.connect(this.scriptNode);
    // this.scriptNode.connect(this.source.destination);
    let resolved = false;
    const promise = new Promise<Float32Array[]>((resolve, reject) => {
      this.source.oncomplete = (audioProcessingEvent) => {
        const audioBuffer = audioProcessingEvent.renderedBuffer;
        this.playbackBuffer.addBuffer(audioBuffer.getChannelData(0));
        this.circularBuffer.addBuffer(audioBuffer.getChannelData(0));

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
          this.images.push(melEnergies);

          if (this.features.length < this.bufferCount) {
            if (this.isMfccEnabled) {
              this.features.push(mfccs);
            } else {
              this.features.push(melEnergies);
            }
          }

          if (!resolved && this.features.length === this.bufferCount) {
            this.audioUtils.playbackArrayBuffer(
                this.playbackBuffer.getBuffer(), 16000);
            resolved = true;
            // Notify that we have an updated spectrogram.
            resolve(this.features);
          }
        }
      };
      this.buffer.connect(this.source.destination);
      this.buffer.start();
      this.source.startRendering().catch(err => {
        console.log('Failed to render offline audio context:', err);
      });
    });
    return promise;
  }
  stop() {
    // this.scriptNode.disconnect(this.source.destination);
    if (this.buffer) {
      this.buffer.stop();
    }
  }

  transform(data: Float32Array) {
    return data;
  }

  getFeatures(): Float32Array[] {
    return this.features;
  }

  getImages(): Float32Array[] {
    return this.images;
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
    console.log(out.length);
    return out;
  }
}
