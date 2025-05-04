import { EventEmitter } from 'events';

export interface Instrument {
    key: string;
    audioBuffer: AudioBuffer;
    volume?: number;
}
export interface InstrumentReferenceObject {
    instrument: string;
    volume?: number;
}
export type InstrumentReference = string | InstrumentReferenceObject;
export interface ScheduledSound {
    time: number;
    duration: number;
    source: AudioBufferSourceNode;
    stop(time?: number): void;
    clearTimeout: number;
}
export type Pattern = Array<Array<InstrumentReference> | undefined>;
/** A callback that receives a progress float between 0 and 1. */
export type BeatboxProgressCallback = (progress: number) => void;
export type BeatboxRecordOptions = {
    onProgress?: BeatboxProgressCallback;
    signal?: AbortSignal;
    channels?: number;
};
export declare class Beatbox extends EventEmitter {
    static _cacheInterval: number;
    static _cacheLength: number;
    static _instruments: {
        [instr: string]: Instrument;
    };
    static _minOnBeatInterval: number;
    playing: boolean;
    _pattern: Pattern;
    _strokeLength: number;
    _repeat: boolean;
    _upbeat: number;
    _audioContext: BaseAudioContext | null;
    _fillCacheTimeout: number | null;
    _onBeatTimeout: number | null;
    _scheduledSounds: ScheduledSound[];
    /** If playing, the position innside the pattern until which the cache was filled. If not playing, the position where we should start playing next time. */
    _position: number;
    /** The this._audioContext.currentTime when the playing was started */
    _startTime: number | null;
    /** The this._audioContext.currentTime of the start of the last bar that was created by the cache (excluding upbeat) */
    _referenceTime: number | null;
    /** Last sound objects of each instrument while filling the cache */
    _lastInstrumentStrokes: {
        [instr: string]: ScheduledSound;
    };
    constructor(pattern: Pattern, strokeLength: number, repeat: boolean, upbeat?: number);
    /**
     * Add a new instrument that can be referred to by an instrument key in the pattern.
     * @param key {String} The key that can be used to refer to this instrument in the pattern
     * @param data {ArrayBuffer} An ArrayBuffer that contains the sound file
     */
    static registerInstrument(key: string, data: ArrayBuffer): Promise<void>;
    static unregisterInstrument(key: string): void;
    _scheduleSound(instrument: Instrument, time: number): ScheduledSound;
    static _resolveInstrument(instr?: InstrumentReference): Instrument | null;
    play(): void;
    /**
     * The total length of the current pattern (including upbeat) in milliseconds.
     */
    getLength(): number;
    record({ channels, onProgress, signal }?: BeatboxRecordOptions): Promise<AudioBuffer>;
    stop(reset?: boolean): void;
    getPosition(): number;
    setPosition(position: number): void;
    setPattern(pattern: Pattern): void;
    setBeatLength(strokeLength: number): void;
    setRepeat(repeat: boolean): void;
    setUpbeat(upbeat: number): void;
    _applyChanges(): void;
    _fillCacheInternal(cacheUntil?: number): boolean;
    _fillCache(): void;
    _clearCache(from?: number): void;
}
export default Beatbox;
