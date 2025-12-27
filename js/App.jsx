/**
 * Main React Application Component
 */

function App() {
    // State
    const [files, setFiles] = React.useState([]);
    const [results, setResults] = React.useState([]);
    const [processing, setProcessing] = React.useState(false);
    const [progress, setProgress] = React.useState(0);
    
    // Handle file selection
    const handleFilesChange = (newFiles) => {
        setFiles(newFiles);
        setResults([]);
    };
    
    // Analyze all selected files
    const handleAnalyze = async () => {
        if (files.length === 0) return;
        
        setProcessing(true);
        setProgress(0);
        const newResults = [];
        
        // Process each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setProgress(((i + 1) / files.length) * 100);
            
            try {
                // Use the audio analyzer
                const result = await window.audioAnalyzer.analyze(file);
                newResults.push(result);
            } catch (error) {
                console.error(`Error analyzing ${file.name}:`, error);
                newResults.push({
                    success: false,
                    filename: file.name,
                    dropTime: 0,
                    trigger: 'error',
                    confidence: 0,
                    details: `Analysis failed: ${error.message}`,
                    duration: 0
                });
            }
        }
        
        setResults(newResults);
        setProcessing(false);
        setProgress(0);
    };
    
    // Export results as JSON
    const handleExport = () => {
        const exportData = results.map(result => ({
            file: result.filename,
            duration: result.duration ? result.duration.toFixed(3) : 'N/A',
            drop_timestamp_seconds: result.dropTime.toFixed(3),
            trigger: result.trigger,
            confidence: Math.round(result.confidence * 100),
            details: result.details
        }));
        
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `voicemail_drops_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    
    return (
        <div className="container">
            {/* Header */}
            <div className="header">
                <h1>🎤 Voicemail Drop Detector</h1>
                <p>ClearPath Finance - Automated Compliant Voicemail Timing</p>
            </div>
            
            {/* File Upload Section */}
            <FileUpload 
                files={files}
                onFilesChange={handleFilesChange}
                onAnalyze={handleAnalyze}
                processing={processing}
            />
            
            {/* Results Section */}
            {results.length > 0 && (
                <div className="results-section">
                    <div className="results-header">
                        <h2>📊 Analysis Results</h2>
                        <button className="export-btn" onClick={handleExport}>
                            💾 Export JSON Results
                        </button>
                    </div>
                    
                    {/* Individual Result Cards */}
                    {results.map((result, index) => (
                        <ResultCard key={index} result={result} />
                    ))}
                    
                    {/* Summary Table */}
                    <SummaryTable results={results} />
                </div>
            )}
            
            {/* How It Works Section */}
            <HowItWorks />
            
            {/* Footer */}
            <div className="footer">
                <p>ClearPath Finance Technical Assignment</p>
                <p>React + Web Audio API | Real-time Voicemail Analysis</p>
            </div>
        </div>
    );
}

// Render the application
const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<App />);