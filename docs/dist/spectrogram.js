"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var d3 = require("d3");
var soft_streaming_feature_extractor_1 = require("./soft_streaming_feature_extractor");
var Spectrogram = (function () {
    function Spectrogram(domId) {
        this.running = false;
        this.svgHeight = 100;
        this.svgWidth = 800;
        this.svg = d3.select(domId)
            .append('svg')
            .attr('preserveAspectRatio', 'xMinYMin meet')
            .attr('viewBox', '0 0 800 100')
            .classed('svg-content', true);
        this.analyser = soft_streaming_feature_extractor_1.audioCtx.createAnalyser();
        this.analyser.fftSize = 2048;
        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    }
    Spectrogram.prototype.start = function () {
        var _this = this;
        if (!this.running) {
            this.running = true;
            if (navigator.mediaDevices.getUserMedia) {
                var constraints = { audio: true };
                navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
                    var source = soft_streaming_feature_extractor_1.audioCtx.createMediaStreamSource(stream);
                    source.connect(_this.analyser);
                    _this.animationFrameId =
                        requestAnimationFrame(_this.renderChart.bind(_this));
                    d3.select(self.frameElement).style('height', _this.svgHeight + " px");
                });
            }
            else {
                console.log('getUserMedia not supported on your browser!');
            }
        }
    };
    Spectrogram.prototype.stop = function () {
        this.running = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    };
    Spectrogram.prototype.renderChart = function () {
        var _this = this;
        this.animationFrameId = requestAnimationFrame(this.renderChart.bind(this));
        if (!!this.lastRenderTime && Date.now() - this.lastRenderTime < 100) {
            return;
        }
        if (this.running) {
            this.analyser.getByteFrequencyData(this.frequencyData);
        }
        var heightScale = d3.scaleLinear().domain([0, d3.max(this.frequencyData)]).range([
            0, this.svgHeight - 10
        ]);
        var hueScale = d3.scaleLinear().domain([0, d3.max(this.frequencyData)]).range([
            0, 360
        ]);
        var rects = this.svg.selectAll('rect').data(Array.prototype.slice.call(this.frequencyData));
        rects.enter().append('rect');
        rects.attr('width', function () { return _this.svgWidth / _this.frequencyData.length; })
            .attr('height', function (d) { return heightScale(d); })
            .attr('x', function (d, i) {
            return i * _this.svgWidth / _this.frequencyData.length;
        })
            .attr('y', function (d) { return _this.svgHeight - heightScale(d); })
            .attr('fill', 'None')
            .attr('stroke-width', 4)
            .attr('stroke-opacity', 0.4)
            .attr('stroke', function (d) { return d3.hsl(hueScale(d), 1, 0.5).toString(); });
        rects.exit().remove();
        this.lastRenderTime = Date.now();
    };
    return Spectrogram;
}());
exports.Spectrogram = Spectrogram;
//# sourceMappingURL=spectrogram.js.map