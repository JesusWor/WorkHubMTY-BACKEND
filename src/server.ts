import app from "./app";
import http from "http";
import { initSocket } from "./infra/websocket/socket.server";

const server = http.createServer(app) 
const PORT = process.env.PORT || 3000;

initSocket(server);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.listen(PORT, () => {
  console.log("Server running");
})