var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { EventEmitter } from "events";
function isPlaying(beatbox) {
  return beatbox.playing;
}
const AudioContext = window.AudioContext || window.webkitAudioContext;
const OfflineAudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
const _Beatbox = class _Beatbox extends EventEmitter {
  constructor(pattern, strokeLength, repeat, upbeat) {
    super();
    __publicField(this, "playing", false);
    __publicField(this, "_pattern");
    __publicField(this, "_strokeLength");
    __publicField(this, "_repeat");
    __publicField(this, "_upbeat");
    __publicField(this, "_audioContext", null);
    __publicField(this, "_fillCacheTimeout", null);
    __publicField(this, "_onBeatTimeout", null);
    __publicField(this, "_scheduledSounds", []);
    /** If playing, the position innside the pattern until which the cache was filled. If not playing, the position where we should start playing next time. */
    __publicField(this, "_position", 0);
    /** The this._audioContext.currentTime when the playing was started */
    __publicField(this, "_startTime", null);
    /** The this._audioContext.currentTime of the start of the last bar that was created by the cache (excluding upbeat) */
    __publicField(this, "_referenceTime", null);
    /** Last sound objects of each instrument while filling the cache */
    __publicField(this, "_lastInstrumentStrokes", {});
    this._pattern = pattern;
    this._strokeLength = strokeLength;
    this._repeat = repeat;
    this._upbeat = upbeat || 0;
  }
  /**
   * Add a new instrument that can be referred to by an instrument key in the pattern.
   * @param key {String} The key that can be used to refer to this instrument in the pattern
   * @param data {ArrayBuffer} An ArrayBuffer that contains the sound file
   */
  static async registerInstrument(key, data) {
    const audioContext = new AudioContext();
    const audioBuffer = await new Promise((resolve, reject) => {
      audioContext.decodeAudioData(data, resolve, reject);
    });
    audioContext.close();
    _Beatbox._instruments[key] = { audioBuffer, key };
  }
  static unregisterInstrument(key) {
    delete _Beatbox._instruments[key];
  }
  _scheduleSound(instrument, time) {
    const source = this._audioContext.createBufferSource();
    source.buffer = instrument.audioBuffer;
    if (instrument.volume && instrument.volume != 1) {
      const gainNode = this._audioContext.createGain();
      gainNode.gain.value = instrument.volume;
      gainNode.connect(this._audioContext.destination);
      source.connect(gainNode);
    } else {
      source.connect(this._audioContext.destination);
    }
    source.start(time);
    const clear = () => {
      const idx = this._scheduledSounds.indexOf(sound);
      if (idx != -1)
        this._scheduledSounds.splice(idx, 1);
    };
    const stop = (time2) => {
      clearTimeout(sound.clearTimeout);
      if (time2 != null && time2 > 0) {
        source.stop(time2);
        sound.clearTimeout = window.setTimeout(clear, (time2 - this._audioContext.currentTime) * 1e3);
      } else {
        source.disconnect();
        clear();
      }
    };
    const sound = {
      time,
      duration: instrument.audioBuffer.duration,
      source,
      stop,
      clearTimeout: window.setTimeout(clear, (time - this._audioContext.currentTime + instrument.audioBuffer.duration) * 1e3)
    };
    this._scheduledSounds.push(sound);
    return sound;
  }
  static _resolveInstrument(instr) {
    if (instr == null)
      return null;
    const key = typeof instr == "string" ? instr : instr.instrument;
    if (!_Beatbox._instruments[key])
      return null;
    return {
      ..._Beatbox._instruments[key],
      ...typeof instr != "string" && instr.volume != null ? { volume: instr.volume } : {}
    };
  }
  play() {
    if (this.playing)
      return;
    this._audioContext = new AudioContext();
    this.playing = true;
    this._startTime = this._referenceTime = this._audioContext.currentTime - (this._position - this._upbeat) * this._strokeLength / 1e3;
    this._fillCache();
    const onBeatFunc = () => {
      this.emit("beat", this.getPosition());
      let sinceBeat = (this._audioContext.currentTime - this._referenceTime) * 1e3 % this._strokeLength;
      if (sinceBeat < 0)
        sinceBeat += this._strokeLength;
      this._onBeatTimeout = window.setTimeout(onBeatFunc, Math.max(_Beatbox._minOnBeatInterval, this._strokeLength - sinceBeat));
    };
    onBeatFunc();
    this.emit("play");
  }
  /**
   * The total length of the current pattern (including upbeat) in milliseconds.
   */
  getLength() {
    return this._pattern.reduce((v, instrs, i) => !instrs || instrs.length == 0 ? v : Math.max(v, i * this._strokeLength + Math.max(...instrs.map((instr) => {
      var _a, _b;
      return 1e3 * (((_b = (_a = _Beatbox._resolveInstrument(instr)) == null ? void 0 : _a.audioBuffer) == null ? void 0 : _b.duration) ?? 0);
    }))), this._pattern.length * this._strokeLength);
  }
  async record({ channels = 2, onProgress, signal } = {}) {
    signal == null ? void 0 : signal.throwIfAborted();
    const audioContext = new AudioContext();
    const sampleRate = audioContext.sampleRate;
    audioContext.close();
    const offlineContext = new OfflineAudioContext(channels, Math.max(1, this.getLength() * sampleRate / 1e3), sampleRate);
    this._audioContext = offlineContext;
    this._fillCacheInternal();
    this._audioContext = null;
    for (const sound of this._scheduledSounds)
      clearTimeout(sound.clearTimeout);
    this._scheduledSounds = [];
    signal == null ? void 0 : signal.throwIfAborted();
    if (onProgress) {
      (async () => {
        const length = this.getLength();
        const step = 1e3;
        for (let progress = step; progress < length && !(signal == null ? void 0 : signal.aborted); progress += step) {
          await offlineContext.suspend(progress / 1e3);
          onProgress(progress / length);
          offlineContext.resume();
        }
      })();
    }
    const audioBuffer = await Promise.race([
      offlineContext.startRendering(),
      new Promise((resolve, reject) => {
        if (signal == null ? void 0 : signal.aborted) {
          reject(signal.reason);
        }
        signal == null ? void 0 : signal.addEventListener("abort", () => {
          reject(signal.reason);
        });
      })
    ]);
    signal == null ? void 0 : signal.throwIfAborted();
    onProgress == null ? void 0 : onProgress(1);
    return audioBuffer;
  }
  stop(reset = false) {
    if (!this.playing)
      return;
    if (this._fillCacheTimeout) {
      clearTimeout(this._fillCacheTimeout);
      this._fillCacheTimeout = null;
    }
    if (this._onBeatTimeout) {
      clearTimeout(this._onBeatTimeout);
      this._onBeatTimeout = null;
    }
    this._position = reset ? 0 : this.getPosition();
    this._clearCache();
    this._audioContext.close();
    this._audioContext = null;
    this.playing = false;
    this.emit("stop");
  }
  getPosition() {
    if (isPlaying(this)) {
      let ret = (this._audioContext.currentTime - this._referenceTime) * 1e3 / this._strokeLength + this._upbeat;
      let min = this._audioContext.currentTime < this._startTime ? 0 : this._upbeat;
      while (ret < min) {
        ret += this._pattern.length - this._upbeat;
      }
      return Math.floor(ret);
    } else {
      return this._position;
    }
  }
  setPosition(position) {
    let playing = this.playing;
    if (playing)
      this.stop();
    this._position = position != null ? position : 0;
    if (playing)
      this.play();
  }
  setPattern(pattern) {
    this._pattern = pattern;
    this._applyChanges();
  }
  setBeatLength(strokeLength) {
    if (isPlaying(this)) {
      this._clearCache(this._audioContext.currentTime + 1e-6);
      let now = (this._audioContext.currentTime - this._referenceTime) * 1e3 / this._strokeLength;
      while (now < 0)
        now += this._pattern.length - this._upbeat;
      this._referenceTime = this._audioContext.currentTime - now * strokeLength / 1e3;
    }
    this._strokeLength = strokeLength;
    this._applyChanges();
  }
  setRepeat(repeat) {
    this._repeat = repeat;
    this._applyChanges();
  }
  setUpbeat(upbeat) {
    if (isPlaying(this)) {
      this._referenceTime += (upbeat - this._upbeat) * this._strokeLength / 1e3;
    }
    this._upbeat = upbeat || 0;
    this._applyChanges();
  }
  _applyChanges() {
    if (isPlaying(this)) {
      this._position = this.getPosition() + 1;
      while (this._referenceTime > this._audioContext.currentTime)
        this._referenceTime -= (this._pattern.length - this._upbeat) * this._strokeLength / 1e3;
      if (this._referenceTime < this._startTime)
        this._referenceTime = this._startTime;
      this._clearCache(this._audioContext.currentTime + 1e-6);
      this._fillCache();
    }
  }
  _fillCacheInternal(cacheUntil) {
    while (cacheUntil == null || this._referenceTime + (this._position - this._upbeat) * this._strokeLength / 1e3 <= cacheUntil) {
      if (this._position >= this._pattern.length) {
        if (cacheUntil != null && this._repeat) {
          this._position = this._upbeat;
          this._referenceTime = this._referenceTime + this._strokeLength * (this._pattern.length - this._upbeat) / 1e3;
        } else
          return false;
      }
      const part = this._pattern[this._position];
      if (part) {
        for (let strokeIdx = 0; strokeIdx < part.length; strokeIdx++) {
          const instr = _Beatbox._resolveInstrument(part[strokeIdx]);
          if (instr && (instr.volume == null || instr.volume > 0)) {
            let time = this._referenceTime + (this._position - this._upbeat) * this._strokeLength / 1e3;
            if (this._lastInstrumentStrokes[instr.key])
              this._lastInstrumentStrokes[instr.key].stop(time);
            const sound = this._scheduleSound(instr, time);
            this._lastInstrumentStrokes[instr.key] = sound;
          }
        }
      }
      this._position++;
    }
    return true;
  }
  _fillCache() {
    if (this._fillCacheTimeout)
      window.clearTimeout(this._fillCacheTimeout);
    const hasMore = this._fillCacheInternal(this._audioContext.currentTime + _Beatbox._cacheLength / 1e3);
    if (hasMore)
      this._fillCacheTimeout = window.setTimeout(() => {
        this._fillCache();
      }, _Beatbox._cacheInterval);
    else {
      const endTime = Math.max(
        this._referenceTime * 1e3 + this._strokeLength * (this._pattern.length - this._upbeat),
        ...this._scheduledSounds.map((sound) => (sound.time + sound.duration) * 1e3)
      );
      this._fillCacheTimeout = window.setTimeout(() => {
        this.stop(true);
      }, endTime - this._audioContext.currentTime * 1e3);
    }
  }
  _clearCache(from) {
    if (this._fillCacheTimeout)
      clearTimeout(this._fillCacheTimeout);
    for (const sound of [...this._scheduledSounds]) {
      if (from == null || sound.time >= from)
        sound.stop();
    }
  }
};
__publicField(_Beatbox, "_cacheInterval", 1e3);
__publicField(_Beatbox, "_cacheLength", 5e3);
__publicField(_Beatbox, "_instruments", {});
__publicField(_Beatbox, "_minOnBeatInterval", 100);
let Beatbox = _Beatbox;
export {
  Beatbox,
  Beatbox as default
};
//# sourceMappingURL=beatbox.js.map
