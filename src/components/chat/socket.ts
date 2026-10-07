"use client";

import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function chatSocket(): Socket {
  if (!socket) {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;
    socket = io(url, {
      path: "/socket.io/",
      withCredentials: true,
      autoConnect: true,
    });
  }
  return socket;
}
