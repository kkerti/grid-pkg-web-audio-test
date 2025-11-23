const WebSocket = require('ws');

// Create WebSocket server on port 1111 (Grid package port)
const wss = new WebSocket.Server({ port: 1111 });

console.log('Grid WebSocket server listening on port 1111...');

wss.on('connection', (ws) => {
  console.log('Client connected to Grid WebSocket server');
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Connected to Grid package WebSocket server',
    timestamp: Date.now()
  }));

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'audio-peak') {
        console.log(`Audio Peak: ${(message.value * 100).toFixed(1)}% at ${new Date(message.timestamp).toLocaleTimeString()}`);
        
        // Echo back to client for confirmation (optional)
        ws.send(JSON.stringify({
          type: 'peak-received',
          originalValue: message.value,
          timestamp: Date.now()
        }));
      } else if (message.type === 'audio-peak-bands') {
        console.log(`Audio Bands (Lua): ${message.value} at ${new Date(message.timestamp).toLocaleTimeString()}`);
      } else {
        console.log('Received message:', message);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
      console.log('Raw message:', data.toString());
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected from Grid WebSocket server');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('\nShutting down Grid WebSocket server...');
  wss.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});