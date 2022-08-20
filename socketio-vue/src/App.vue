<template>
  <div class="App">
    <form @submit.prevent="submitToken">
      <input type="text" placeholder="Enter token" v-model="token" />
      <button type="submit">Submit</button>
    </form>
    <div class="box">
      <div class="messages">
        <div v-for="user in messages" :key="user.id">
          {{user.name}}: {{user.message}}
        </div>
      </div>
      <div class="messages"></div>
      <form class="input-div" @submit.prevent="submitMessage">
        <input type="text" placeholder="Type in text" v-model="inputMessageText" />
        <button type="submit">Submit</button>
      </form>
    </div>
  </div>
</template>

<script>
import SocketioService from './services/socketio.service.js';

// static data only for demo purposes, in real world scenario, this would be already stored on client
const SENDER = {
  id: "123",
  name: "John Doe",
};

export default {
  name: 'App',
  components: {
  },
  data() {
    return {
      token: '',
      inputMessageText: '',
      messages: []
    };
  },
  methods: {
    submitToken() {
      console.log(this.token);
      SocketioService.setupSocketConnection(this.token);
      SocketioService.subscribeToMessages((err, data) => {
        console.log(data);
        this.messages.push(data);
      });
    },
    submitMessage() {
      const CHAT_ROOM = "myRandomChatRoomId";
      const message = this.inputMessageText;
      SocketioService.sendMessage({message, roomName: CHAT_ROOM}, cb => {
        // callback is acknowledgement from server
        console.log(cb);
        this.messages.push({
          message,
          ...SENDER
        });
        // clear the input after the message is sent
        this.inputMessageText = '';
      });
    }
  },
  beforeUnmount() {
    SocketioService.disconnect();
  }
}
</script>

<style>
.App {
  padding: 1rem;
}

.box {
  width: fit-content;
  height: 400px;
  border: solid 1px #000;
  display: flex;
  flex-direction: column;
  margin-top: 1rem;
}

.messages {
  flex-grow: 1;
}

.input-div {
  display: flex;
  width: 100%;
}
</style>
