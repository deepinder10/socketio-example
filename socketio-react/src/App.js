import './App.css';
import React, {useEffect, useState, useRef} from 'react';
import {
	initiateSocketConnection,
	disconnectSocket,
  sendMessage,
  subscribeToMessages,
} from "./socketio.service";

// static data only for demo purposes, in real world scenario, this would be already stored on client
const SENDER = {
  id: '123',
  name: "John Doe"
};

function App() {
  const CHAT_ROOM = 'myRandomChatRoomId';

  const [token, setToken] = useState('');
  const [messages, setMessages] = useState([]);

  const tokenInputRef = useRef('');
  const inputRef = useRef('');

  useEffect(() => {
    if (token) {
      initiateSocketConnection(token);
      subscribeToMessages((err, data) => {
        console.log(data);
        setMessages(prev => [...prev, data]);
      });
      return () => {
        disconnectSocket();
      }
    }
  }, [token]);

  const submitToken = (e) => {
    e.preventDefault();
    const tokenValue = tokenInputRef.current.value;
    setToken(tokenValue);
  }

  const submitMessage = (e) => {
    e.preventDefault();
    const message = inputRef.current.value;
    sendMessage({message, roomName: CHAT_ROOM}, cb => {
      // callback is acknowledgement from server
      console.log(cb);
      setMessages(prev => [...prev, {
          message,
          ...SENDER
        }]
      );
      // clear the input after the message is sent
      inputRef.current.value = '';
    });
  }

  return (
    <div className="App">
      <form onSubmit={submitToken}>
        <input type="text" placeholder="Enter token" ref={tokenInputRef} />
        <button type="submit">Submit</button>
      </form>
      {/* <button onClick={() => joinChatRoom()}>Join Room</button> */}
      <div className="box">
        <div className="messages">
          {messages.map((user, index) => <div key={index}>{user.name}: {user.message}</div>)}
        </div>
        <form className="input-div" onSubmit={submitMessage}>
          <input type="text" placeholder="Type in text" ref={inputRef} />
          <button type="submit">Submit</button>
        </form>
      </div>
    </div>
  );
}

export default App;
