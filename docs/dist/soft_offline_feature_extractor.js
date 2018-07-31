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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
var audio_utils_1 = require("./utils/audio_utils");
var circular_audio_buffer_1 = require("./utils/circular_audio_buffer");
var util_1 = require("./utils/util");
var SoftOfflineFeatureExtractor = (function (_super) {
    __extends(SoftOfflineFeatureExtractor, _super);
    function SoftOfflineFeatureExtractor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.targetSr = 16000;
        _this.bufferLength = 480;
        _this.melCount = 40;
        _this.hopLength = 160;
        _this.duration = 1.0;
        _this.isMfccEnabled = true;
        _this.fftSize = 512;
        _this.audioUtils = new audio_utils_1.AudioUtils();
        return _this;
    }
    SoftOfflineFeatureExtractor.prototype.config = function (params) {
        Object.assign(this, params);
        this.bufferCount = Math.floor((this.duration * this.targetSr - this.bufferLength) /
            this.hopLength) +
            1;
        if (this.hopLength > this.bufferLength) {
            console.error('Hop length must be smaller than buffer length.');
        }
        this.fftSize = util_1.nextPowerOfTwo(this.bufferLength);
        this.melFilterbank = this.audioUtils.createMelFilterbank(this.fftSize / 2 + 1, this.melCount);
        this.circularBuffer = new circular_audio_buffer_1.CircularAudioBuffer(20000);
        this.playbackBuffer = new circular_audio_buffer_1.CircularAudioBuffer(20000);
    };
    SoftOfflineFeatureExtractor.prototype.createBufferWithValues = function (audioContext, xs) {
        var bufferLen = xs.length;
        var buffer = audioContext.createBuffer(1, bufferLen, 44100);
        var channelData = buffer.getChannelData(0);
        for (var i = 0; i < xs.length; ++i) {
            channelData[i] = xs[i];
        }
        return buffer;
    };
    SoftOfflineFeatureExtractor.prototype.start = function (samples) {
        return __awaiter(this, void 0, void 0, function () {
            var audioCtx, buffer, sourceSr, lengthRes, resolved, promise;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.features = [];
                        this.images = [];
                        this.circularBuffer.clear();
                        this.playbackBuffer.clear();
                        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        return [4, audioCtx.decodeAudioData(samples.buffer)];
                    case 1:
                        buffer = _a.sent();
                        sourceSr = 44100;
                        lengthRes = (buffer.length) * this.targetSr / sourceSr;
                        this.source = new (window.OfflineAudioContext ||
                            window.webkitOfflineAudioContext)(1, lengthRes, this.targetSr);
                        this.buffer = this.source.createBufferSource();
                        this.buffer.buffer =
                            this.createBufferWithValues(this.source, buffer.getChannelData(0));
                        resolved = false;
                        promise = new Promise(function (resolve, reject) {
                            _this.source.oncomplete = function (audioProcessingEvent) {
                                var e_1, _a;
                                var audioBuffer = audioProcessingEvent.renderedBuffer;
                                _this.playbackBuffer.addBuffer(audioBuffer.getChannelData(0));
                                _this.circularBuffer.addBuffer(audioBuffer.getChannelData(0));
                                var buffers = _this.getFullBuffers();
                                try {
                                    for (var buffers_1 = __values(buffers), buffers_1_1 = buffers_1.next(); !buffers_1_1.done; buffers_1_1 = buffers_1.next()) {
                                        var buffer_1 = buffers_1_1.value;
                                        var fft = _this.audioUtils.fft(buffer_1);
                                        var fftEnergies = _this.audioUtils.fftEnergies(fft);
                                        var melEnergies = _this.audioUtils.applyFilterbank(fftEnergies, _this.melFilterbank);
                                        var mfccs = _this.audioUtils.cepstrumFromEnergySpectrum(melEnergies);
                                        _this.images.push(melEnergies);
                                        if (_this.features.length < _this.bufferCount) {
                                            if (_this.isMfccEnabled) {
                                                _this.features.push(mfccs);
                                            }
                                            else {
                                                _this.features.push(melEnergies);
                                            }
                                        }
                                        if (!resolved && _this.features.length === _this.bufferCount) {
                                            _this.audioUtils.playbackArrayBuffer(_this.playbackBuffer.getBuffer(), 16000);
                                            resolved = true;
                                            resolve(_this.features);
                                        }
                                    }
                                }
                                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                                finally {
                                    try {
                                        if (buffers_1_1 && !buffers_1_1.done && (_a = buffers_1.return)) _a.call(buffers_1);
                                    }
                                    finally { if (e_1) throw e_1.error; }
                                }
                            };
                            _this.buffer.connect(_this.source.destination);
                            _this.buffer.start();
                            _this.source.startRendering().catch(function (err) {
                                console.log('Failed to render offline audio context:', err);
                            });
                        });
                        return [2, promise];
                }
            });
        });
    };
    SoftOfflineFeatureExtractor.prototype.stop = function () {
        if (this.buffer) {
            this.buffer.stop();
        }
    };
    SoftOfflineFeatureExtractor.prototype.transform = function (data) {
        return data;
    };
    SoftOfflineFeatureExtractor.prototype.getFeatures = function () {
        return this.features;
    };
    SoftOfflineFeatureExtractor.prototype.getImages = function () {
        return this.images;
    };
    SoftOfflineFeatureExtractor.prototype.getFullBuffers = function () {
        var out = [];
        while (this.circularBuffer.getLength() >= this.bufferLength) {
            var buffer = this.circularBuffer.getBuffer(this.bufferLength);
            this.circularBuffer.popBuffer(this.hopLength);
            out.push(buffer);
        }
        console.log(out.length);
        return out;
    };
    return SoftOfflineFeatureExtractor;
}(eventemitter3_1.EventEmitter));
exports.SoftOfflineFeatureExtractor = SoftOfflineFeatureExtractor;
//# sourceMappingURL=soft_offline_feature_extractor.js.map