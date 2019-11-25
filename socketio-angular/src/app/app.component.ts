import { SocketioService } from './socketio.service';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'socketio-angular';
  constructor(private socketService: SocketioService) {}

  ngOnInit() {
    this.socketService.setupSocketConnection();
  }
}
