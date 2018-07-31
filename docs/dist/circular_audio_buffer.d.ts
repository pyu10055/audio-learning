export declare class CircularAudioBuffer {
    buffer: Float32Array;
    currentIndex: number;
    constructor(maxLength: number);
    addBuffer(newBuffer: Float32Array): void;
    getLength(): number;
    getRemainingLength(): number;
    popBuffer(length: number): Float32Array;
    getBuffer(length?: number): Float32Array;
    clear(): void;
}
