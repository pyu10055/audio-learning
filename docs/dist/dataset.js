"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var tf = require("@tensorflow/tfjs");
var Dataset = (function () {
    function Dataset(numClasses) {
        this.numClasses = numClasses;
    }
    Dataset.prototype.addExamples = function (examples, labels) {
        if (this.xs == null) {
            this.xs = [tf.keep(examples)];
            this.ys = tf.keep(labels);
        }
        else {
            var oldX = this.xs;
            this.xs[0] = tf.keep(this.xs[0].concat(examples, 0));
            var oldY = this.ys;
            this.ys = tf.keep(oldY.concat(labels, 0));
            oldX.forEach(function (tensor) { return tensor.dispose(); });
            oldY.dispose();
        }
    };
    Dataset.prototype.addExample = function (example, label) {
        var _this = this;
        example = Array.isArray(example) ? example : [example];
        var y = tf.tidy(function () { return tf.oneHot(tf.tensor1d([label]).toInt(), _this.numClasses); });
        if (this.xs == null) {
            this.xs = example.map(function (tensor) { return tf.keep(tensor); });
            this.ys = tf.keep(y);
        }
        else {
            var oldX = this.xs;
            this.xs = example.map(function (tensor, index) { return tf.keep(_this.xs[index].concat(tensor, 0)); });
            var oldY = this.ys;
            this.ys = tf.keep(oldY.concat(y, 0));
            oldX.forEach(function (tensor) { return tensor.dispose(); });
            oldY.dispose();
            y.dispose();
        }
    };
    return Dataset;
}());
exports.Dataset = Dataset;
//# sourceMappingURL=dataset.js.map