import { StreamingFeatureExtractor } from './streaming_feature_extractor';
import { AudioUtils } from './utils/audio_utils';
export declare const audioCtx: any;
export declare class NativeStreamingFeatureExtractor extends StreamingFeatureExtractor {
    hopTime: number;
    melFilterbank: Float32Array;
    analyser: AnalyserNode;
    timer: any;
    audioUtils: AudioUtils;
    extraConfig(): void;
    setup(): void;
    tearDown(): void;
    private onAudioProcess;
}
