import { Response } from 'express';
import crypto from 'crypto';

interface SSEClient {
    id: string;
    res: Response;
    storeId: string;
}

class NotificationService {
    private clients: SSEClient[] = [];

    constructor() {
        // Start keep-alive interval to prevent timeout
        setInterval(() => this.sendKeepAlive(), 15000); // Every 15 seconds
    }

    /**
     * Add a new client connection
     */
    addClient(res: Response, storeId: string) {
        const id = crypto.randomUUID();
        const client: SSEClient = { id, res, storeId };

        this.clients.push(client);

        // [CRITICAL] Immediate Open Comment
        res.write(': open\n\n');

        // [SSE Fix] Send 2KB of padding to flush Nginx/Proxy buffers
        const padding = ': ' + ' '.repeat(2048) + '\n\n';
        res.write(padding);

        // Initial connection established message
        this.sendEventToClient(client, 'connected', {
            message: 'SSE Connection Established',
            clientId: id
        });

        console.log(`[SSE] Client connected: ${id} (Store: ${storeId})`);

        // Remove client when connection closes
        res.on('close', () => {
            this.removeClient(id);
        });
    }

    /**
     * Remove a client connection
     */
    removeClient(id: string) {
        this.clients = this.clients.filter(client => client.id !== id);
        console.log(`[SSE] Client disconnected: ${id}`);
    }

    /**
     * Broadcast an event to all connected clients of a specific store
     */
    broadcast(storeId: string, type: string, data: any) {
        const targetClients = this.clients.filter(client => client.storeId === storeId);

        if (targetClients.length === 0) {
            // console.log(`[SSE] No active clients for store ${storeId}, skipping broadcast.`);
            return;
        }

        console.log(`[SSE] Broadcasting ${type} to ${targetClients.length} clients (Store: ${storeId})`);

        targetClients.forEach(client => {
            this.sendEventToClient(client, type, data);
        });
    }

    /**
     * Send raw event data to a specific client
     */
    private sendEventToClient(client: SSEClient, type: string, data: any) {
        try {
            client.res.write(`event: ${type}\n`);
            client.res.write(`data: ${JSON.stringify(data)}\n\n`);
        } catch (error) {
            console.error(`[SSE] Error sending to client ${client.id}:`, error);
            this.removeClient(client.id);
        }
    }

    /**
     * Send keep-alive comment to all clients
     * This prevents load balancers/browsers from killing the connection
     */
    private sendKeepAlive() {
        if (this.clients.length === 0) return;

        this.clients.forEach(client => {
            try {
                // Comments starting with colon are ignored by EventSource but keep connection alive
                client.res.write(': keep-alive\n\n');
            } catch (error) {
                this.removeClient(client.id);
            }
        });
    }
}

export const notificationService = new NotificationService();
