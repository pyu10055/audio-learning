import {AudioUtils} from './audio_utils';
import {OfflineFeatureExtractor} from './offline_feature_extractor';
import {nextPowerOfTwo} from './util';

export class NativeOfflineFeatureExtractor extends OfflineFeatureExtractor {
  // How many mel bins to use.
  fftSize = 1024;
  // Number of samples to hop over for every new column.
  hopLength = 444;
  // How long the total duration is.
  duration = 1.0;
  // Whether to use MFCC or Mel features.
  isMfccEnabled = true;
  images: Float32Array[];
  private melFilterbank = AudioUtils.createMelFilterbank(
      nextPowerOfTwo(this.bufferLength) + 1, this.melCount, 20, 4000,
      this.targetSr);

  preprocess() {
    this.features = [];
    this.images = [];
  }

  transform(data: Float32Array): Float32Array {
    data = data.map(v => Math.pow(10, v / 20));
    // const fftEnergies = AudioUtils.fftEnergies(buffer);
    const melEnergies = AudioUtils.applyFilterbank(data, this.melFilterbank);
    const mfccs = AudioUtils.cepstrumFromEnergySpectrum(melEnergies);
    this.images.push(melEnergies);
    return this.isMfccEnabled ? mfccs : melEnergies;
  }

  getImages() {
    return this.images;
  }
}