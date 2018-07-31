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
Object.defineProperty(exports, "__esModule", { value: true });
var tfjs_1 = require("@tensorflow/tfjs");
var command_recognizer_1 = require("./command_recognizer");
var native_offline_feature_extractor_1 = require("./native_offline_feature_extractor");
var offline_feature_extractor_1 = require("./offline_feature_extractor");
var soft_offline_feature_extractor_1 = require("./soft_offline_feature_extractor");
var types_1 = require("./utils/types");
var util_1 = require("./utils/util");
exports.EVENT_NAME = 'update';
exports.MIN_SCORE = 0.6;
var ModelEvaluation = (function () {
    function ModelEvaluation(canvas, params) {
        this.canvas = canvas;
        this.targetSr = 44100;
        this.bufferLength = 1024;
        this.melCount = 360;
        this.hopLength = 1024;
        this.duration = 1.0;
        this.isMfccEnabled = true;
        Object.assign(this, params);
    }
    ModelEvaluation.prototype.load = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = this;
                        return [4, tfjs_1.loadFrozenModel(command_recognizer_1.GOOGLE_CLOUD_STORAGE_DIR + command_recognizer_1.MODEL_FILE_URL, command_recognizer_1.GOOGLE_CLOUD_STORAGE_DIR + command_recognizer_1.WEIGHT_MANIFEST_FILE_URL)];
                    case 1:
                        _a.frozenModel = _c.sent();
                        _b = this;
                        return [4, tfjs_1.loadModel(command_recognizer_1.GOOGLE_CLOUD_STORAGE_DIR + command_recognizer_1.TF_MODEL_FILE_URL)];
                    case 2:
                        _b.tfModel =
                            _c.sent();
                        types_1.MODELS[types_1.ModelType.FROZEN_MODEL] = this.frozenModel;
                        types_1.MODELS[types_1.ModelType.TF_MODEL] = this.tfModel;
                        types_1.MODELS[types_1.ModelType.FROZEN_MODEL_NATIVE] = this.frozenModel;
                        return [2];
                }
            });
        });
    };
    ModelEvaluation.prototype.eval = function (modelType, files, labels) {
        return __awaiter(this, void 0, void 0, function () {
            var prediction, i, recordingFile, _a, _b, correct;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        prediction = [];
                        switch (modelType) {
                            case types_1.ModelType.TF_MODEL:
                                this.model = this.tfModel;
                                this.featureExtractor = new offline_feature_extractor_1.OfflineFeatureExtractor();
                                break;
                            case types_1.ModelType.FROZEN_MODEL:
                                this.model = this.frozenModel;
                                this.featureExtractor = new soft_offline_feature_extractor_1.SoftOfflineFeatureExtractor();
                                break;
                            default:
                                this.model = this.frozenModel;
                                this.featureExtractor = new native_offline_feature_extractor_1.NativeOfflineFeatureExtractor();
                        }
                        i = 0;
                        _c.label = 1;
                    case 1:
                        if (!(i < files.length)) return [3, 4];
                        recordingFile = files[i];
                        _b = (_a = prediction).push;
                        return [4, this.evalFile(recordingFile, this.featureExtractor)];
                    case 2:
                        _b.apply(_a, [_c.sent()]);
                        _c.label = 3;
                    case 3:
                        i++;
                        return [3, 1];
                    case 4:
                        util_1.plotSpectrogram(this.canvas, this.featureExtractor.getImages());
                        correct = prediction.reduce(function (prev, curr, index) {
                            prev += (curr[0] === labels[index] && curr[1] > exports.MIN_SCORE ? 1.0 : 0.0);
                            return prev;
                        }, 0.0);
                        console.log('correctly predicted: ', correct);
                        return [2, prediction];
                }
            });
        });
    };
    ModelEvaluation.prototype.evalFile = function (file, extractor) {
        var _this = this;
        var temporaryFileReader = new FileReader();
        return new Promise(function (resolve, reject) {
            temporaryFileReader.onerror = function () {
                temporaryFileReader.abort();
                reject(new DOMException('Problem parsing input file.'));
            };
            temporaryFileReader.onload = function () { return __awaiter(_this, void 0, void 0, function () {
                var success, data, i, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            extractor.config({});
                            success = false;
                            data = new Float32Array(temporaryFileReader.result);
                            i = 0;
                            _a.label = 1;
                        case 1:
                            if (!(i < 10 && !success)) return [3, 6];
                            _a.label = 2;
                        case 2:
                            _a.trys.push([2, 4, , 5]);
                            return [4, extractor.start(data)];
                        case 3:
                            _a.sent();
                            extractor.stop();
                            success = true;
                            return [3, 5];
                        case 4:
                            error_1 = _a.sent();
                            extractor.stop();
                            console.log('retry file ' + file.name, error_1);
                            return [3, 5];
                        case 5:
                            i++;
                            return [3, 1];
                        case 6:
                            resolve(this.runPrediction(extractor.getFeatures()));
                            return [2];
                    }
                });
            }); };
            temporaryFileReader.readAsArrayBuffer(file);
        });
    };
    ModelEvaluation.prototype.featuresToInput = function (spec) {
        var times = spec.length;
        var freqs = spec[0].length;
        var data = new Float32Array(times * freqs);
        for (var i = 0; i < times; i++) {
            var mel = spec[i];
            var offset = i * freqs;
            data.set(mel, offset);
        }
        var shape = [1, times, freqs, 1];
        return tfjs_1.tensor4d(data, shape);
    };
    ModelEvaluation.prototype.runPrediction = function (dataArray) {
        if (this.model == null) {
            throw new Error('Model is not set yet');
        }
        dataArray.forEach(function (array, i) {
            array.forEach(function (v, index) {
                if (v === -Infinity)
                    console.log(i, index);
            });
        });
        var unnormalized = this.featuresToInput(dataArray);
        var normalized = util_1.normalize(unnormalized);
        var predictOutTensor;
        if (this.model instanceof tfjs_1.FrozenModel) {
            predictOutTensor = this.model.predict(unnormalized);
        }
        else {
            predictOutTensor = this.model.predict(normalized);
        }
        var predictOut = predictOutTensor.dataSync();
        predictOutTensor.dispose();
        console.log(predictOut);
        var maxScore = -Infinity;
        var winnerIndex = -1;
        predictOut.forEach(function (score, index) {
            if (score > maxScore) {
                maxScore = score;
                winnerIndex = index;
            }
        });
        return [winnerIndex, maxScore];
    };
    return ModelEvaluation;
}());
exports.ModelEvaluation = ModelEvaluation;
//# sourceMappingURL=model_evaluation.js.map