// This one line is all we need to connect to the Socket.IO server!
// When this script runs in the browser, it will automatically find the
// server that delivered the page and establish a websocket connection.
const socket = io();

// We can add a simple test to confirm the connection on the client-side.
socket.on('connect', () => {
  console.log('Successfully connected to the server!', socket.id);
});
