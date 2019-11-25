import { TestBed } from '@angular/core/testing';

import { SocketioService } from './socketio.service';

describe('SocketioService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: SocketioService = TestBed.get(SocketioService);
    expect(service).toBeTruthy();
  });
});
