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
var audio_utils_1 = require("./audio_utils");
var util_1 = require("./util");
var INPUT_BUFFER_LENGTH = 16384;
exports.audioCtx = new AudioContext();
var StreamingFFT = (function (_super) {
    __extends(StreamingFFT, _super);
    function StreamingFFT(params) {
        var _this = _super.call(this) || this;
        var bufferLength = params.bufferLength, duration = params.duration, hopLength = params.hopLength, isMfccEnabled = params.isMfccEnabled, melCount = params.melCount, targetSr = params.targetSr, inputBufferLength = params.inputBufferLength;
        _this.bufferLength = bufferLength;
        _this.inputBufferLength = inputBufferLength || INPUT_BUFFER_LENGTH;
        _this.hopLength = hopLength;
        _this.melCount = melCount;
        _this.isMfccEnabled = isMfccEnabled;
        _this.targetSr = targetSr;
        _this.duration = duration;
        _this.hopTime = _this.hopLength * 1000 / _this.targetSr;
        _this.timer = new util_1.Interval(_this.hopTime, _this.onAudioProcess.bind(_this));
        _this.bufferCount =
            Math.floor((duration * targetSr - bufferLength) / hopLength) + 1;
        _this.melFilterbank = audio_utils_1.AudioUtils.createMelFilterbank(_this.nextPowerOfTwo(_this.bufferLength) / 2 + 1, _this.melCount, 20, 4000, _this.targetSr);
        if (hopLength > bufferLength) {
            console.error('Hop length must be smaller than buffer length.');
        }
        _this.spectrogram = [];
        _this.isStreaming = false;
        return _this;
    }
    StreamingFFT.prototype.nextPowerOfTwo = function (value) {
        var exponent = Math.ceil(Math.log2(value));
        return 1 << exponent;
    };
    StreamingFFT.prototype.getSpectrogram = function () {
        return this.spectrogram;
    };
    StreamingFFT.prototype.start = function () {
        var _this = this;
        var constraints = {
            audio: {
                'mandatory': {
                    'googEchoCancellation': 'false',
                    'googAutoGainControl': 'false',
                    'googNoiseSuppression': 'false',
                    'googHighpassFilter': 'false'
                },
            },
            video: false
        };
        navigator.mediaDevices.getUserMedia(constraints)
            .then(function (stream) {
            _this.stream = stream;
            _this.analyser = exports.audioCtx.createAnalyser();
            _this.analyser.fftSize = _this.nextPowerOfTwo(_this.bufferLength);
            _this.analyser.smoothingTimeConstant = 0;
            var source = exports.audioCtx.createMediaStreamSource(stream);
            source.connect(_this.analyser);
            _this.isStreaming = true;
            _this.timer.run();
            _this.onAudioProcess();
        });
    };
    StreamingFFT.prototype.stop = function () {
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
        this.isStreaming = false;
        this.spectrogram = [];
        if (this.timer) {
            this.timer.stop();
        }
    };
    StreamingFFT.prototype.onAudioProcess = function () {
        console.log('start', Date.now());
        var buffer = new Float32Array(this.analyser.frequencyBinCount);
        this.analyser.getFloatFrequencyData(buffer);
        buffer = buffer.map(function (v) { return Math.pow(10, v / 20) * 2000; });
        var melEnergies = audio_utils_1.AudioUtils.applyFilterbank(buffer, this.melFilterbank);
        var mfccs = audio_utils_1.AudioUtils.cepstrumFromEnergySpectrum(melEnergies);
        if (this.isMfccEnabled) {
            this.spectrogram.push(mfccs);
        }
        else {
            this.spectrogram.push(melEnergies);
        }
        console.log(this.spectrogram.length);
        if (this.spectrogram.length > this.bufferCount) {
            this.spectrogram.splice(0, 1);
        }
        if (this.spectrogram.length === this.bufferCount) {
            this.emit('update');
            this.spectrogram.splice(0, 15);
        }
        console.log('end', Date.now());
    };
    return StreamingFFT;
}(eventemitter3_1.EventEmitter));
exports.StreamingFFT = StreamingFFT;
//# sourceMappingURL=streaming_fft.js.map