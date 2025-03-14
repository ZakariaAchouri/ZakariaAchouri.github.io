import pako from 'pako';
import { decode } from 'base64-arraybuffer';
import Beatbox from 'beatbox.js';

export class CustomBeatbox extends Beatbox {
    setPosition(position) {
        super.setPosition(position);
        this.emit("setPosition");
    }
}

export function loadAudioSample(audioData) {
    const decompressed = pako.inflateRaw(new Uint8Array(decode(audioData)));
    return decompressed.buffer;
}

export function toSoundName(instr, stroke) {
    return `${instr}_${stroke.charCodeAt(0).toString(16)}`;
}