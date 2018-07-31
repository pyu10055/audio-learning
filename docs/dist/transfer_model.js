"use strict";
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
var LEARNING_RATE = 0.001;
var BATCH_SIZE_FRACTION = 0.5;
var EPOCHS = 20;
var TransferModel = (function () {
    function TransferModel(configs, dataset, trainCallback) {
        this.configs = configs;
        this.dataset = dataset;
        this.trainCallback = trainCallback;
        this.outputs = [];
        this.inputs = [];
        this.model = tf.sequential({
            layers: [
                tf.layers.dense({
                    units: 10,
                    activation: 'relu',
                    kernelInitializer: 'varianceScaling',
                    useBias: true,
                    inputShape: this.configs.reduce(function (shape, config) {
                        config.bottleneckShape.forEach(function (dim, index) { return shape[index] =
                            !!shape[index] ? shape[index] + dim : dim; });
                        return shape;
                    }, [])
                }),
                tf.layers.dense({
                    units: dataset.numClasses,
                    kernelInitializer: 'varianceScaling',
                    useBias: false,
                    activation: 'softmax'
                })
            ]
        });
    }
    TransferModel.prototype.features = function (input) {
        var _this = this;
        input = input instanceof Array ? input : [input];
        return tf.tidy(function () {
            var activations = _this.configs.map(function (config, index) { return config.model.execute(input[index], config.bottleneck); });
            return tf.concat2d(activations, 1);
        });
    };
    TransferModel.prototype.activation = function (input) {
        var _this = this;
        input = input instanceof Array ? input : [input];
        return tf.tidy(function () {
            var activations = _this.configs.map(function (config, index) { return config.model.execute(input[index], [config.bottleneck, config.output].filter(function (n) { return n != null; })); });
            var features = activations.map(function (activation) { return Array.isArray(activation) ? activation[0] : activation; });
            var outputs = activations.map(function (activation) { return activation[1]; })
                .filter(function (n) { return n != null; });
            return outputs.length > 0 ?
                [
                    tf.concat2d(features, 1),
                    tf.concat2d(outputs, 1)
                ] :
                [tf.concat2d(features, 1)];
        });
    };
    TransferModel.prototype.train = function () {
        return __awaiter(this, void 0, void 0, function () {
            var optimizer, batchSize;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.dataset.xs == null) {
                            throw new Error('Add some examples before training!');
                        }
                        optimizer = tf.train.adam(LEARNING_RATE);
                        this.model.compile({ optimizer: optimizer, loss: 'categoricalCrossentropy' });
                        batchSize = Math.floor(this.dataset.xs[0].shape[0] * BATCH_SIZE_FRACTION);
                        if (!(batchSize > 0)) {
                            throw new Error("Batch size is 0 or NaN. Please choose a non-zero fraction.");
                        }
                        return [4, this.model.fit(this.features(this.dataset.xs), this.dataset.ys, { batchSize: batchSize, epochs: EPOCHS, callbacks: this.trainCallback })];
                    case 1: return [2, (_a.sent())
                            .history];
                }
            });
        });
    };
    TransferModel.prototype.predict = function (input, config) {
        var _this = this;
        var predictedClass = tf.tidy(function () {
            var _a = __read(_this.activation(input), 2), features = _a[0], outputs = _a[1];
            var predictions = _this.model.predict(features);
            return [outputs, predictions.softmax()];
        });
        return predictedClass;
    };
    TransferModel.prototype.execute = function (inputs, outputs) {
        throw new Error('Method not implemented.');
    };
    return TransferModel;
}());
exports.TransferModel = TransferModel;
//# sourceMappingURL=transfer_model.js.map