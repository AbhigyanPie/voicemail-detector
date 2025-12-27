/* ============================================
   REACT COMPONENTS
   Minimalist Old Money Style - No Icons
   ============================================ */


/* ============================================
   1. WAVEFORM - Audio visualization
   ============================================ */

function Waveform({ samples, sampleRate, dropTimestamp, beeps }) {
    const canvasRef = React.useRef(null);
    
    React.useEffect(() => {
        if (!samples || !canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const duration = samples.length / sampleRate;
        
        // Clear - dark background
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
        
        // Draw waveform - muted sage green
        const step = Math.floor(samples.length / width);
        ctx.strokeStyle = '#7d9a8c';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        for (let i = 0; i < width; i++) {
            const sampleIndex = i * step;
            const sample = samples[sampleIndex] || 0;
            const y = (1 - sample) * height / 2;
            
            if (i === 0) {
                ctx.moveTo(i, y);
            } else {
                ctx.lineTo(i, y);
            }
        }
        ctx.stroke();
        
        // Draw beeps - muted warm tone
        ctx.fillStyle = 'rgba(139, 115, 85, 0.4)';
        beeps.forEach(beep => {
            const x1 = (beep.start / duration) * width;
            const x2 = (beep.end / duration) * width;
            ctx.fillRect(x1, 0, x2 - x1, height);
        });
        
        // Draw drop line - forest green
        if (dropTimestamp > 0) {
            const x = (dropTimestamp / duration) * width;
            
            ctx.strokeStyle = '#2d4a3e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
            
            ctx.fillStyle = '#f5f3ef';
            ctx.font = '11px Georgia, serif';
            ctx.fillText(dropTimestamp.toFixed(2) + 's', x + 5, 15);
        }
        
    }, [samples, sampleRate, dropTimestamp, beeps]);
    
    return (
        <div className="waveform-container">
            <p className="waveform-label">Waveform</p>
            <canvas 
                ref={canvasRef} 
                width={700} 
                height={70}
                className="waveform-canvas"
            />
        </div>
    );
}


/* ============================================
   2. RESULT CARD
   ============================================ */

function ResultCard({ result }) {
    return (
        <div className="result-card">
            
            <div className="result-header">
                <h3>{result.fileName}</h3>
                <span className={'badge badge-' + result.triggerType}>
                    {result.triggerType.toUpperCase()}
                </span>
            </div>
            
            <div className="stats-grid">
                <div className="stat-box">
                    <p className="stat-label">Drop Time</p>
                    <p className="stat-value green">
                        {result.dropTimestamp.toFixed(3)}s
                    </p>
                </div>
                <div className="stat-box">
                    <p className="stat-label">Confidence</p>
                    <p className="stat-value blue">
                        {Math.round(result.confidence * 100)}%
                    </p>
                </div>
            </div>
            
            <p className="details-text">{result.details}</p>
            
            {result.samples && (
                <Waveform 
                    samples={result.samples}
                    sampleRate={result.sampleRate}
                    dropTimestamp={result.dropTimestamp}
                    beeps={result.beeps || []}
                />
            )}
        </div>
    );
}


/* ============================================
   3. FILE UPLOAD
   ============================================ */

function FileUpload({ files, onFilesChange, onAnalyze, processing, progress }) {
    
    const handleChange = (event) => {
        const selectedFiles = Array.from(event.target.files);
        onFilesChange(selectedFiles);
    };
    
    return (
        <div className="card">
            <div className="upload-section">
                
                <label className="upload-area">
                    <input 
                        type="file" 
                        accept="audio/*" 
                        multiple 
                        onChange={handleChange}
                    />
                    <p>
                        {files.length > 0 
                            ? files.length + ' file(s) selected' 
                            : 'Select audio files'
                        }
                    </p>
                </label>
                
                <button 
                    className="btn btn-primary"
                    onClick={onAnalyze}
                    disabled={files.length === 0 || processing}
                >
                    {processing ? 'Processing...' : 'Analyze'}
                </button>
            </div>
            
            {progress && (
                <p className="progress-text">{progress}</p>
            )}
            
            {files.length > 0 && !processing && (
                <div className="file-list">
                    {files.map((file, index) => (
                        <span key={index}>{file.name}</span>
                    ))}
                </div>
            )}
        </div>
    );
}


/* ============================================
   4. APP - Main Component
   ============================================ */

function App() {
    const [files, setFiles] = React.useState([]);
    const [results, setResults] = React.useState([]);
    const [processing, setProcessing] = React.useState(false);
    const [progress, setProgress] = React.useState('');
    
    const handleFilesChange = (newFiles) => {
        setFiles(newFiles);
        setResults([]);
    };
    
    const handleAnalyze = async () => {
        if (files.length === 0) return;
        
        setProcessing(true);
        const newResults = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setProgress('Analyzing ' + (i + 1) + ' of ' + files.length);
            
            try {
                const { samples, sampleRate, duration } = await AudioAnalyzer.loadAudio(file);
                const analysis = AudioAnalyzer.analyzeAudio(samples, sampleRate, duration);
                
                newResults.push({
                    fileName: file.name,
                    duration: duration,
                    samples: samples,
                    sampleRate: sampleRate,
                    ...analysis
                });
                
            } catch (error) {
                newResults.push({
                    fileName: file.name,
                    dropTimestamp: 0,
                    triggerType: 'error',
                    confidence: 0,
                    details: 'Error: ' + error.message,
                    beeps: []
                });
            }
        }
        
        setResults(newResults);
        setProcessing(false);
        setProgress('');
    };
    
    const handleExport = () => {
        const data = results.map(r => ({
            file: r.fileName,
            drop_timestamp_seconds: parseFloat(r.dropTimestamp.toFixed(3)),
            trigger: r.triggerType,
            confidence: r.confidence,
            details: r.details
        }));
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'voicemail_results.json';
        link.click();
    };
    
    return (
        <div className="container">
            
            <div className="header">
                <h1>Voicemail Drop Detector</h1>
                <p>ClearPath Finance</p>
            </div>
            
            <FileUpload 
                files={files}
                onFilesChange={handleFilesChange}
                onAnalyze={handleAnalyze}
                processing={processing}
                progress={progress}
            />
            
            {results.length > 0 && (
                <div>
                    <div className="results-header">
                        <h2>Results</h2>
                        <button className="btn btn-success" onClick={handleExport}>
                            Export
                        </button>
                    </div>
                    
                    {results.map((result, index) => (
                        <ResultCard key={index} result={result} />
                    ))}
                    
                    <div className="card">
                        <h3 style={{marginBottom: '15px', fontWeight: '400', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '0.9rem'}}>Summary</h3>
                        <table className="summary-table">
                            <thead>
                                <tr>
                                    <th>File</th>
                                    <th>Drop Time</th>
                                    <th>Trigger</th>
                                    <th>Confidence</th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.map((r, i) => (
                                    <tr key={i}>
                                        <td>{r.fileName}</td>
                                        <td className="timestamp">{r.dropTimestamp.toFixed(3)}s</td>
                                        <td>{r.triggerType}</td>
                                        <td>{Math.round(r.confidence * 100)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            
            <div className="card how-it-works">
                <h2>Detection Method</h2>
                <div className="steps-grid">
                    <div className="step-box green">
                        <h4>Beep Detection</h4>
                        <p>Frequency analysis identifies 600-1100 Hz pure tones with stable pitch.</p>
                    </div>
                    <div className="step-box yellow">
                        <h4>Silence Detection</h4>
                        <p>Extended quiet periods after speech indicate greeting completion.</p>
                    </div>
                    <div className="step-box orange">
                        <h4>Speech Analysis</h4>
                        <p>Fallback method triggers shortly after voice activity ceases.</p>
                    </div>
                </div>
            </div>
            
            <div className="footer">
                <p>ClearPath Finance Technical Assessment</p>
            </div>
        </div>
    );
}


/* ============================================
   RENDER
   ============================================ */

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);