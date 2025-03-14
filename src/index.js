// src/rhythm-player.js
import { CustomBeatbox, loadAudioSample, toSoundName } from './audioUtils';

class RhythmPlayer extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // Create basic structure
        this.shadowRoot.innerHTML = `
            <style>
                :host {
                    display: block;
                    font-family: sans-serif;
                }
                .player {
                    padding: 20px;
                    background: #f5f5f5;
                    border-radius: 8px;
                }
                .controls {
                    display: flex;
                    gap: 20px;
                    align-items: center;
                }
                .instruments {
                    display: flex;
                    gap: 10px;
                }
                button {
                    padding: 8px 16px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    cursor: pointer;
                    background: white;
                }
                button.active {
                    background: #007bff;
                    color: white;
                }
            </style>
            <div class="player">
                <div class="controls">
                    <button id="playButton">Play</button>
                    <div class="instruments">
                        <button data-instrument="ls">Low</button>
                        <button data-instrument="ms">Mid</button>
                        <button data-instrument="hs">High</button>
                        <button data-instrument="sn">Snare</button>
                        <button data-instrument="re">Repi</button>
                        <button data-instrument="ta">Tam</button>
                        <button data-instrument="ag">Agogô</button>
                    </div>
                </div>
            </div>
        `;

        // Initialize Beatbox
        this.pattern = {
            length: 16,
            time: 1,
            upbeat: 0,
            ls: ['X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X', ' ', ' ', ' '],
            ms: [' ', ' ', 'X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X', ' '],
            hs: [' ', 'X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X', ' ', ' '],
            sn: ['X', ' ', ' ', 'X', ' ', ' ', 'X', ' ', ' ', 'X', ' ', ' ', 'X', ' ', ' ', 'X'],
            re: [' ', 'X', ' ', ' ', 'X', ' ', ' ', 'X', ' ', ' ', 'X', ' ', ' ', 'X', ' ', ' '],
            ta: ['X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X', ' ', 'X', ' '],
            ag: [' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X', ' ', ' ', ' ', 'X']
        };

        this.playbackSettings = {
            volume: 1,
            speed: 100,
            loop: true,
            mute: {},
            volumes: {}
        };

        this.audioSamples = {};

        this.initializePlayer();
        this.setupEventListeners();
    }

    async initializePlayer() {
        this.player = new CustomBeatbox([], 1, true);
        await this.loadAudioSamples();
        this.updatePlayer();
    }

    async loadAudioSamples() {
        const instruments = ['ls', 'ms', 'hs', 'sn', 're', 'ta', 'ag'];
        for (const instr of instruments) {
            try {
                const response = await fetch(`/audio/samples/${instr}.mp3`);
                const arrayBuffer = await response.arrayBuffer();
                const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                const audioBuffer = loadAudioSample(base64);
                await this.player.registerInstrument(instr, audioBuffer);
            } catch (error) {
                console.error(`Failed to load audio sample for ${instr}:`, error);
            }
        }
    }

    setupEventListeners() {
        const playButton = this.shadowRoot.getElementById('playButton');
        playButton.addEventListener('click', () => this.togglePlay());

        const instruments = this.shadowRoot.querySelectorAll('[data-instrument]');
        instruments.forEach(button => {
            button.addEventListener('click', () => {
                const instr = button.dataset.instrument;
                this.toggleInstrument(instr);
                button.classList.toggle('active');
            });
        });
    }

    togglePlay() {
        const playButton = this.shadowRoot.getElementById('playButton');
        if (!this.player.playing) {
            this.player.play();
            playButton.textContent = 'Stop';
        } else {
            this.player.stop();
            playButton.textContent = 'Play';
        }
    }

    toggleInstrument(instr) {
        this.playbackSettings.mute[instr] = !this.playbackSettings.mute[instr];
        this.updatePlayer();
    }

    updatePlayer() {
        const pattern = this.convertPatternToBeatbox();
        this.player.setPattern(pattern);
        this.player.setBeatLength(60000/this.playbackSettings.speed/4);
        this.player.setRepeat(this.playbackSettings.loop);
        
        Object.entries(this.playbackSettings.mute).forEach(([instr, isMuted]) => {
            this.player.setVolume(isMuted ? 0 : this.playbackSettings.volume, instr);
        });
    }

    convertPatternToBeatbox() {
        const pattern = [];
        const length = this.pattern.length;
        
        for (let i = 0; i < length; i++) {
            const stroke = [];
            for (const instr of Object.keys(this.pattern)) {
                if (instr !== 'length' && instr !== 'time' && instr !== 'upbeat') {
                    const strokeType = this.pattern[instr][i];
                    if (strokeType && strokeType !== ' ') {
                        stroke.push({
                            instrument: toSoundName(instr, strokeType),
                            volume: this.playbackSettings.volume
                        });
                    }
                }
            }
            pattern[i] = stroke;
        }

        return Object.assign(pattern, {
            upbeat: this.pattern.upbeat || 0
        });
    }
}

// Register the web component
customElements.define('rhythm-player', RhythmPlayer);