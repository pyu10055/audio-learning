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
Object.defineProperty(exports, "__esModule", { value: true });
var offline_feature_extractor_1 = require("./offline_feature_extractor");
var audio_utils_1 = require("./utils/audio_utils");
var NativeOfflineFeatureExtractor = (function (_super) {
    __extends(NativeOfflineFeatureExtractor, _super);
    function NativeOfflineFeatureExtractor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.fftSize = 1024;
        _this.hopLength = 444;
        _this.duration = 1.0;
        _this.isMfccEnabled = true;
        _this.audioUtils = new audio_utils_1.AudioUtils();
        _this.melFilterbank = _this.audioUtils.createMelFilterbank(_this.fftSize + 1, _this.melCount, 20, 4000, _this.targetSr);
        return _this;
    }
    NativeOfflineFeatureExtractor.prototype.preprocess = function () {
        this.features = [];
        this.images = [];
    };
    NativeOfflineFeatureExtractor.prototype.transform = function (data) {
        data = data.map(function (v) { return Math.pow(10, v / 20); });
        var melEnergies = this.audioUtils.applyFilterbank(data, this.melFilterbank);
        var mfccs = this.audioUtils.cepstrumFromEnergySpectrum(melEnergies);
        this.images.push(melEnergies);
        return this.isMfccEnabled ? mfccs : melEnergies;
    };
    NativeOfflineFeatureExtractor.prototype.getImages = function () {
        return this.images;
    };
    return NativeOfflineFeatureExtractor;
}(offline_feature_extractor_1.OfflineFeatureExtractor));
exports.NativeOfflineFeatureExtractor = NativeOfflineFeatureExtractor;
//# sourceMappingURL=native_offline_feature_extractor.js.map