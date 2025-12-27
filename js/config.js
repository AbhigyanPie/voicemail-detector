/* ============================================
   CONFIG - Detection Settings
   Change these values to tune detection
   ============================================ */

const CONFIG = {
    
    // Beep Detection (widened ranges for real voicemails)
    BEEP_FREQ_MIN: 300,       // Minimum beep frequency (Hz)
    BEEP_FREQ_MAX: 1500,      // Maximum beep frequency (Hz)
    BEEP_DURATION_MIN: 0.15,  // Minimum beep length (seconds)
    BEEP_PURITY_MIN: 0.08,    // Minimum spectral purity
    BEEP_ENERGY_MIN: 0.015,   // Minimum energy for beep
    
    // Silence Detection
    SILENCE_THRESHOLD: 0.005, // Below this = silence (lowered)
    SILENCE_DURATION: 0.5,    // Minimum silence length (seconds)
    
    // Processing
    CHUNK_DURATION: 0.1,      // 100ms chunks
};