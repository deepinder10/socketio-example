import { SocketioService } from './socketio.service';
import { Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';

// static data only for demo purposes, in real world scenario, this would be already stored on client
const SENDER = {
  id: "123",
  name: "John Doe",
};
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit {
  title = 'socketio-angular';

  CHAT_ROOM = "myRandomChatRoomId";

  messages = [];

  tokenForm = this.formBuilder.group({
    token: '',
  });

  messageForm = this.formBuilder.group({
    message: '',
  });

  constructor(private socketService: SocketioService, private formBuilder: FormBuilder) {}

  ngOnInit() {
  }

  submitToken() {
    const token = this.tokenForm.get('token').value;
    if (token) {
      this.socketService.setupSocketConnection(token);
      this.socketService.subscribeToMessages((err, data) => {
        console.log("NEW MESSAGE ", data);
        this.messages = [...this.messages, data];
      });
    }
  }

  submitMessage() {
    const message = this.messageForm.get('message').value;
    if (message) {
      this.socketService.sendMessage({message, roomName: this.CHAT_ROOM}, cb => {
        console.log("ACKNOWLEDGEMENT ", cb);
      });
      this.messages = [
        ...this.messages,
        {
          message,
          ...SENDER,
        },
      ];
      // clear the input after the message is sent
      this.messageForm.reset();
    }
  }
  
  ngOnDestroy() {
    this.socketService.disconnect();
  }
}
