import {EventEmitter} from 'eventemitter3';

import {FeatureExtractor, Params} from './utils/types';
import {nextPowerOfTwo} from './utils/util';

export class OfflineFeatureExtractor extends EventEmitter implements
    FeatureExtractor {
  private source: OfflineAudioContext;
  private buffer: AudioBufferSourceNode;
  private analyser: AnalyserNode;
  protected features: Float32Array[];
  // Target sample rate.
  targetSr = 44100;
  // How long the buffer is.
  bufferLength = 1024;
  // How many mel bins to use.
  melCount = 40;
  // Number of samples to hop over for every new column.
  hopLength = 1024;
  // How long the total duration is.
  duration = 1.0;
  // Whether to use MFCC or Mel features.
  isMfccEnabled = true;
  fftSize = 360;

  config(params: Params) {
    Object.assign(this, params);
  }

  private createBufferWithValues(
      audioContext: OfflineAudioContext, xs: Float32Array) {
    const bufferLen = xs.length;
    const buffer =
        audioContext.createBuffer(1, bufferLen, audioContext.sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < bufferLen; ++i) {
      channelData[i] = xs[i];
    }
    return buffer;
  }

  protected preprocess() {
    this.features = [];
  }

  async start(samples: Float32Array): Promise<Float32Array[]> {
    this.preprocess();
    const audioCtx = new AudioContext();
    const buffer = await audioCtx.decodeAudioData(samples.buffer);

    this.source = new OfflineAudioContext(
        1, this.targetSr * this.duration * 4, this.targetSr);
    this.buffer = this.source.createBufferSource();
    this.buffer.buffer =
        this.createBufferWithValues(this.source, buffer.getChannelData(0));
    this.analyser = this.source.createAnalyser();
    this.analyser.fftSize = nextPowerOfTwo(this.bufferLength) * 2;
    this.analyser.smoothingTimeConstant = 0.0;
    this.buffer.connect(this.analyser);
    this.analyser.connect(this.source.destination);
    this.buffer.start();

    let frames = this.bufferLength;
    const promise =
        this.source.suspend(frames / this.source.sampleRate).then(async () => {
          do {
            frames += this.hopLength;
            const data = new Float32Array(this.fftSize);
            this.analyser.getFloatFrequencyData(data);
            this.features.push(this.transform(data));
            const promise =
                this.source.suspend(frames / this.source.sampleRate);
            this.source.resume();
            await promise;
          } while (frames <= buffer.length);
          return this.features;
        });

    this.source.startRendering().catch(err => {
      console.log('Failed to render offline audio context:', err);
    });

    return promise;
  }
  stop() {
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
    return this.features;
  }
}
