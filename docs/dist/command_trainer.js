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
Object.defineProperty(exports, "__esModule", { value: true });
var tfjs_converter_1 = require("@tensorflow/tfjs-converter");
var tfjs_core_1 = require("@tensorflow/tfjs-core");
var eventemitter3_1 = require("eventemitter3");
var command_recognizer_1 = require("./command_recognizer");
var soft_streaming_feature_extractor_1 = require("./soft_streaming_feature_extractor");
var transfer_model_1 = require("./transfer_model");
var dataset_1 = require("./utils/dataset");
var types_1 = require("./utils/types");
var util_1 = require("./utils/util");
var CommandTrainer = (function (_super) {
    __extends(CommandTrainer, _super);
    function CommandTrainer(canvas) {
        var _this = _super.call(this) || this;
        _this.canvas = canvas;
        _this.trained = false;
        _this.withData = false;
        _this.streamFeature = new soft_streaming_feature_extractor_1.SoftStreamingFeatureExtractor();
        _this.streamFeature.config({
            inputBufferLength: 2048,
            bufferLength: 480,
            hopLength: 160,
            melCount: 40,
            targetSr: 16000,
            duration: 1,
            isMfccEnabled: types_1.IS_MFCC_ENABLED,
        });
        _this.streamFeature.on('update', _this.addSamples.bind(_this));
        _this.dataset = new dataset_1.Dataset(4);
        return _this;
    }
    CommandTrainer.prototype.load = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = this;
                        return [4, tfjs_converter_1.loadFrozenModel(command_recognizer_1.GOOGLE_CLOUD_STORAGE_DIR + command_recognizer_1.MODEL_FILE_URL, command_recognizer_1.GOOGLE_CLOUD_STORAGE_DIR + command_recognizer_1.WEIGHT_MANIFEST_FILE_URL)];
                    case 1:
                        _a.model = _b.sent();
                        this.transferModel = new transfer_model_1.TransferModel([{
                                model: this.model,
                                bottleneck: 'add_2',
                                bottleneckShape: [12],
                                output: 'labels_softmax'
                            }], this.dataset, {
                            onBatchEnd: function (batch, logs) { return __awaiter(_this, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            this.emit('loss', logs.loss.toFixed(5));
                                            return [4, tfjs_core_1.nextFrame()];
                                        case 1:
                                            _a.sent();
                                            return [2];
                                    }
                                });
                            }); }
                        });
                        return [2];
                }
            });
        });
    };
    CommandTrainer.prototype.record = function (label) {
        this.label = label;
        setTimeout(this.streamFeature.start.bind(this.streamFeature), 250);
        setTimeout(this.stopRecord.bind(this), 1500);
        this.withData = true;
    };
    CommandTrainer.prototype.train = function () {
        return __awaiter(this, void 0, void 0, function () {
            var loss, count;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        loss = Number.MAX_SAFE_INTEGER;
                        count = 0;
                        _a.label = 1;
                    case 1:
                        if (!(loss > 0.002 && count < 10)) return [3, 3];
                        return [4, this.transferModel.train()];
                    case 2:
                        loss = (_a.sent()).loss.pop();
                        count += 1;
                        return [3, 1];
                    case 3:
                        this.trained = true;
                        return [2];
                }
            });
        });
    };
    CommandTrainer.prototype.stopRecord = function () {
        this.streamFeature.stop();
        this.emit('recorded', this.dataset);
    };
    CommandTrainer.prototype.addSamples = function () {
        var spec = this.streamFeature.getFeatures();
        util_1.plotSpectrogram(this.canvas, this.streamFeature.getImages());
        var input = util_1.melSpectrogramToInput(spec);
        this.dataset.addExample(input, this.label);
    };
    return CommandTrainer;
}(eventemitter3_1.EventEmitter));
exports.CommandTrainer = CommandTrainer;
//# sourceMappingURL=command_trainer.js.map