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

import {CommandRecognizer} from './command_recognizer';
import {CommandTrainer} from './command_trainer';
import {ModelEvaluation} from './model_evaluation';
import {Spectrogram} from './spectrogram';
import {audioCtx} from './streaming_feature_extractor';
import {ModelType} from './types';

const allLabels = [
  '_silence_', '_unknown_', 'yes', 'no', 'up', 'down', 'left', 'right', 'on',
  'off', 'stop', 'go'
];

const transferLabels = ['_silence_', '上-up', '下-down', '左-left', '右-right'];
const evalLabels = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'zero', 'left', 'right', 'go', 'stop'
];
let recognizer;

const trainer = new CommandTrainer();
trainer.on('recorded', onRecorded);
trainer.on('loss', onLoss);
let transferRecognizer;
let spectrogram;
const mainCanvas = document.getElementById('main-canvas');
const evaluation = new ModelEvaluation(mainCanvas);


function setInstructionVisibility(visible, recognizer) {
  // Show which commands are supported.
  if (visible) {
    const commandsFmt = recognizer.getCommands().join(', ');
    const message = `Listening for ${commandsFmt}.`;
    $('#message').text(message);
  } else {
    $('#message').text('');
  }
}

function onStream() {
  if (recognizer.isRunning()) {
    $('#stream').text('Start');
    recognizer.stop();
    setInstructionVisibility(false, recognizer);
    spectrogram.stop();
  } else {
    $('#stream').text('Stop');
    recognizer.start();
    setInstructionVisibility(true, recognizer);
    spectrogram.start();
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
    spectrogram.stop();
  } else {
    $('#predict').text('Stop Predict');
    transferRecognizer.start();
    setInstructionVisibility(true, transferRecognizer);
    spectrogram.start();
  }
}
function onModelChange() {
  if (Number($('#eval-model').val()) === ModelType.TF_MODEL) {
    $('#eval-labels').text(evalLabels.join(', '));
  } else {
    $('#eval-labels').text(allLabels.join(', '));
  }
}

function onRecord() {
  spectrogram.start();
  trainer.record(Number($('#label').val()));
  $('#record').attr('disabled', 'disabled');
}

function onRecorded(dataset) {
  console.log(dataset);
  spectrogram.stop();
  $('#record').removeAttr('disabled');
  setButtonStates();
}

function onLoss(loss) {
  $('#loss').text('Loss: ' + loss);
}

function onCommand(command, score) {
  console.log(`Command ${command} with score ${score}.`);
  $('#command').text(command);
  $('#score').text(score.toFixed(2));
  $('#results').removeClass('fade');
}

function onSilence(score) {
  // Start fading!
  $('#results').addClass('fade');
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

async function onEvaluate() {
  const labels = Number($('#eval-model').val()) === ModelType.TF_MODEL ?
      evalLabels :
      allLabels;
  const label = labels.indexOf($('#eval-label').val());
  if (label === -1) {
    alert('Please provide valid label.');
    return;
  }
  const accuracy = await evaluation.eval(
      Number($('#eval-model').val()), $('#eval-files')[0].files,
      Array($('#eval-files')[0].files.length).fill(label));
  $('#accuracy').text(accuracy.toFixed(2));
}

async function onLoadModel(e) {
  console.time('load model');
  await trainer.load();
  await evaluation.load();
  console.timeEnd('load model');
  recognizer = new CommandRecognizer(mainCanvas, {
    scoreT: 5,
    commands: allLabels,
    noOther: true,
    model: trainer.model,
    threshold: 0.4
  });
  recognizer.on('command', onCommand);
  recognizer.on('silence', onSilence);

  transferRecognizer = new CommandRecognizer(mainCanvas, {
    scoreT: 5,
    commands: transferLabels,
    noOther: true,
    model: trainer.transferModel,
    threshold: 0.3
  });
  transferRecognizer.on('command', onCommand);
  transferRecognizer.on('silence', onSilence);
  setButtonStates();
  $('#eval-labels').text(evalLabels.join(', '));
  spectrogram = new Spectrogram('#spectrogram');
  $('a[data-toggle="tab"]').on('shown.bs.tab', function(e) {
    $('#stream').text('Start');
    recognizer.stop();
    setInstructionVisibility(false, recognizer);
    spectrogram.stop();

    $('#predict').text('Start Predict');
    transferRecognizer.stop();
    setInstructionVisibility(false, transferRecognizer);
    spectrogram.stop();
  })
}

$('#eval-start').on('click', onEvaluate);
$('#stream').on('click', onStream);
$('#complete').on('click', onComplete);
$('#predict').on('click', onPredict);
$('#record').on('click', onRecord);
$('#eval-model').on('change', onModelChange);
window.addEventListener('load', onLoadModel);
