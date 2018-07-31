import { StreamingFeatureExtractor } from './streaming_feature_extractor';
import { AudioUtils } from './utils/audio_utils';
export declare const audioCtx: any;
export declare class SoftStreamingFeatureExtractor extends StreamingFeatureExtractor {
    melFilterbank: Float32Array;
    scriptNode: ScriptProcessorNode;
    audioUtils: AudioUtils;
    constructor();
    extraConfig(): void;
    setup(): void;
    tearDown(): void;
    private onAudioProcess;
}
