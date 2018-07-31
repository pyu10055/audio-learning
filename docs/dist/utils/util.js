"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var tf = require("@tensorflow/tfjs");
function labelArrayToString(label, allLabels) {
    var _a = __read(argmax(label), 1), ind = _a[0];
    return allLabels[ind];
}
exports.labelArrayToString = labelArrayToString;
function argmax(array) {
    var max = -Infinity;
    var argmax = -1;
    for (var i = 0; i < array.length; i++) {
        if (array[i] > max) {
            max = array[i];
            argmax = i;
        }
    }
    return [argmax, max];
}
exports.argmax = argmax;
function getParameterByName(name, url) {
    if (!url)
        url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'), results = regex.exec(url);
    if (!results)
        return null;
    if (!results[2])
        return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
exports.getParameterByName = getParameterByName;
var Interval = (function () {
    function Interval(duration, fn) {
        this.duration = duration;
        this.fn = fn;
        this.baseline = undefined;
    }
    Interval.prototype.run = function () {
        if (this.baseline == null) {
            this.baseline = Date.now();
        }
        this.fn();
        var end = Date.now();
        this.baseline += this.duration;
        var nextTick = this.duration - (end - this.baseline);
        if (nextTick < 0) {
            nextTick = 0;
        }
        this.timer = setTimeout(this.run.bind(this), nextTick);
    };
    Interval.prototype.stop = function () {
        clearTimeout(this.timer);
    };
    return Interval;
}());
exports.Interval = Interval;
function normalize(x) {
    return tf.tidy(function () {
        var mean = tf.mean(x);
        mean.print();
        var std = tf.sqrt(tf.mean(tf.square(tf.add(x, tf.neg(mean)))));
        return tf.div(tf.add(x, tf.neg(mean)), std);
    });
}
exports.normalize = normalize;
function nextPowerOfTwo(value) {
    var exponent = Math.ceil(Math.log2(value));
    return 1 << exponent;
}
exports.nextPowerOfTwo = nextPowerOfTwo;
function plotSpectrogram(canvas, frequencyData) {
    var min = Infinity;
    var max = -Infinity;
    for (var i = 0; i < frequencyData.length; ++i) {
        var x = frequencyData[i];
        for (var j = 1; j < x.length; ++j) {
            if (x[j] !== -Infinity) {
                if (x[j] < min) {
                    min = x[j];
                }
                if (x[j] > max) {
                    max = x[j];
                }
            }
        }
    }
    if (min >= max) {
        return;
    }
    var ctx = canvas.getContext('2d');
    var numTimeSteps = frequencyData.length;
    var pixelWidth = canvas.width / numTimeSteps;
    var pixelHeight = canvas.height / (frequencyData[0].length - 1);
    for (var i = 0; i < numTimeSteps; ++i) {
        var x = pixelWidth * i;
        var spectrum = frequencyData[i];
        if (spectrum[0] === -Infinity) {
            break;
        }
        for (var j = 1; j < frequencyData[0].length; ++j) {
            var y = canvas.height - (j + 1) * pixelHeight;
            var colorValue = (spectrum[j] - min) / (max - min);
            colorValue = Math.round(255 * colorValue);
            var fillStyle = "rgb(" + colorValue + "," + colorValue + "," + colorValue + ")";
            ctx.fillStyle = fillStyle;
            ctx.fillRect(x, y, pixelWidth, pixelHeight);
        }
    }
}
exports.plotSpectrogram = plotSpectrogram;
function melSpectrogramToInput(spec) {
    var times = spec.length;
    var freqs = spec[0].length;
    var data = new Float32Array(times * freqs);
    for (var i = 0; i < times; i++) {
        var mel = spec[i];
        var offset = i * freqs;
        data.set(mel, offset);
    }
    var shape = [1, times, freqs, 1];
    return tf.tensor4d(Array.prototype.slice.call(data), shape);
}
exports.melSpectrogramToInput = melSpectrogramToInput;
//# sourceMappingURL=util.js.map