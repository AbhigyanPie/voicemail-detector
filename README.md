# Voicemail Drop Detector

A browser-based tool that analyzes voicemail audio files to detect the optimal moment to drop a pre-recorded message — right after the greeting ends.

Built for ClearPath Finance Technical Assessment.

---

## Problem

When leaving automated voicemails, timing matters. Drop too early and you cut off the greeting. Drop too late and there's awkward silence. This tool analyzes voicemail recordings to find the exact moment the greeting ends.

---

## Solution

The algorithm uses three detection methods in order of reliability:

| Priority | Method | Confidence | How it works |
|----------|--------|------------|--------------|
| 1 | Beep Detection | 95% | FFT identifies 600-1100 Hz pure tones with stable frequency |
| 2 | Silence Detection | 75% | Extended quiet (>0.5s) after speech activity |
| 3 | Speech End | 60% | Voice activity stops + 0.4s buffer |

Most voicemail systems play a beep after the greeting. That's the most reliable signal. If no beep, fall back to silence or speech end.

---

## How Beep Detection Works

Real beeps vs speech — the key differences:

| Property | Real Beep | Speech |
|----------|-----------|--------|
| Frequency | 600-1100 Hz | 300-500 Hz (vowels) |
| Stability | std < 15 Hz | Variable pitch |
| Purity | > 0.30 | Low (harmonics spread energy) |
| Duration | 150-700ms | Variable |

The algorithm:
1. Splits audio into 50ms chunks with 50% overlap
2. Runs FFT on each chunk to find dominant frequency
3. Calculates spectral purity (peak magnitude / total magnitude)
4. Groups consecutive tonal chunks
5. Validates: stable frequency + high purity + sufficient duration = beep

---

## Technical Challenges Solved

**Stereo Files**  
Some test files had audio only in the right channel. The left channel was nearly silent. Solution: mix both channels to mono.

**Browser Resampling**  
Web Audio API resamples everything to 48kHz regardless of original sample rate. This affects spectral characteristics. Thresholds were tuned accordingly.

**Quiet Recordings**  
Some files had max amplitude of 0.02. Solution: normalize all audio to full scale before analysis.

**False Positives**  
Speech harmonics can look like tones. Solution: strict criteria — frequency stability < 15 Hz std dev, purity > 0.30, minimum 8 consecutive chunks.

---

## Results

Tested on 7 voicemail recordings:

| File | Drop Time | Trigger | Frequency |
|------|-----------|---------|-----------|
| vm1_output.wav | 10.750s | BEEP | 740 Hz |
| vm2_output.wav | 9.125s | BEEP | 660 Hz |
| vm3_output.wav | 15.375s | BEEP | 1000 Hz |
| vm4_output.wav | 5.350s | SPEECH_END | — |
| vm5_output.wav | 14.875s | SPEECH_END | — |
| vm6_output.wav | 4.375s | SPEECH_END | — |
| vm7_output.wav | 12.525s | BEEP | 880 Hz |

---

## Run Locally

```bash
# Option 1: Python
python -m http.server 8000
# Open http://localhost:8000

# Option 2: Node
npx serve

# Option 3: VS Code
# Install Live Server extension
# Right-click index.html → Open with Live Server
```

---

## Project Structure

```
voicemail-react/
├── index.html          # Entry point
├── styles.css         
└── js/
    ├── config.js           # Detection thresholds
    ├── audioAnalyzer.js    # Core algorithm (FFT, beep detection)
    └── components.jsx      # React UI
```

---

## Tech Stack

- React 18 (via CDN)
- Web Audio API for decoding
- Custom FFT implementation for frequency analysis
- Plain CSS

No build step. No npm install. Just open in browser.

---

## Usage

1. Open the app
2. Upload one or more audio files (.wav, .mp3)
3. Click Analyze
4. View results with waveform visualization
5. Export as JSON if needed

---

## Configuration

Thresholds can be adjusted in `js/config.js`:

```javascript
const CONFIG = {
    BEEP_FREQ_MIN: 600,
    BEEP_FREQ_MAX: 1100,
    BEEP_PURITY_MIN: 0.08,
    SILENCE_THRESHOLD: 0.01,
};
```

---

## Algorithm Details

### Frequency Analysis

For each 50ms chunk:
```
1. Apply DFT to find magnitude at each frequency bin
2. Search 400-1500 Hz range
3. Find peak frequency and calculate purity
4. Purity = peak_magnitude / total_magnitude
```

### Beep Validation

A group of tonal chunks is accepted as a beep if:
- Frequency std deviation < 15 Hz (stable pitch)
- Average purity > 0.20 OR max purity > 0.30
- At least 8 chunks, or 4 chunks with purity > 0.40

### Drop Point

- Beep: drop at beep end timestamp
- Silence: drop 0.2s into the silence
- Speech end: drop 0.4s after last voice activity

---

## Author

Abhigyan Tripathi  
IIT Guwahati
