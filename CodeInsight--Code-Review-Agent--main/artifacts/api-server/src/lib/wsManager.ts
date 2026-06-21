import { WebSocket } from "ws";
import { logger } from "./logger";

class WebSocketManager {
  private connections = new Map<string, Set<WebSocket>>();

  register(reviewId: string, ws: WebSocket): void {
    if (!this.connections.has(reviewId)) {
      this.connections.set(reviewId, new Set());
    }
    this.connections.get(reviewId)!.add(ws);
    logger.info({ reviewId }, "WebSocket client connected");

    ws.on("close", () => {
      this.connections.get(reviewId)?.delete(ws);
      if (this.connections.get(reviewId)?.size === 0) {
        this.connections.delete(reviewId);
      }
      logger.info({ reviewId }, "WebSocket client disconnected");
    });
  }

  broadcast(reviewId: string, data: unknown): void {
    const clients = this.connections.get(reviewId);
    if (!clients || clients.size === 0) return;

    const message = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}

export const wsManager = new WebSocketManager();
