"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var CircularAudioBuffer = (function () {
    function CircularAudioBuffer(maxLength) {
        this.buffer = new Float32Array(maxLength);
        this.currentIndex = 0;
    }
    CircularAudioBuffer.prototype.addBuffer = function (newBuffer) {
        var remaining = this.buffer.length - this.currentIndex;
        if (this.currentIndex + newBuffer.length > this.buffer.length) {
            console.error("Not enough space to write " + newBuffer.length +
                (" to this circular buffer with " + remaining + " left."));
            return;
        }
        this.buffer.set(newBuffer, this.currentIndex);
        this.currentIndex += newBuffer.length;
    };
    CircularAudioBuffer.prototype.getLength = function () {
        return this.currentIndex;
    };
    CircularAudioBuffer.prototype.getRemainingLength = function () {
        return this.buffer.length - this.currentIndex;
    };
    CircularAudioBuffer.prototype.popBuffer = function (length) {
        if (this.currentIndex < length) {
            console.error("This circular buffer doesn't have " + length + " entries in it.");
            return undefined;
        }
        if (length === 0) {
            console.warn("Calling popBuffer(0) does nothing.");
            return undefined;
        }
        var popped = this.buffer.slice(0, length);
        var remaining = this.buffer.slice(length, this.buffer.length);
        this.buffer.fill(0);
        this.buffer.set(remaining, 0);
        this.currentIndex -= length;
        return popped;
    };
    CircularAudioBuffer.prototype.getBuffer = function (length) {
        if (!length) {
            length = this.getLength();
        }
        if (this.currentIndex < length) {
            console.error("This circular buffer doesn't have " + length + " entries in it.");
            return undefined;
        }
        return this.buffer.slice(0, length);
    };
    CircularAudioBuffer.prototype.clear = function () {
        this.currentIndex = 0;
        this.buffer.fill(0);
    };
    return CircularAudioBuffer;
}());
exports.CircularAudioBuffer = CircularAudioBuffer;
//# sourceMappingURL=circular_audio_buffer.js.map