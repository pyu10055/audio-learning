"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spread = (this && this.__spread) || function () {
    for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
    return ar;
};
Object.defineProperty(exports, "__esModule", { value: true });
var eventemitter3_1 = require("eventemitter3");
var layer_streaming_feature_extractor_1 = require("./layer_streaming_feature_extractor");
var native_streaming_feature_extractor_1 = require("./native_streaming_feature_extractor");
var soft_streaming_feature_extractor_1 = require("./soft_streaming_feature_extractor");
var types_1 = require("./utils/types");
var util_1 = require("./utils/util");
exports.GOOGLE_CLOUD_STORAGE_DIR = 'https://storage.googleapis.com/tfjs-models/savedmodel/';
exports.MODEL_FILE_URL = 'voice/tensorflowjs_model.pb';
exports.TF_MODEL_FILE_URL = 'voice2/model.json';
exports.WEIGHT_MANIFEST_FILE_URL = 'voice/weights_manifest.json';
function getFeatureShape() {
    var times = Math.floor((types_1.DURATION * types_1.EXAMPLE_SR - types_1.BUFFER_LENGTH) / types_1.HOP_LENGTH) + 1;
    return [times, types_1.MEL_COUNT, 1];
}
exports.getFeatureShape = getFeatureShape;
var CommandRecognizer = (function (_super) {
    __extends(CommandRecognizer, _super);
    function CommandRecognizer(canvas, params) {
        var _this = _super.call(this) || this;
        _this.canvas = canvas;
        _this.lastCommandTime = Number.MIN_SAFE_INTEGER;
        Object.assign(_this, params);
        _this.nonCommands = ['_silence_', '_unknown_'];
        _this.threshold = params.threshold;
        _this.allLabels = _this.commands;
        var predsPerSecond = types_1.DURATION * types_1.EXAMPLE_SR / types_1.HOP_LENGTH;
        _this.predictionCount = Math.floor(predsPerSecond);
        console.log("CommandRecognizer will use a history window" +
            (" of " + _this.predictionCount + "."));
        _this.nativeFFT = new native_streaming_feature_extractor_1.NativeStreamingFeatureExtractor();
        _this.nativeFFT.config({
            inputBufferLength: 2048,
            bufferLength: 1024,
            hopLength: 444,
            melCount: 40,
            targetSr: 44100,
            duration: 1.0,
            isMfccEnabled: types_1.IS_MFCC_ENABLED,
        });
        _this.nativeFFT.on('update', _this.onUpdate.bind(_this));
        _this.softFFT = new soft_streaming_feature_extractor_1.SoftStreamingFeatureExtractor();
        _this.softFFT.config({
            melCount: 40,
            bufferLength: 480,
            hopLength: 160,
            targetSr: 16000,
            isMfccEnabled: types_1.IS_MFCC_ENABLED,
            duration: 1.0
        });
        _this.softFFT.on('update', _this.onUpdate.bind(_this));
        _this.layerFFT = new layer_streaming_feature_extractor_1.LayerStreamingFeatureExtractor();
        _this.layerFFT.config({
            melCount: 40,
            bufferLength: 1024,
            hopLength: 1024,
            targetSr: 44100,
            isMfccEnabled: false,
            duration: 1.0
        });
        _this.layerFFT.on('update', _this.onUpdate.bind(_this));
        _this.streamFeature = _this.softFFT;
        _this.predictionHistory = [];
        _this.lastCommand = null;
        return _this;
    }
    CommandRecognizer.prototype.setModelType = function (modelType, commands) {
        this.modelType = modelType;
        this.commands = commands;
        this.allLabels = commands;
        this.model = types_1.MODELS[modelType];
        switch (modelType) {
            case types_1.ModelType.FROZEN_MODEL:
                this.streamFeature = this.softFFT;
                break;
            case types_1.ModelType.FROZEN_MODEL_NATIVE:
                this.streamFeature = this.nativeFFT;
                break;
            default:
                this.streamFeature = this.layerFFT;
        }
    };
    CommandRecognizer.prototype.start = function () {
        this.streamFeature.start();
    };
    CommandRecognizer.prototype.stop = function () {
        this.streamFeature.stop();
    };
    CommandRecognizer.prototype.isRunning = function () {
        return this.streamFeature.isStreaming;
    };
    CommandRecognizer.prototype.getAllLabels = function () {
        return this.allLabels;
    };
    CommandRecognizer.prototype.getCommands = function () {
        return this.commands;
    };
    CommandRecognizer.prototype.onUpdate = function () {
        var _this = this;
        var spec = this.streamFeature.getFeatures();
        util_1.plotSpectrogram(this.canvas, this.streamFeature.getImages());
        var input = util_1.melSpectrogramToInput(spec);
        if (this.modelType === types_1.ModelType.TF_MODEL) {
            input = util_1.normalize(input);
        }
        var preds = this.model.predict(input, {});
        var scores = [];
        if (Array.isArray(preds)) {
            var output = preds[0].dataSync();
            scores = __spread([
                output[0]
            ], Array.prototype.slice.call(preds[1].dataSync()));
        }
        else {
            scores = Array.prototype.slice.call(preds.dataSync());
        }
        var currentTime = new Date().getTime();
        this.predictionHistory.push({
            time: currentTime,
            scores: scores,
        });
        var timeLimit = currentTime - types_1.DURATION * 1000;
        while (this.predictionHistory[0].time < timeLimit) {
            this.predictionHistory.shift();
        }
        var count = this.predictionHistory.length;
        var earliestTime = this.predictionHistory[0].time;
        var samplesDuration = currentTime - earliestTime;
        if ((count < types_1.MIN_SAMPLE) || (samplesDuration < (types_1.DURATION / 4))) {
            return;
        }
        var averageScores = new Array(this.allLabels.length).fill(0);
        this.predictionHistory.forEach(function (pred) {
            var scores = pred.scores;
            for (var i = 0; i < scores.length; ++i) {
                averageScores[i] += scores[i] / _this.predictionHistory.length;
            }
        });
        console.log(this.predictionHistory.length);
        var sortedScore = averageScores.map(function (a, i) { return [i, a]; }).sort(function (a, b) { return b[1] - a[1]; });
        console.log(sortedScore[0], sortedScore[1]);
        var currentTopIndex = sortedScore[0][0];
        var currentTopLabel = this.allLabels[currentTopIndex];
        var currentTopScore = sortedScore[0][1];
        var timeSinceLast = (this.lastCommand === '_silence_') ||
            (this.lastCommandTime === Number.MIN_SAFE_INTEGER) ?
            Number.MAX_SAFE_INTEGER :
            currentTime - this.lastCommandTime;
        if ((currentTopScore > this.threshold) &&
            (currentTopLabel !== this.lastCommand) &&
            (timeSinceLast > types_1.SUPPRESSION_TIME)) {
            this.emitCommand(currentTopLabel, currentTopScore, currentTime);
        }
    };
    CommandRecognizer.prototype.emitCommand = function (command, score, time) {
        if (this.nonCommands.indexOf(command) === -1) {
            this.emit('command', command, score);
            console.log("Detected command " + command + " with score: " + score + ".");
        }
        else {
            this.emit('silence');
        }
        this.lastCommandTime = time;
        this.lastCommand = command;
    };
    return CommandRecognizer;
}(eventemitter3_1.EventEmitter));
exports.CommandRecognizer = CommandRecognizer;
//# sourceMappingURL=command_recognizer.js.map