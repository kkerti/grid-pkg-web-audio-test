<script>
  import svelteLogo from './assets/svelte.svg'
  import viteLogo from '/vite.svg'
  import Counter from './lib/Counter.svelte'

  let isCapturing = false;
  let audioContext = null;
  let analyser = null;
  let microphone = null;
  let dataArray = null;
  let websocket = null;
  let peakBands = new Array(8).fill(0);
  let maxPeakBands = new Array(8).fill(0); // Track highest peaks for 8 bands
  let connectionStatus = 'disconnected';
  let frameRate = 24; // frames per second
  let captureInterval = null;
  let audioAnalysisInterval = null; // For continuous audio analysis

  // WebSocket connection to Grid package
  function connectWebSocket() {
    try {
      websocket = new WebSocket('ws://localhost:1111');
      
      websocket.onopen = () => {
        connectionStatus = 'connected';
        console.log('Connected to Grid package on port 1111');
      };
      
      websocket.onclose = () => {
        connectionStatus = 'disconnected';
        console.log('Disconnected from Grid package');
      };
      
      websocket.onerror = (error) => {
        connectionStatus = 'error';
        console.error('WebSocket error:', error);
      };
      
      websocket.onmessage = (event) => {
        console.log('Received from Grid:', event.data);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      connectionStatus = 'error';
    }
  }

  // Send highest peak values to Grid package and reset tracker
  function sendMaxPeakValue() {
    if (websocket && websocket.readyState === WebSocket.OPEN) {
      // Format as Lua table string: {val1, val2, ..., val8}
      // Values are normalized 0-100 for easier reading in Lua, or 0-1. 
      // User asked for "array", usually 0-1 is standard for web audio, but let's stick to 0-1 float.
      // Lua table string: "{0.1, 0.2, ...}"
      const luaTableString = `{${maxPeakBands.map(v => v.toFixed(4)).join(', ')}}`;
      
      const message = JSON.stringify({
        type: 'audio-peak-bands', // Updated type
        value: luaTableString,    // Sent as stringified Lua table
        timestamp: Date.now()
      });
      websocket.send(message);
      
      // Reset the max peak tracker for next interval
      maxPeakBands = new Array(8).fill(0);
    }
  }

  // Initialize audio capture
  async function startAudioCapture() {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });

      // Create audio context
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      
      // Create analyser node
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      
      // Connect microphone to analyser
      microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);
      
      // Create data array for frequency analysis
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      
      isCapturing = true;
      
      // Start continuous audio analysis (faster than frame rate for better peak detection)
      audioAnalysisInterval = setInterval(analyzePeakValue, 16); // ~60fps analysis
      
      // Start sending max peak values at specified frame rate
      captureInterval = setInterval(sendMaxPeakValue, 1000 / frameRate);
      
      console.log('Audio capture started');
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
  }

  // Analyze peak value from audio data (called frequently for accurate peak detection)
  function analyzePeakValue() {
    if (!analyser || !dataArray) return;
    
    // Get frequency data
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate 8 frequency bands
    // dataArray has 128 bins (fftSize 256 / 2)
    // 128 / 8 = 16 bins per band
    const binSize = Math.floor(dataArray.length / 8);
    
    for (let i = 0; i < 8; i++) {
      let bandSum = 0;
      let bandMax = 0;
      
      for (let j = 0; j < binSize; j++) {
        const value = dataArray[i * binSize + j];
        bandSum += value;
        if (value > bandMax) bandMax = value;
      }
      
      // Use average for smoother visualization, or max for peak detection
      // Let's use average of the band, normalized to 0-1
      const bandAverage = (bandSum / binSize) / 255;
      
      // Update current bands
      peakBands[i] = bandAverage;
      
      // Track max peaks for Grid transmission
      if (bandAverage > maxPeakBands[i]) {
        maxPeakBands[i] = bandAverage;
      }
    }
    // Trigger reactivity
    peakBands = peakBands;
  }

  // Stop audio capture
  function stopAudioCapture() {
    isCapturing = false;
    
    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
    }
    
    if (audioAnalysisInterval) {
      clearInterval(audioAnalysisInterval);
      audioAnalysisInterval = null;
    }
    
    if (microphone) {
      microphone.disconnect();
      microphone = null;
    }
    
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    
    analyser = null;
    dataArray = null;
    peakBands = new Array(8).fill(0);
    maxPeakBands = new Array(8).fill(0);
    
    console.log('Audio capture stopped');
  }

  // Toggle audio capture
  function toggleCapture() {
    if (isCapturing) {
      stopAudioCapture();
    } else {
      startAudioCapture();
    }
  }

  // Disconnect WebSocket
  function disconnectWebSocket() {
    if (websocket) {
      websocket.close();
      websocket = null;
    }
  }

  // Update frame rate
  function updateFrameRate(newRate) {
    frameRate = newRate;
    if (isCapturing) {
      clearInterval(captureInterval);
      captureInterval = setInterval(sendMaxPeakValue, 1000 / frameRate);
    }
  }
</script>

<main>
  <div class="header">
    <h1>Audio Peak Capture for Grid</h1>
    <p>Capture microphone audio peaks and send to Grid package via WebSocket</p>
  </div>

  <div class="controls">
    <div class="connection-section">
      <h3>WebSocket Connection</h3>
      <div class="connection-status">
        Status: <span class="status {connectionStatus}">{connectionStatus}</span>
      </div>
      <div class="connection-buttons">
        <button on:click={connectWebSocket} disabled={connectionStatus === 'connected'}>
          Connect to Grid (port 1111)
        </button>
        <button on:click={disconnectWebSocket} disabled={connectionStatus !== 'connected'}>
          Disconnect
        </button>
      </div>
    </div>

    <div class="audio-section">
      <h3>Audio Capture</h3>
      <div class="audio-controls">
        <button on:click={toggleCapture} class="capture-button {isCapturing ? 'active' : ''}">
          {isCapturing ? 'Stop Capture' : 'Start Capture'}
        </button>
      </div>
      
      <div class="settings">
        <label>
          Frame Rate: 
          <input 
            type="range" 
            min="1" 
            max="60" 
            bind:value={frameRate}
            on:input={() => updateFrameRate(frameRate)}
          />
          <span>{frameRate} FPS</span>
        </label>
      </div>
    </div>

    <div class="visualizer-section">
      <h3>Audio Spectrum Monitor (8 Bands)</h3>
      <div class="spectrum-display">
        {#each peakBands as peak, i}
          <div class="spectrum-bar-container">
            <div class="spectrum-bar">
              <div 
                class="spectrum-fill" 
                style="height: {peak * 100}%; background-color: {peak > 0.8 ? '#ff4444' : peak > 0.5 ? '#ffaa44' : '#44ff44'}"
              ></div>
            </div>
            <div class="spectrum-value">{(peak * 100).toFixed(0)}</div>
          </div>
        {/each}
      </div>
      <div class="peak-values">
        <div class="max-peak">Sending Lua Table: {`{${maxPeakBands.map(v => v.toFixed(2)).join(', ')}}`}</div>
      </div>
    </div>

    <div class="info-section">
      <h3>Information</h3>
      <ul>
        <li>Spectrum Analyzer: Captures 8 frequency bands at {frameRate} FPS</li>
        <li>Continuous audio analysis at ~60fps for accurate peak detection</li>
        <li>Sends Lua table string <code>{`{val1, ..., val8}`}</code> to Grid package</li>
        <li>WebSocket connection on localhost:1111</li>
        <li>Requires microphone permission to function</li>
      </ul>
    </div>
  </div>
</main>

<style>
  main {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: Arial, sans-serif;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    color: #333;
    margin-bottom: 0.5rem;
  }

  .header p {
    color: #666;
    font-size: 1.1rem;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .connection-section,
  .audio-section,
  .visualizer-section,
  .info-section {
    background: #f8f9fa;
    padding: 1.5rem;
    border-radius: 8px;
    border: 1px solid #e9ecef;
  }

  .connection-section h3,
  .audio-section h3,
  .visualizer-section h3,
  .info-section h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: #495057;
  }

  .connection-status {
    margin-bottom: 1rem;
    font-size: 1.1rem;
  }

  .status {
    font-weight: bold;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    font-size: 0.9rem;
  }

  .status.connected {
    background-color: #d4edda;
    color: #155724;
  }

  .status.disconnected {
    background-color: #f8d7da;
    color: #721c24;
  }

  .status.error {
    background-color: #f5c6cb;
    color: #721c24;
  }

  .connection-buttons {
    display: flex;
    gap: 1rem;
  }

  button {
    background: #007bff;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: background-color 0.2s;
  }

  button:hover:not(:disabled) {
    background: #0056b3;
  }

  button:disabled {
    background: #6c757d;
    cursor: not-allowed;
  }

  .capture-button {
    background: #28a745;
    font-size: 1.1rem;
    padding: 1rem 2rem;
  }

  .capture-button:hover:not(:disabled) {
    background: #218838;
  }

  .capture-button.active {
    background: #dc3545;
  }

  .capture-button.active:hover {
    background: #c82333;
  }

  .settings {
    margin-top: 1rem;
  }

  .settings label {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 1rem;
  }

  .settings input[type="range"] {
    flex: 1;
    max-width: 200px;
  }

  .spectrum-display {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    height: 150px;
    align-items: flex-end;
    margin-bottom: 1rem;
    background: #e9ecef;
    padding: 10px;
    border-radius: 8px;
  }

  .spectrum-bar-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    justify-content: flex-end;
  }

  .spectrum-bar {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: flex-end;
    background: rgba(0,0,0,0.05);
    border-radius: 4px 4px 0 0;
    overflow: hidden;
  }

  .spectrum-fill {
    width: 100%;
    transition: height 0.05s ease-out;
    border-radius: 4px 4px 0 0;
  }

  .spectrum-value {
    font-size: 0.7rem;
    color: #666;
    margin-top: 4px;
  }

  .peak-values {
    text-align: center;
    margin-top: 1rem;
  }

  .max-peak {
    font-family: monospace;
    font-size: 0.9rem;
    color: #007bff;
    word-break: break-all;
    background: #fff;
    padding: 0.5rem;
    border-radius: 4px;
    border: 1px solid #dee2e6;
  }

  .info-section ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .info-section li {
    margin-bottom: 0.5rem;
    color: #6c757d;
  }

  @media (max-width: 600px) {
    main {
      padding: 1rem;
    }
    
    .connection-buttons {
      flex-direction: column;
    }
    
    .settings label {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
