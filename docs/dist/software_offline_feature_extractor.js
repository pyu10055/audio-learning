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
var fft_js_1 = require("fft-js");
var mfcc_1 = require("mfcc");
var audio_utils_1 = require("./audio_utils");
var circular_audio_buffer_1 = require("./circular_audio_buffer");
var util_1 = require("./util");
var SoftwareOfflineFeatureExtractor = (function (_super) {
    __extends(SoftwareOfflineFeatureExtractor, _super);
    function SoftwareOfflineFeatureExtractor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.targetSr = 16000;
        _this.bufferLength = 480;
        _this.melCount = 40;
        _this.hopLength = 160;
        _this.duration = 1.0;
        _this.isMfccEnabled = true;
        _this.fftSize = 512;
        return _this;
    }
    SoftwareOfflineFeatureExtractor.prototype.config = function (params) {
        Object.assign(this, params);
        this.bufferCount = Math.floor((this.duration * this.targetSr - this.bufferLength) /
            this.hopLength) +
            1;
        if (this.hopLength > this.bufferLength) {
            console.error('Hop length must be smaller than buffer length.');
        }
        this.fftSize = util_1.nextPowerOfTwo(this.bufferLength);
        this.melFilterbank =
            audio_utils_1.AudioUtils.createMelFilterbank(this.fftSize / 2 + 1, this.melCount);
        this.circularBuffer = new circular_audio_buffer_1.CircularAudioBuffer(4096);
    };
    SoftwareOfflineFeatureExtractor.prototype.createBufferWithValues = function (audioContext, xs) {
        var bufferLen = xs.length + 2048;
        var buffer = audioContext.createBuffer(1, bufferLen, 44100);
        var channelData = buffer.getChannelData(0);
        for (var i = 0; i < xs.length; ++i) {
            channelData[i] = xs[i];
        }
        for (var i = xs.length; i < bufferLen; ++i) {
            channelData[1] = Math.random();
        }
        return buffer;
    };
    SoftwareOfflineFeatureExtractor.prototype.start = function (samples) {
        return __awaiter(this, void 0, void 0, function () {
            var sourceSr, lengthRes, promise;
            var _this = this;
            return __generator(this, function (_a) {
                this.features = [];
                this.circularBuffer.clear();
                sourceSr = 44100;
                lengthRes = (samples.length + 2048) * this.targetSr / sourceSr;
                this.source = new OfflineAudioContext(1, lengthRes, this.targetSr);
                this.buffer = this.source.createBufferSource();
                this.buffer.buffer = this.createBufferWithValues(this.source, samples);
                this.scriptNode = this.source.createScriptProcessor(2048, 1, 1);
                this.buffer.connect(this.scriptNode);
                this.scriptNode.connect(this.source.destination);
                promise = new Promise(function (resolve, reject) {
                    _this.scriptNode.onaudioprocess = function (audioProcessingEvent) {
                        var e_1, _a;
                        var audioBuffer = audioProcessingEvent.inputBuffer;
                        _this.circularBuffer.addBuffer(audioBuffer.getChannelData(0));
                        var buffers = _this.getFullBuffers();
                        try {
                            for (var buffers_1 = __values(buffers), buffers_1_1 = buffers_1.next(); !buffers_1_1.done; buffers_1_1 = buffers_1.next()) {
                                var buffer = buffers_1_1.value;
                                var phasors = fft_js_1.fft.fft(buffer);
                                var mags = fft_js_1.fft.util.fftMag(phasors);
                                var mfcc = mfcc_1.MFCC.construct(_this.fftSize, _this.melCount, 20, 4000, _this.targetSr);
                                if (_this.features.length < _this.bufferCount) {
                                    _this.features.push(mfcc(mags));
                                }
                                if (_this.features.length === _this.bufferCount) {
                                    console.log('resolve');
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
                });
                this.buffer.start();
                this.source.startRendering().catch(function (err) {
                    console.log('Failed to render offline audio context:', err);
                });
                return [2, promise];
            });
        });
    };
    SoftwareOfflineFeatureExtractor.prototype.stop = function () {
        this.scriptNode.disconnect(this.source.destination);
        this.buffer.stop();
    };
    SoftwareOfflineFeatureExtractor.prototype.transform = function (data) {
        return data;
    };
    SoftwareOfflineFeatureExtractor.prototype.getFeatures = function () {
        return this.features;
    };
    SoftwareOfflineFeatureExtractor.prototype.getFullBuffers = function () {
        var out = [];
        while (this.circularBuffer.getLength() > this.bufferLength) {
            var buffer = this.circularBuffer.getBuffer(this.bufferLength);
            this.circularBuffer.popBuffer(this.hopLength);
            out.push(buffer);
        }
        return out;
    };
    return SoftwareOfflineFeatureExtractor;
}(eventemitter3_1.EventEmitter));
exports.SoftwareOfflineFeatureExtractor = SoftwareOfflineFeatureExtractor;
//# sourceMappingURL=software_offline_feature_extractor.js.map