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
var util_1 = require("./utils/util");
var util_2 = require("./utils/util");
exports.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var LayerStreamingFeatureExtractor = (function (_super) {
    __extends(LayerStreamingFeatureExtractor, _super);
    function LayerStreamingFeatureExtractor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.fftSize = 360;
        return _this;
    }
    LayerStreamingFeatureExtractor.prototype.extraConfig = function () {
        this.hopTime = this.hopLength * 1000 / this.targetSr;
        this.timer = new util_1.Interval(this.hopTime, this.onAudioProcess.bind(this));
    };
    LayerStreamingFeatureExtractor.prototype.setup = function () {
        this.analyser = exports.audioCtx.createAnalyser();
        this.analyser.fftSize = util_2.nextPowerOfTwo(this.bufferLength) * 2;
        this.analyser.smoothingTimeConstant = 0;
        var source = exports.audioCtx.createMediaStreamSource(this.stream);
        source.connect(this.analyser);
        this.isStreaming = true;
        this.timer.run();
        this.onAudioProcess();
    };
    LayerStreamingFeatureExtractor.prototype.tearDown = function () {
        if (this.timer) {
            this.timer.stop();
        }
    };
    LayerStreamingFeatureExtractor.prototype.onAudioProcess = function () {
        var buffer = new Float32Array(this.fftSize);
        this.analyser.getFloatFrequencyData(buffer);
        this.spectrogram.push(buffer);
        this.images.push(buffer);
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
    return LayerStreamingFeatureExtractor;
}(streaming_feature_extractor_1.StreamingFeatureExtractor));
exports.LayerStreamingFeatureExtractor = LayerStreamingFeatureExtractor;
//# sourceMappingURL=layer_streaming_feature_extractor.js.map