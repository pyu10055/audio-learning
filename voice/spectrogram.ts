import * as d3 from 'd3';
import {audioCtx} from './streaming_feature_extractor';
export class Spectrogram {
  running = false;
  analyser: AnalyserNode;
  svgHeight = 100;
  svgWidth = 800;
  svg: d3.Selection<d3.BaseType, {}, HTMLElement, Uint8Array>;
  frequencyData: Uint8Array;
  animationFrameId: number;
  lastRenderTime: number;
  constructor(domId: string) {
    this.svg = d3.select(domId)
                   .append('svg')
                   .attr('preserveAspectRatio', 'xMinYMin meet')
                   .attr('viewBox', '0 0 800 100')
                   .classed('svg-content', true);
    this.analyser = audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    // const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
  }

  start() {
    if (!this.running) {
      this.running = true;
      if (navigator.mediaDevices.getUserMedia) {
        const constraints = {audio: true};
        navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(this.analyser);
          this.animationFrameId =
              requestAnimationFrame(this.renderChart.bind(this));
          // just for blocks viewer size
          d3.select(self.frameElement).style('height', this.svgHeight + 'px');
        });
      } else {
        console.log('getUserMedia not supported on your browser!');
      }
    }
  }

  stop() {
    this.running = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
  // continuously loop and update chart with frequency data.
  renderChart() {
    this.animationFrameId = requestAnimationFrame(this.renderChart.bind(this));
    if (!!this.lastRenderTime && Date.now() - this.lastRenderTime < 100) {
      return;
    }
    // copy frequency data to frequencyData array.
    if (this.running) {
      this.analyser.getByteFrequencyData(this.frequencyData);
    }

    // scale things to fit
    const heightScale =
        d3.scaleLinear().domain([0, d3.max(this.frequencyData)]).range([
          0, this.svgHeight - 10
        ]);

    const hueScale =
        d3.scaleLinear().domain([0, d3.max(this.frequencyData)]).range([
          0, 360
        ]);

    // update d3 chart with new data
    const rects = this.svg.selectAll('rect').data(this.frequencyData);

    rects.enter().append('rect');

    rects.attr('width', () => this.svgWidth / this.frequencyData.length)
        .attr('height', d => heightScale(d))
        .attr('x', (d, i) => i * this.svgWidth / this.frequencyData.length)
        .attr('y', d => this.svgHeight - heightScale(d))
        .attr('fill', 'None')
        .attr('stroke-width', 4)
        .attr('stroke-opacity', 0.4)
        .attr('stroke', d => d3.hsl(hueScale(d), 1, 0.5));

    rects.exit().remove();
    this.lastRenderTime = Date.now();
  }
}
