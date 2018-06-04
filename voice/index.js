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

const allLabels = [
  '_silence_', '_unknown_', 'yes', 'no', 'up', 'down', 'left', 'right', 'on',
  'off', 'stop', 'go'
];

const transferLabels = [
  '_silence_', 'up', 'down', 'left', 'right'
];

let recognizer;

const trainer = new CommandTrainer();
trainer.on('recorded', onRecorded);
let transferRecognizer;
const streamEl = document.querySelector('#stream');
const trainEl = document.querySelector('#train');
const trainingEl = document.querySelector('#training');
const recordEl = document.querySelector('#record');
const completeEl = document.querySelector('#complete');
const messageEl = document.querySelector('#message');
const commandEl = document.querySelector('#command');
const scoreEl = document.querySelector('#score');
const resultsEl = document.querySelector('#results');
const labelEl = document.querySelector('#label');
const predictEl = document.querySelector('#predict');

function setInstructionVisibility(visible) {
  // Show which commands are supported.
  if (visible) {
    const commandsFmt = recognizer.getCommands().join(', ');
    const message = `Listening for ${commandsFmt}.`;
    messageEl.innerHTML = message;
  } else {
    messageEl.innerHTML = '';
  }
}

function onStream() {
  if (recognizer.isRunning()) {
    recognizer.stop();
    setInstructionVisibility(false);
  } else {
    recognizer.start();
    setInstructionVisibility(true);
  }
}

function onTrain() {
  trainingEl.classList.remove('hide');
  trainingEl.classList.add('show');  
}

function onComplete() {
  trainer.train(); 
}

function onPredict() {
  if (transferRecognizer.isRunning()) {
    transferRecognizer.stop();
    setInstructionVisibility(false);
  } else {
    transferRecognizer.start();
    setInstructionVisibility(true);
  }  
}

function onRecord() {
  trainer.record(Number(labelEl.value));
  recordEl.disabled = 'disabled';
}

function onRecorded(dataset) {
  console.log(dataset);
  recordEl.disabled = false;
}

function onCommand(command, score) {
  console.log(`Command ${command} with score ${score}.`);
  commandEl.innerHTML = command;
  scoreEl.innerHTML = score.toFixed(2);
  resultsEl.classList.remove('hide');
  resultsEl.classList.add('show');
}

function onSilence(score) {
  // Start fading!
  resultsEl.classList.add('hide');
  resultsEl.classList.remove('show');
}

async function onLoadModel(e) {
  console.time('load model');
  await trainer.load();
  console.timeEnd('load model');
  recognizer = new CommandRecognizer({
    scoreT: 5,
    commands: allLabels,
    noOther: true,
    model: trainer.model
  });
  recognizer.on('command', onCommand);
  recognizer.on('silence', onSilence);
  
  transferRecognizer = new CommandRecognizer({
    scoreT: 5,
    commands: transferLabels,
    noOther: true,
    model: trainer.transferModel
  });
  transferRecognizer.on('command', onCommand);  
}


async function load() {
}

streamEl.addEventListener('click', onStream);
trainEl.addEventListener('click', onTrain);
completeEl.addEventListener('click', onComplete);
predictEl.addEventListener('click', onPredict);
recordEl.addEventListener('click', onRecord);
window.addEventListener('load', onLoadModel);