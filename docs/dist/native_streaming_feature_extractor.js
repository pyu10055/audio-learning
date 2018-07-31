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
Object.defineProperty(exports, "__esModule", { value: true });
var streaming_feature_extractor_1 = require("./streaming_feature_extractor");
var audio_utils_1 = require("./utils/audio_utils");
var util_1 = require("./utils/util");
exports.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var NativeStreamingFeatureExtractor = (function (_super) {
    __extends(NativeStreamingFeatureExtractor, _super);
    function NativeStreamingFeatureExtractor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.audioUtils = new audio_utils_1.AudioUtils();
        return _this;
    }
    NativeStreamingFeatureExtractor.prototype.extraConfig = function () {
        this.hopTime = this.hopLength * 1000 / this.targetSr;
        this.timer = new util_1.Interval(this.hopTime, this.onAudioProcess.bind(this));
        this.melFilterbank = this.audioUtils.createMelFilterbank(util_1.nextPowerOfTwo(this.bufferLength) + 1, this.melCount, 20, 4000, this.targetSr);
    };
    NativeStreamingFeatureExtractor.prototype.setup = function () {
        this.analyser = exports.audioCtx.createAnalyser();
        this.analyser.fftSize = util_1.nextPowerOfTwo(this.bufferLength);
        this.analyser.smoothingTimeConstant = 0;
        var source = exports.audioCtx.createMediaStreamSource(this.stream);
        source.connect(this.analyser);
        this.isStreaming = true;
        this.timer.run();
        this.onAudioProcess();
    };
    NativeStreamingFeatureExtractor.prototype.tearDown = function () {
        if (this.timer) {
            this.timer.stop();
        }
    };
    NativeStreamingFeatureExtractor.prototype.onAudioProcess = function () {
        var buffer = new Float32Array(this.analyser.frequencyBinCount);
        this.analyser.getFloatFrequencyData(buffer);
        buffer = buffer.map(function (v) { return Math.pow(10, v / 20); });
        var melEnergies = this.audioUtils.applyFilterbank(buffer, this.melFilterbank);
        var mfccs = this.audioUtils.cepstrumFromEnergySpectrum(melEnergies);
        if (this.isMfccEnabled) {
            this.spectrogram.push(mfccs);
        }
        else {
            this.spectrogram.push(melEnergies);
        }
        this.images.push(melEnergies);
        if (this.spectrogram.length > this.bufferCount) {
            this.spectrogram.splice(0, 1);
            this.images.splice(0, 1);
        }
        if (this.spectrogram.length === this.bufferCount) {
            this.emit('update');
            this.spectrogram.splice(0, 15);
            this.images.splice(0, 15);
        }
    };
    return NativeStreamingFeatureExtractor;
}(streaming_feature_extractor_1.StreamingFeatureExtractor));
exports.NativeStreamingFeatureExtractor = NativeStreamingFeatureExtractor;
//# sourceMappingURL=native_streaming_feature_extractor.js.map