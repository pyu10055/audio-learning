export declare class AudioUtils {
    startIndex: number;
    endIndex: number;
    bandMapper: number[];
    context: AudioContext;
    constructor();
    GetPeriodicHann(windowLength: number): number[];
    fft(y: Float32Array): any;
    dct(y: Float32Array): any;
    fftEnergies(y: Float32Array): Float32Array;
    createMelFilterbank(fftSize: number, melCount?: number, lowHz?: number, highHz?: number, sr?: number): Float32Array;
    applyFilterbank(fftEnergies: Float32Array, filterbank: Float32Array, melCount?: number): Float32Array;
    hzToMel(hz: number): number;
    cepstrumFromEnergySpectrum(melEnergies: Float32Array): any;
    playbackArrayBuffer(buffer: Float32Array, sampleRate?: number): void;
    resampleWebAudio(audioBuffer: AudioBuffer, targetSr: number): Promise<AudioBuffer>;
}
