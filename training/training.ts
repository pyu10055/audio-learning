import * as tf from '@tensorflow/tfjs';
import * as fs from 'fs';
import * as wav from 'node-wav';

import {melSpectrogramToInput} from '../voice/command_recognizer';
import {Dataset} from '../voice/dataset';
import {normalize} from '../voice/util';

import {WavFileFeatureExtractor} from './wav_file_feature_extractor';

export class AudioModel {
  private model: tf.Model;
  private dataset: Dataset;
  private featureExtractor: WavFileFeatureExtractor;

  constructor(inputShape: number[], numClasses: number) {
    this.dataset = new Dataset(numClasses);
    this.featureExtractor = new WavFileFeatureExtractor();

    const model = tf.sequential();
    model.add(tf.layers.conv2d({
      filters: 8,
      kernelSize: [2, 8],
      activation: 'relu',
      inputShape: inputShape
    }));
    model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [2, 2]}));
    model.add(tf.layers.conv2d(
        {filters: 32, kernelSize: [2, 4], activation: 'relu'}));
    model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [2, 2]}));
    model.add(tf.layers.conv2d(
        {filters: 32, kernelSize: [2, 4], activation: 'relu'}));
    model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [2, 2]}));
    model.add(tf.layers.conv2d(
        {filters: 32, kernelSize: [2, 4], activation: 'relu'}));
    model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [1, 2]}));
    model.add(tf.layers.flatten({}));
    model.add(tf.layers.dense({units: 2000, activation: 'relu'}));
    model.add(tf.layers.dropout({rate: 0.5}));
    model.add(tf.layers.dense({units: numClasses, activation: 'softmax'}));

    model.compile({
      loss: 'categoricalCrossentropy',
      optimizer: tf.train.sgd(0.01),
      metrics: ['accuracy']
    });
    model.summary();
    this.model = model;
  }

  async loadData(dir: string, label: number) {
    fs.readdir(dir, (err, filenames) => {
      if (err) {
        throw err;
      }
      filenames.forEach(async (filename) => {
        this.dataset.addExample(await this.decode(filename), label);
      });
    });
  }

  async decode(filename: string) {
    let buffer = fs.readFileSync(filename);
    let result = wav.decode(buffer);
    console.log(result.sampleRate);
    await this.featureExtractor.start(result);
    let input = melSpectrogramToInput(this.featureExtractor.getFeatures());
    return normalize(input);
  }

  train(filename: string) {
    this.model.fit(
        this.dataset.xs, this.dataset.ys,
        {batchSize: 64, epochs: 100, shuffle: true, validationSplit: 0.1});

    this.model.save(filename);
  }
}
