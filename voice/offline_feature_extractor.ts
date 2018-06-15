import {EventEmitter} from 'eventemitter3';

import {FeatureExtractor} from './model_evaluation';
import {nextPowerOfTwo} from './util';

export class OfflineFeatureExtractor extends EventEmitter implements
    FeatureExtractor {
  private source: OfflineAudioContext;
  private buffer: AudioBufferSourceNode;
  private analyser: AnalyserNode;
  private bufferLength: number;
  private hopLength: number;
  private features: Float32Array[];

  config(source: OfflineAudioContext, bufferLength: number, hopLength: number) {
    this.source = source;
    this.bufferLength = length;
    this.hopLength = hopLength;
    this.analyser = source.createAnalyser();
    this.analyser.fftSize = nextPowerOfTwo(length);
    this.analyser.smoothingTimeConstant = 0.0;
    this.buffer = source.createBufferSource();
    this.buffer.connect(this.analyser);
    this.analyser.connect(source.destination);
    this.features = [];
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


  async start(samples: Float32Array) {
    let completed = false;
    this.buffer.buffer = this.createBufferWithValues(this.source, samples);
    this.source.oncomplete = (event) => completed = true;
    this.buffer.start();

    let recordingConversionSucceeded = false;
    const data = new Float32Array(this.analyser.frequencyBinCount);

    for (let frames = this.bufferLength;
         frames < samples.length - this.bufferLength;
         frames += this.hopLength) {
      try {
        await this.source.suspend(frames / this.source.sampleRate);
      } catch (err) {
        console.log(`suspend() call failed. Retrying ...`);
        break;
      }
      this.analyser.getFloatFrequencyData(data);
      this.features.push(data);
      this.source.resume();
    }
  }
  stop() {
    this.buffer.stop();
  }
  getFeatures(): Float32Array[] {
    return this.features;
  }
}