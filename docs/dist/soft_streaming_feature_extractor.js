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
var streaming_feature_extractor_1 = require("./streaming_feature_extractor");
var audio_utils_1 = require("./utils/audio_utils");
var util_1 = require("./utils/util");
exports.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var SoftStreamingFeatureExtractor = (function (_super) {
    __extends(SoftStreamingFeatureExtractor, _super);
    function SoftStreamingFeatureExtractor() {
        var _this = _super.call(this) || this;
        _this.audioUtils = new audio_utils_1.AudioUtils();
        return _this;
    }
    SoftStreamingFeatureExtractor.prototype.extraConfig = function () {
        var fftSize = util_1.nextPowerOfTwo(this.bufferLength);
        this.melFilterbank =
            this.audioUtils.createMelFilterbank(fftSize / 2 + 1, this.melCount);
    };
    SoftStreamingFeatureExtractor.prototype.setup = function () {
        this.scriptNode =
            exports.audioCtx.createScriptProcessor(this.inputBufferLength, 1, 1);
        var source = exports.audioCtx.createMediaStreamSource(this.stream);
        source.connect(this.scriptNode);
        this.scriptNode.connect(exports.audioCtx.destination);
        this.scriptNode.onaudioprocess = this.onAudioProcess.bind(this);
    };
    SoftStreamingFeatureExtractor.prototype.tearDown = function () {
        if (this.scriptNode) {
            this.scriptNode.disconnect(exports.audioCtx.destination);
        }
        this.scriptNode = null;
        this.stream = null;
    };
    SoftStreamingFeatureExtractor.prototype.onAudioProcess = function (audioProcessingEvent) {
        return __awaiter(this, void 0, void 0, function () {
            var e_1, _a, audioBuffer, audioBufferRes, bufferRes, buffers, buffers_1, buffers_1_1, buffer, fft, fftEnergies, melEnergies, mfccs;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        audioBuffer = audioProcessingEvent.inputBuffer;
                        return [4, this.audioUtils.resampleWebAudio(audioBuffer, this.targetSr)];
                    case 1:
                        audioBufferRes = _b.sent();
                        bufferRes = audioBufferRes.getChannelData(0);
                        this.circularBuffer.addBuffer(bufferRes);
                        buffers = this.getFullBuffers();
                        if (buffers.length > 0) {
                        }
                        try {
                            for (buffers_1 = __values(buffers), buffers_1_1 = buffers_1.next(); !buffers_1_1.done; buffers_1_1 = buffers_1.next()) {
                                buffer = buffers_1_1.value;
                                fft = this.audioUtils.fft(buffer);
                                fftEnergies = this.audioUtils.fftEnergies(fft);
                                melEnergies = this.audioUtils.applyFilterbank(fftEnergies, this.melFilterbank);
                                this.images.push(melEnergies);
                                mfccs = this.audioUtils.cepstrumFromEnergySpectrum(melEnergies);
                                if (this.isMfccEnabled) {
                                    this.spectrogram.push(mfccs);
                                }
                                else {
                                    this.spectrogram.push(melEnergies);
                                }
                                if (this.spectrogram.length > this.bufferCount) {
                                    this.spectrogram.splice(0, 1);
                                    this.images.splice(0, 1);
                                }
                                if (this.spectrogram.length === this.bufferCount) {
                                    this.emit('update');
                                    this.spectrogram.splice(0, 20);
                                    this.images.splice(0, 20);
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
                        return [2];
                }
            });
        });
    };
    return SoftStreamingFeatureExtractor;
}(streaming_feature_extractor_1.StreamingFeatureExtractor));
exports.SoftStreamingFeatureExtractor = SoftStreamingFeatureExtractor;
//# sourceMappingURL=soft_streaming_feature_extractor.js.map