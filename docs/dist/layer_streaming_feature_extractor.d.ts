import { StreamingFeatureExtractor } from './streaming_feature_extractor';
export declare const audioCtx: any;
export declare class LayerStreamingFeatureExtractor extends StreamingFeatureExtractor {
    fftSize: number;
    hopTime: number;
    analyser: AnalyserNode;
    timer: any;
    extraConfig(): void;
    setup(): void;
    tearDown(): void;
    private onAudioProcess;
}
