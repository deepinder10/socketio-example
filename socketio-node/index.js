const app = require('express')();
const http = require('http').createServer(app);
const io = require("socket.io")(http, {
	cors: {
		origins: [
			"http://localhost:3001",
			"http://localhost:4200",
			"http://localhost:8080",
		],
	},
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  console.log('token', token);
  next();
});

app.get('/', (req, res) => {
  res.send('<h1>Hey Socket.io</h1>');
});

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
  socket.on('my message', (msg) => {
    console.log('message: ' + msg);
    io.emit('my broadcast', `server: ${msg}`);
  });
});

http.listen(3000, () => {
  console.log('listening on *:3000');
});
