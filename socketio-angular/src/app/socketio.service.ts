import { environment } from './../environments/environment';
import { Injectable } from '@angular/core';
import * as io from 'socket.io-client';

@Injectable({
  providedIn: 'root'
})
export class SocketioService {

  socket;
  constructor() {   }

  setupSocketConnection() {
    this.socket = io(environment.SOCKET_ENDPOINT, {
      query: {
        token: 'cde'
      }
    });

    this.socket.emit('my message', 'Hello there from Angular.');

    this.socket.on('my broadcast', (data: string) => {
      console.log(data);
    });
  }
}
