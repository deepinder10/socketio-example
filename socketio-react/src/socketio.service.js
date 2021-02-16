import { io } from 'socket.io-client';

let socket;
export const initiateSocketConnection = (room) => {
  socket = io(process.env.REACT_APP_SOCKET_ENDPOINT, {
		auth: {
			token: 'cde'
		},
	});
	console.log(`Connecting socket...`);
}
export const disconnectSocket = () => {
  console.log('Disconnecting socket...');
  if(socket) socket.disconnect();
}
export const subscribeToChat = (cb) => {
	socket.emit('my message', 'Hello there from React.');
  if (!socket) return(true);
  socket.on('my broadcast', msg => {
    console.log('Websocket event received!');
    return cb(null, msg);
  });
}
export const sendMessage = (room, message) => {
  if (socket) socket.emit('chat', { message, room });
}