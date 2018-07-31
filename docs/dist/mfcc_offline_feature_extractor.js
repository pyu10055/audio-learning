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
var audio_utils_1 = require("./audio_utils");
var offline_feature_extractor_1 = require("./offline_feature_extractor");
var util_1 = require("./util");
var MfccOfflineFeatureExtractor = (function (_super) {
    __extends(MfccOfflineFeatureExtractor, _super);
    function MfccOfflineFeatureExtractor() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.fftSize = 512;
        _this.hopLength = 440;
        _this.duration = 1.0;
        _this.isMfccEnabled = true;
        _this.melFilterbank = audio_utils_1.AudioUtils.createMelFilterbank(util_1.nextPowerOfTwo(_this.bufferLength) / 2 + 1, _this.melCount, 20, 4000, _this.targetSr);
        return _this;
    }
    MfccOfflineFeatureExtractor.prototype.transform = function (data) {
        data = data.map(function (v) { return Math.pow(10, v / 20) * 2000; });
        var melEnergies = audio_utils_1.AudioUtils.applyFilterbank(data, this.melFilterbank);
        var mfccs = audio_utils_1.AudioUtils.cepstrumFromEnergySpectrum(melEnergies);
        return this.isMfccEnabled ? mfccs : melEnergies;
    };
    return MfccOfflineFeatureExtractor;
}(offline_feature_extractor_1.OfflineFeatureExtractor));
exports.MfccOfflineFeatureExtractor = MfccOfflineFeatureExtractor;
//# sourceMappingURL=mfcc_offline_feature_extractor.js.map