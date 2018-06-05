/**
 * @license
 * Copyright 2018 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

import * as tfc from '@tensorflow/tfjs-core';
import CommandRecognizer from './command_recognizer';
import CommandTrainer from './command_trainer';
import {Spectrogram} from './spectrogram';
import {audioCtx} from './streaming_feature_extractor';

const allLabels = [
  '_silence_', '_unknown_', 'yes', 'no', 'up', 'down', 'left', 'right', 'on',
  'off', 'stop', 'go'
];

const transferLabels = ['_silence_', 'up', 'down', 'left', 'right'];

let recognizer;

const trainer = new CommandTrainer();
trainer.on('recorded', onRecorded);
trainer.on('loss', onLoss);
let transferRecognizer;
let spectrogram;

function setInstructionVisibility(visible, recognizer) {
  // Show which commands are supported.
  if (visible) {
    const commandsFmt = recognizer.getCommands().join(', ');
    const message = `Listening for ${commandsFmt}.`;
    $('#myTabContent .active #message').text(message);
  } else {
    $('#myTabContent .active #message').text('');
  }
}

function onStream() {
  if (recognizer.isRunning()) {
    $('#stream').text('Start');
    recognizer.stop();
    setInstructionVisibility(false, recognizer);
    spectrogram.running = false;
  } else {
    $('#stream').text('Stop');
    recognizer.start();
    setInstructionVisibility(true, recognizer);
    spectrogram.running = true;
  }
}

async function onComplete() {
  $('#record').attr('disabled', 'disabled');
  await trainer.train();
  $('#record').removeAttr('disabled');
  setButtonStates();
}

function onPredict() {
  if (transferRecognizer.isRunning()) {
    $('#predict').text('Start Predict');
    transferRecognizer.stop();
    setInstructionVisibility(false, transferRecognizer);
    spectrogram.running = false;
  } else {
    $('#predict').text('Stop Predict');
    transferRecognizer.start();
    setInstructionVisibility(true, transferRecognizer);
    spectrogram.running = true;
  }
}

function onRecord() {
  spectrogram.running = true;
  trainer.record(Number($('#label').val()));
  $('#record').attr('disabled', 'disabled');
}

function onRecorded(dataset) {
  console.log(dataset);
  spectrogram.running = false;
  $('#record').removeAttr('disabled');
  setButtonStates();
}

function onLoss(loss) {
  $('#loss').text('Loss: ' + loss);
}

function onCommand(command, score) {
  console.log(`Command ${command} with score ${score}.`);
  $('#myTabContent .active #command').text(command);
  $('#myTabContent .active #score').text(score.toFixed(2));
  $('#myTabContent .active #results').removeClass('fade');
}

function onSilence(score) {
  // Start fading!
  $('#myTabContent .active #results').addClass('fade');
}

function setButtonStates() {
  if (trainer.withData) {
    $('#complete').removeAttr('disabled');
  } else {
    $('#complete').attr('disabled', 'disabled');
  }
  if (trainer.trained) {
    $('#predict').removeAttr('disabled');
  } else {
    $('#predict').attr('disabled', 'disabled');
  }
}

async function onLoadModel(e) {
  console.time('load model');
  await trainer.load();
  console.timeEnd('load model');
  recognizer = new CommandRecognizer(
      {scoreT: 5, commands: allLabels, noOther: true, model: trainer.model});
  recognizer.on('command', onCommand);
  recognizer.on('silence', onSilence);

  transferRecognizer = new CommandRecognizer({
    scoreT: 5,
    commands: transferLabels,
    noOther: true,
    model: trainer.transferModel
  });
  transferRecognizer.on('command', onCommand);
  transferRecognizer.on('silence', onSilence);
  setButtonStates();
  spectrogram = new Spectrogram(audioCtx, 'spectrgram');
}


async function load() {}

$('#stream').on('click', onStream);
$('#complete').on('click', onComplete);
$('#predict').on('click', onPredict);
$('#record').on('click', onRecord);

window.addEventListener('load', onLoadModel);