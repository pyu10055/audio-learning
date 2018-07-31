import * as d3 from 'd3';
export declare class Spectrogram {
    running: boolean;
    analyser: AnalyserNode;
    svgHeight: number;
    svgWidth: number;
    svg: d3.Selection<d3.BaseType, {}, HTMLElement, Uint8Array>;
    frequencyData: Uint8Array;
    animationFrameId: number;
    lastRenderTime: number;
    constructor(domId: string);
    start(): void;
    stop(): void;
    renderChart(): void;
}
