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
const recognizer = new CommandRecognizer({
  scoreT: 5,
  commands: allLabels,
  noOther: true
});
recognizer.on('command', onCommand);
recognizer.on('silence', onSilence);

const trainer = new CommandTrainer();
trainer.on('recorded', onRecorded);

const streamEl = document.querySelector('#stream');
const trainEl = document.querySelector('#train');
const recordEl = document.querySelector('#record');
const completeEl = document.querySelector('#complete');
const messageEl = document.querySelector('#message');
const commandEl = document.querySelector('#command');
const scoreEl = document.querySelector('#score');
const resultsEl = document.querySelector('#results');

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

let levelAnimationId = null;
function setLevelVisibility(visible) {
  if (visible) {
    levelsEl.style.display = 'block';
    levelAnimationId = requestAnimationFrame(animateLevelLoop);
  } else {
    levelsEl.style.display = 'none';
    cancelAnimationFrame(levelAnimationId);
  }
}

function animateLevelLoop() {
  // Get the latest energy level, and animate as a result.
  const micEl = getOrCreateConfidenceIndicator('mic-input', 'Microphone level');
  micEl.setAttribute('color', 'blue');
  micEl.setAttribute('level', recognizer.getMicrophoneInputLevel().toString());

  // For each class in the recognizer, get the confidence level.
  for (let command of recognizer.getAllLabels()) {
    const indicatorEl =
        getOrCreateConfidenceIndicator(command, command.toUpperCase());
    indicatorEl.setAttribute('level', recognizer.getConfidenceLevel(command).toString());
  }

  levelAnimationId = requestAnimationFrame(animateLevelLoop);
}

function getOrCreateConfidenceIndicator(command, title) {
  let outEl = document.querySelector(`.${command}`);
  if (!outEl) {
    outEl = document.createElement('confidence-indicator');
    outEl.setAttribute('title', title);
    outEl.setAttribute('level', '0.5');
    outEl.className = command;
    levelsEl.appendChild(outEl);
  }
  return outEl;
}

function onStream() {
  if (recognizer.isRunning()) {
    recognizer.stop();
    setInstructionVisibility(false);
    //setLevelVisibility(false);
  } else {
    recognizer.start();
    setInstructionVisibility(true);
    //setLevelVisibility(true);
  }
}

function onTrain() {
  recordEl.classList.remove('hide');
  recordEl.classList.add('show');  
}

function onComplete() {
  trainer.train(); 
}

function onRecord() {
  trainer.record(1);
  recordEl.disabled = true;
}

function onRecorded() {
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
  console.log('loading model ...');
  await recognizer.load();
  await trainer.load();
  console.log('loading model finished.');
}

streamEl.addEventListener('click', onStream);
trainEl.addEventListener('click', onTrain);
completeEl.addEventListener('click', onComplete);
recordEl.addEventListener('click', onRecord);
window.addEventListener('load', onLoadModel);