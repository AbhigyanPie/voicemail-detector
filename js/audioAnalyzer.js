/* ============================================
   AUDIO ANALYZER v5.0 - FIXED FOR RESAMPLING
   Web Audio API resamples to 48kHz, which 
   affects spectral purity. Thresholds lowered.
   ============================================ */

const AudioAnalyzer = {

    async loadAudio(file) {
        console.log('\n' + '='.repeat(60));
        console.log('LOADING:', file.name);
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        const sampleRate = audioBuffer.sampleRate;
        const duration = audioBuffer.duration;
        const numChannels = audioBuffer.numberOfChannels;
        
        console.log('  Sample Rate:', sampleRate);
        console.log('  Duration:', duration.toFixed(2) + 's');
        console.log('  Channels:', numChannels);
        
        // Get audio samples - IMPORTANT: handle stereo files!
        let rawSamples;
        if (numChannels === 1) {
            // Mono - use directly
            rawSamples = audioBuffer.getChannelData(0);
        } else {
            // Stereo - mix both channels to mono
            // (Some files have audio only in right channel!)
            const left = audioBuffer.getChannelData(0);
            const right = audioBuffer.getChannelData(1);
            rawSamples = new Float32Array(left.length);
            for (let i = 0; i < left.length; i++) {
                rawSamples[i] = (left[i] + right[i]) / 2;
            }
            console.log('  Mixed stereo to mono');
        }
        
        // Find max amplitude
        let maxAmp = 0;
        for (let i = 0; i < rawSamples.length; i++) {
            const abs = Math.abs(rawSamples[i]);
            if (abs > maxAmp) maxAmp = abs;
        }
        console.log('  Max Amplitude:', maxAmp.toFixed(4));
        
        // Always normalize for consistent analysis
        let samples = new Float32Array(rawSamples.length);
        if (maxAmp > 0.001) {
            const scale = 1.0 / maxAmp;
            for (let i = 0; i < rawSamples.length; i++) {
                samples[i] = rawSamples[i] * scale;
            }
            console.log('  Normalized to 1.0');
        } else {
            samples = rawSamples;
        }
        
        return { samples, sampleRate, duration };
    },

    getEnergy(samples) {
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
            sum += samples[i] * samples[i];
        }
        return Math.sqrt(sum / samples.length);
    },

    // Analyze frequency with focus on beep range
    getFrequencyInfo(samples, sampleRate) {
        const n = samples.length;
        
        // Analyze 400-1500 Hz range (covers all beep frequencies)
        const minK = Math.max(1, Math.floor(400 * n / sampleRate));
        const maxK = Math.min(Math.ceil(1500 * n / sampleRate), Math.floor(n / 2));
        
        let maxMag = 0;
        let maxFreq = 0;
        let totalMag = 0;
        
        for (let k = minK; k <= maxK; k++) {
            let re = 0, im = 0;
            for (let t = 0; t < n; t++) {
                const angle = 2 * Math.PI * k * t / n;
                re += samples[t] * Math.cos(angle);
                im -= samples[t] * Math.sin(angle);
            }
            const mag = Math.sqrt(re * re + im * im);
            totalMag += mag;
            if (mag > maxMag) {
                maxMag = mag;
                maxFreq = k * sampleRate / n;
            }
        }
        
        const purity = totalMag > 0 ? maxMag / totalMag : 0;
        return { freq: maxFreq, purity: purity };
    },

    analyzeAudio(samples, sampleRate, duration) {
        console.log('\n--- ANALYZING ---');
        
        // Use smaller chunks for better time resolution (50ms)
        const chunkMs = 50;
        const chunkSize = Math.floor(sampleRate * chunkMs / 1000);
        const hopSize = Math.floor(chunkSize / 2);
        
        console.log('  Chunk Size:', chunkSize, 'samples (' + chunkMs + 'ms)');
        
        // Collect ALL chunks with any tonal content
        const allChunks = [];
        let lastSpeechTime = 0;
        
        const silences = [];
        let inSilence = false;
        let silenceStart = 0;
        
        for (let i = 0; i < samples.length - chunkSize; i += hopSize) {
            const chunk = samples.slice(i, i + chunkSize);
            const time = i / sampleRate;
            const energy = this.getEnergy(chunk);
            
            // Silence tracking
            if (energy < 0.01) {
                if (!inSilence) {
                    inSilence = true;
                    silenceStart = time;
                }
            } else {
                if (inSilence && time - silenceStart >= 0.5) {
                    silences.push({ start: silenceStart, dur: time - silenceStart });
                }
                inSilence = false;
            }
            
            // Speech tracking
            if (energy > 0.015) {
                lastSpeechTime = time;
            }
            
            // Look for ANY tonal content (very low threshold)
            // Energy > 0.01 is enough after normalization
            if (energy > 0.01) {
                const { freq, purity } = this.getFrequencyInfo(chunk, sampleRate);
                
                // Store if frequency is in beep range (600-1100 Hz)
                // VERY LOW purity threshold (0.04) due to resampling effects
                if (freq >= 600 && freq <= 1100 && purity > 0.04) {
                    allChunks.push({ time, freq, purity, energy });
                }
            }
        }
        
        console.log('  Tonal chunks found:', allChunks.length);
        console.log('  Last speech:', lastSpeechTime.toFixed(2) + 's');
        
        // Show top chunks by purity
        if (allChunks.length > 0) {
            const sorted = [...allChunks].sort((a, b) => b.purity - a.purity);
            console.log('  TOP 15 TONAL CHUNKS:');
            sorted.slice(0, 15).forEach(c => {
                console.log('    t=' + c.time.toFixed(2) + 's, f=' + c.freq.toFixed(0) + 'Hz, p=' + c.purity.toFixed(3));
            });
        }
        
        // Group chunks into beep candidates
        // Key insight: Real beeps have CONSISTENT frequency over time
        const beeps = [];
        
        if (allChunks.length >= 2) {
            // Sort by time
            allChunks.sort((a, b) => a.time - b.time);
            
            let groupStart = allChunks[0].time;
            let groupFreqs = [allChunks[0].freq];
            let groupPurities = [allChunks[0].purity];
            let lastTime = allChunks[0].time;
            
            const evaluateGroup = () => {
                const dur = lastTime - groupStart + hopSize / sampleRate;
                
                // Need at least 2 chunks and 100ms duration
                if (groupFreqs.length >= 2 && dur >= 0.10) {
                    const avgFreq = groupFreqs.reduce((a, b) => a + b) / groupFreqs.length;
                    const avgPurity = groupPurities.reduce((a, b) => a + b) / groupPurities.length;
                    const maxPurity = Math.max(...groupPurities);
                    
                    // Frequency consistency check
                    const variance = groupFreqs.reduce((s, f) => s + (f - avgFreq) ** 2, 0) / groupFreqs.length;
                    const stdDev = Math.sqrt(variance);
                    
                    console.log('  GROUP: ' + groupStart.toFixed(2) + 's-' + lastTime.toFixed(2) + 's, ' +
                               'freq=' + avgFreq.toFixed(0) + 'Hz, std=' + stdDev.toFixed(0) + ', ' +
                               'purity=' + avgPurity.toFixed(3) + '/' + maxPurity.toFixed(3) + ', chunks=' + groupFreqs.length);
                    
                    // STRICT criteria to avoid false positives from speech:
                    // Real beeps have: std < 10, high purity, many chunks
                    // 
                    // Accept if:
                    // 1. Very stable frequency (std < 15) AND good purity (avg > 0.20 OR max > 0.30)
                    // 2. OR extremely high purity (max > 0.50) regardless of std
                    // 3. AND at least 8 chunks for long beeps, or 4 chunks with very high purity
                    
                    const isStableFreq = stdDev < 15;
                    const hasGoodPurity = avgPurity > 0.20 || maxPurity > 0.30;
                    const hasExcellentPurity = maxPurity > 0.50;
                    const hasEnoughChunks = groupFreqs.length >= 8 || (groupFreqs.length >= 4 && maxPurity > 0.40);
                    
                    const isRealBeep = (isStableFreq && hasGoodPurity && hasEnoughChunks) || 
                                       (hasExcellentPurity && groupFreqs.length >= 4);
                    
                    if (isRealBeep) {
                        console.log('    ✓ BEEP DETECTED!');
                        beeps.push({
                            start: groupStart,
                            end: lastTime + hopSize / sampleRate,
                            frequency: avgFreq,
                            duration: dur,
                            purity: avgPurity
                        });
                    } else {
                        console.log('    ✗ Rejected (std=' + stdDev.toFixed(0) + ', purity=' + avgPurity.toFixed(3) + '/' + maxPurity.toFixed(3) + ', chunks=' + groupFreqs.length + ')');
                    }
                }
            };
            
            for (let i = 1; i < allChunks.length; i++) {
                const c = allChunks[i];
                const timeDiff = c.time - lastTime;
                const freqDiff = Math.abs(c.freq - groupFreqs[groupFreqs.length - 1]);
                
                // Group if close in time (< 250ms) and frequency (< 100 Hz)
                if (timeDiff < 0.25 && freqDiff < 100) {
                    groupFreqs.push(c.freq);
                    groupPurities.push(c.purity);
                    lastTime = c.time;
                } else {
                    evaluateGroup();
                    groupStart = c.time;
                    groupFreqs = [c.freq];
                    groupPurities = [c.purity];
                    lastTime = c.time;
                }
            }
            evaluateGroup();
        }
        
        console.log('  BEEPS FOUND:', beeps.length);
        
        // Result
        const result = {
            beeps: beeps,
            silences: silences,
            speechEnd: lastSpeechTime,
            dropTimestamp: 0,
            triggerType: '',
            confidence: 0,
            details: ''
        };
        
        // Priority 1: Beep after 3 seconds
        const lateBeeps = beeps.filter(b => b.start > 3.0);
        if (lateBeeps.length > 0) {
            const beep = lateBeeps[lateBeeps.length - 1];
            result.dropTimestamp = beep.end;
            result.triggerType = 'beep';
            result.confidence = 0.95;
            result.details = 'Beep at ' + beep.start.toFixed(2) + 's (' + Math.round(beep.frequency) + ' Hz)';
            console.log('>>> DROP:', result.dropTimestamp.toFixed(3) + 's (BEEP)');
            return result;
        }
        
        // Priority 2: Long silence after 3s
        const lateSilences = silences.filter(s => s.start > 3.0 && s.dur >= 0.8);
        if (lateSilences.length > 0) {
            result.dropTimestamp = lateSilences[0].start + 0.2;
            result.triggerType = 'silence';
            result.confidence = 0.75;
            result.details = 'Silence at ' + lateSilences[0].start.toFixed(2) + 's';
            console.log('>>> DROP:', result.dropTimestamp.toFixed(3) + 's (SILENCE)');
            return result;
        }
        
        // Priority 3: Speech ended
        if (lastSpeechTime > 3.0) {
            result.dropTimestamp = lastSpeechTime + 0.4;
            result.triggerType = 'speech_end';
            result.confidence = 0.60;
            result.details = 'Speech ended at ' + lastSpeechTime.toFixed(2) + 's';
            console.log('>>> DROP:', result.dropTimestamp.toFixed(3) + 's (SPEECH_END)');
            return result;
        }
        
        // Fallback
        result.dropTimestamp = Math.max(0, duration - 0.5);
        result.triggerType = 'fallback';
        result.confidence = 0.40;
        result.details = 'End of audio fallback';
        console.log('>>> DROP:', result.dropTimestamp.toFixed(3) + 's (FALLBACK)');
        
        return result;
    }
};

console.log('✓ AudioAnalyzer v5.0 loaded (fixed for browser resampling)');