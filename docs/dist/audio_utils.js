"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var DCT = require("dct");
var KissFFT = require("kissfft-js");
var util_1 = require("./util");
var SR = 16000;
var hannWindowMap = {};
var context;
var AudioUtils = (function () {
    function AudioUtils() {
        this.startIndex = 0;
        this.endIndex = 0;
        this.bandMapper = [];
    }
    AudioUtils.prototype.GetPeriodicHann = function (windowLength) {
        if (!hannWindowMap[windowLength]) {
            var window_1 = [];
            for (var i = 0; i < windowLength; ++i) {
                window_1[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / windowLength);
            }
            hannWindowMap[windowLength] = window_1;
        }
        return hannWindowMap[windowLength];
    };
    AudioUtils.prototype.fft = function (y) {
        var window = this.GetPeriodicHann(y.length);
        y = y.map(function (v, index) { return v * window[index]; });
        var fftSize = util_1.nextPowerOfTwo(y.length);
        for (var i = y.length; i < fftSize; i++) {
            y[i] = 0;
        }
        var fftr = new KissFFT.FFTR(fftSize);
        var transform = fftr.forward(y);
        fftr.dispose();
        transform[fftSize] = transform[1];
        transform[fftSize + 1] = 0;
        transform[1] = 0;
        return transform;
    };
    AudioUtils.prototype.dct = function (y) {
        var scale = Math.sqrt(2.0 / y.length);
        return DCT(y, scale);
    };
    AudioUtils.prototype.fftEnergies = function (y) {
        var out = new Float32Array(y.length / 2);
        for (var i = 0; i < y.length / 2; i++) {
            out[i] = y[i * 2] * y[i * 2] + y[i * 2 + 1] * y[i * 2 + 1];
        }
        return out;
    };
    AudioUtils.prototype.createMelFilterbank = function (fftSize, melCount, lowHz, highHz, sr) {
        if (melCount === void 0) { melCount = 40; }
        if (lowHz === void 0) { lowHz = 20; }
        if (highHz === void 0) { highHz = 4000; }
        if (sr === void 0) { sr = SR; }
        var lowMel = this.hzToMel(lowHz);
        var highMel = this.hzToMel(highHz);
        var mels = [];
        var melSpan = highMel - lowMel;
        var melSpacing = melSpan / (melCount + 1);
        for (var i = 0; i < melCount + 1; ++i) {
            mels[i] = lowMel + (melSpacing * (i + 1));
        }
        var hzPerSbin = 0.5 * sr / (fftSize - 1);
        this.startIndex = Math.floor(1.5 + (lowHz / hzPerSbin));
        this.endIndex = Math.ceil(highHz / hzPerSbin);
        this.bandMapper = [];
        var channel = 0;
        for (var i = 0; i < fftSize; ++i) {
            var melf = this.hzToMel(i * hzPerSbin);
            if ((i < this.startIndex) || (i > this.endIndex)) {
                this.bandMapper[i] = -2;
            }
            else {
                while ((mels[channel] < melf) && (channel < melCount)) {
                    ++channel;
                }
                this.bandMapper[i] = channel - 1;
            }
        }
        var weights = new Float32Array(fftSize);
        for (var i = 0; i < fftSize; ++i) {
            channel = this.bandMapper[i];
            if ((i < this.startIndex) || (i > this.endIndex)) {
                weights[i] = 0.0;
            }
            else {
                if (channel >= 0) {
                    weights[i] = (mels[channel + 1] - this.hzToMel(i * hzPerSbin)) /
                        (mels[channel + 1] - mels[channel]);
                }
                else {
                    weights[i] =
                        (mels[0] - this.hzToMel(i * hzPerSbin)) / (mels[0] - lowMel);
                }
            }
        }
        return weights;
    };
    AudioUtils.prototype.applyFilterbank = function (fftEnergies, filterbank, melCount) {
        if (melCount === void 0) { melCount = 40; }
        var out = new Float32Array(melCount);
        for (var i = this.startIndex; i <= this.endIndex; i++) {
            var specVal = Math.sqrt(fftEnergies[i]);
            var weighted = specVal * filterbank[i];
            var channel = this.bandMapper[i];
            if (channel >= 0)
                out[channel] += weighted;
            channel++;
            if (channel < melCount)
                out[channel] += (specVal - weighted);
        }
        for (var i = 0; i < out.length; ++i) {
            var val = out[i];
            if (val < 1e-12) {
                val = 1e-12;
            }
            out[i] = Math.log(val);
        }
        return out;
    };
    AudioUtils.prototype.hzToMel = function (hz) {
        return 1127.0 * Math.log(1.0 + hz / 700.0);
    };
    AudioUtils.prototype.cepstrumFromEnergySpectrum = function (melEnergies) {
        return this.dct(melEnergies);
    };
    AudioUtils.prototype.playbackArrayBuffer = function (buffer, sampleRate) {
        if (!context) {
            context = new AudioContext();
        }
        if (!sampleRate) {
            sampleRate = this.context.sampleRate;
        }
        var audioBuffer = context.createBuffer(1, buffer.length, sampleRate);
        var audioBufferData = audioBuffer.getChannelData(0);
        audioBufferData.set(buffer);
        var source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        source.start();
    };
    AudioUtils.prototype.resampleWebAudio = function (audioBuffer, targetSr) {
        var sourceSr = audioBuffer.sampleRate;
        var lengthRes = audioBuffer.length * targetSr / sourceSr;
        var offlineCtx = new OfflineAudioContext(1, lengthRes, targetSr);
        return new Promise(function (resolve, reject) {
            var bufferSource = offlineCtx.createBufferSource();
            bufferSource.buffer = audioBuffer;
            offlineCtx.oncomplete = function (event) {
                resolve(event.renderedBuffer);
            };
            bufferSource.connect(offlineCtx.destination);
            bufferSource.start();
            offlineCtx.startRendering();
        });
    };
    return AudioUtils;
}());
exports.AudioUtils = AudioUtils;
//# sourceMappingURL=audio_utils.js.map