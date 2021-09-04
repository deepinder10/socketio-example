import { environment } from './../environments/environment';
import { Injectable } from '@angular/core';
import { io } from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SocketioService {

  socket;
  constructor() {   }

  setupSocketConnection(token: string) {
    this.socket = io(environment.SOCKET_ENDPOINT, {
      auth: {
        token
      }
    });
  }

  // Handle message receive event
  subscribeToMessages = (cb) => {
    if (!this.socket) return(true);
    this.socket.on('message', msg => {
      console.log('Room event received!');
      return cb(null, msg);
    });
  }

  sendMessage = ({message, roomName}, cb) => {
    if (this.socket) this.socket.emit('message', { message, roomName }, cb);
  }

  joinRoom = (roomName) => {
    this.socket.emit('join', roomName);
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
