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
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
Object.defineProperty(exports, "__esModule", { value: true });
var eventemitter3_1 = require("eventemitter3");
var circular_audio_buffer_1 = require("./utils/circular_audio_buffer");
var types_1 = require("./utils/types");
exports.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var StreamingFeatureExtractor = (function (_super) {
    __extends(StreamingFeatureExtractor, _super);
    function StreamingFeatureExtractor() {
        var _this = _super.call(this) || this;
        _this.inputBufferLength = types_1.BUFFER_LENGTH * 4;
        _this.targetSr = types_1.EXAMPLE_SR;
        _this.bufferLength = types_1.BUFFER_LENGTH;
        _this.melCount = types_1.MEL_COUNT;
        _this.hopLength = types_1.HOP_LENGTH;
        _this.duration = types_1.DURATION;
        _this.isMfccEnabled = types_1.IS_MFCC_ENABLED;
        return _this;
    }
    StreamingFeatureExtractor.prototype.config = function (params) {
        Object.assign(this, params);
        this.bufferCount = Math.floor((this.duration * this.targetSr - this.bufferLength) /
            this.hopLength) +
            1;
        if (this.hopLength > this.bufferLength) {
            console.error('Hop length must be smaller than buffer length.');
        }
        this.spectrogram = [];
        this.images = [];
        this.isStreaming = false;
        var nativeSr = exports.audioCtx.sampleRate;
        var resampledBufferLength = Math.max(this.bufferLength, this.inputBufferLength) *
            (this.targetSr / nativeSr) * 4;
        this.circularBuffer = new circular_audio_buffer_1.CircularAudioBuffer(resampledBufferLength);
        this.extraConfig();
    };
    StreamingFeatureExtractor.prototype.getFeatures = function () {
        return this.spectrogram;
    };
    StreamingFeatureExtractor.prototype.getImages = function () {
        return this.images;
    };
    StreamingFeatureExtractor.prototype.start = function () {
        var _this = this;
        this.circularBuffer.clear();
        var constraints = { audio: true };
        navigator.mediaDevices.getUserMedia(constraints)
            .then(function (stream) {
            _this.stream = stream;
            _this.setup();
            _this.isStreaming = true;
        });
    };
    StreamingFeatureExtractor.prototype.stop = function () {
        var e_1, _a;
        if (this.stream) {
            try {
                for (var _b = __values(this.stream.getTracks()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var track = _c.value;
                    track.stop();
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        this.tearDown();
        this.isStreaming = false;
    };
    StreamingFeatureExtractor.prototype.getFullBuffers = function () {
        var out = [];
        while (this.circularBuffer.getLength() > this.bufferLength) {
            var buffer = this.circularBuffer.getBuffer(this.bufferLength);
            this.circularBuffer.popBuffer(this.hopLength);
            out.push(buffer);
        }
        return out;
    };
    return StreamingFeatureExtractor;
}(eventemitter3_1.EventEmitter));
exports.StreamingFeatureExtractor = StreamingFeatureExtractor;
//# sourceMappingURL=streaming_feature_extractor.js.map