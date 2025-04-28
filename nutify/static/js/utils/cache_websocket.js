/**
 * CacheWebSocketManager
 * Manages WebSocket connections for real-time cache updates across the application.
 * 
 * This class provides:
 * - WebSocket connection management
 * - Automatic reconnection
 * - Event handling for cache updates
 */
class CacheWebSocketManager {
    /**
     * Create a new WebSocket manager
     * @param {Object} options - Configuration options
     * @param {Function} options.onUpdate - Callback function for cache updates
     * @param {Function} options.onConnect - Callback function for connection events
     * @param {Function} options.onDisconnect - Callback function for disconnection events
     * @param {boolean} options.debug - Whether to enable debug logging
     */
    constructor(options = {}) {
        this.options = {
            onUpdate: () => {},
            onConnect: () => {},
            onDisconnect: () => {},
            debug: false,
            ...options
        };
        
        this.socket = null;
        this.isConnected = false;
        this.reconnectInterval = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        
        this.init();
    }
    
    /**
     * Initialize the WebSocket connection
     */
    init() {
        this.log('Initializing WebSocket connection...');
        
        // Check if Socket.IO is available
        if (!window.io) {
            this.log('Socket.IO not available. Make sure socket.io.js is loaded', 'error');
            return;
        }
        
        try {
            // Connect to the WebSocket server
            this.socket = io();
            this.setupEventHandlers();
        } catch (error) {
            this.log(`Error initializing WebSocket: ${error}`, 'error');
        }
    }
    
    /**
     * Dispatch a custom event for websocket state changes
     * @param {Object} state - The current state of the websocket connection
     */
    dispatchStateEvent(state) {
        const event = new CustomEvent('websocket_state', { 
            detail: state
        });
        window.dispatchEvent(event);
    }
    
    /**
     * Dispatch a custom event for websocket messages
     * @param {Object} data - The data received from the websocket
     */
    dispatchMessageEvent(data) {
        const event = new CustomEvent('websocket_message', { 
            detail: data
        });
        window.dispatchEvent(event);
    }
    
    /**
     * Set up WebSocket event handlers
     */
    setupEventHandlers() {
        // Connection established
        this.socket.on('connect', () => {
            this.log('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // Clear any reconnect interval
            if (this.reconnectInterval) {
                clearInterval(this.reconnectInterval);
                this.reconnectInterval = null;
            }
            
            // Request initial cache data
            this.socket.emit('request_cache_data');
            
            // Call the onConnect callback
            this.options.onConnect();
            
            // Dispatch state event
            this.dispatchStateEvent({ 
                connected: true, 
                reconnecting: false 
            });
        });
        
        // Connection lost
        this.socket.on('disconnect', () => {
            this.log('WebSocket disconnected');
            this.isConnected = false;
            this.options.onDisconnect();
            
            // Dispatch state event
            this.dispatchStateEvent({ 
                connected: false, 
                reconnecting: false 
            });
            
            // Setup reconnection attempts
            this.setupReconnection();
        });
        
        // Handle cache updates from the server
        this.socket.on('cache_update', (data) => {
            this.log(`Received cache update: ${JSON.stringify(data)}`, 'debug');
            // Pass the data to the callback
            this.options.onUpdate(data);
            
            // Dispatch message event
            this.dispatchMessageEvent(data);
        });
        
        // Error handling
        this.socket.on('connect_error', (error) => {
            this.log(`WebSocket connection error: ${error}`, 'error');
            this.isConnected = false;
            this.options.onDisconnect();
            
            // Dispatch state event
            this.dispatchStateEvent({ 
                connected: false, 
                reconnecting: false,
                error: error.message || 'Connection error'
            });
            
            // Setup reconnection attempts
            this.setupReconnection();
        });
    }
    
    /**
     * Set up WebSocket reconnection
     */
    setupReconnection() {
        if (this.reconnectInterval) {
            // Already trying to reconnect
            return;
        }
        
        this.reconnectAttempts++;
        
        // Dispatch state event for reconnection attempt
        this.dispatchStateEvent({
            connected: false,
            reconnecting: true,
            reconnectAttempt: this.reconnectAttempts,
            maxReconnectAttempts: this.maxReconnectAttempts
        });
        
        if (this.reconnectAttempts <= this.maxReconnectAttempts) {
            this.log(`Setting up WebSocket reconnection (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            
            // Set up interval for reconnection attempts
            this.reconnectInterval = setInterval(() => {
                // Try to reconnect the WebSocket
                if (this.socket && !this.isConnected) {
                    this.log('Attempting to reconnect WebSocket...');
                    this.socket.connect();
                }
            }, this.reconnectDelay);
        } else {
            this.log('Max reconnect attempts reached. Giving up.', 'error');
            
            // Dispatch state event for max attempts reached
            this.dispatchStateEvent({
                connected: false,
                reconnecting: false,
                maxAttemptsReached: true
            });
        }
    }
    
    /**
     * Log messages according to debug setting
     * @param {string} message - The message to log
     * @param {string} level - Log level (log, debug, error)
     */
    log(message, level = 'log') {
        if (this.options.debug || level === 'error') {
            if (level === 'error') {
                console.error(`[CacheWebSocket] ${message}`);
            } else if (level === 'debug' && this.options.debug) {
                console.debug(`[CacheWebSocket] ${message}`);
            } else if (this.options.debug) {
                console.log(`[CacheWebSocket] ${message}`);
            }
        }
    }
    
    /**
     * Manually disconnect WebSocket
     */
    disconnect() {
        if (this.socket) {
            this.log('Manually disconnecting WebSocket');
            this.socket.disconnect();
        }
        
        if (this.reconnectInterval) {
            clearInterval(this.reconnectInterval);
            this.reconnectInterval = null;
        }
    }
    
    /**
     * Request latest cache data
     */
    requestCacheData() {
        if (this.socket && this.isConnected) {
            this.log('Requesting latest cache data');
            this.socket.emit('request_cache_data');
        } else {
            this.log('Cannot request cache data: WebSocket not connected', 'error');
        }
    }
}

// Automatically initialize if window object exists
if (typeof window !== 'undefined') {
    window.CacheWebSocketManager = CacheWebSocketManager;
    
    // Initialize a global instance once the DOM is loaded
    document.addEventListener('DOMContentLoaded', () => {
        // Create global instance with debug logging based on global setting
        window.cacheWebSocketManager = new CacheWebSocketManager({
            debug: window.GLOBAL_JS_LOGGING_ENABLED || false,
            onUpdate: (data) => {
                // Global handler for cache updates, can be used by any component
                if (window.GLOBAL_JS_LOGGING_ENABLED) {
                    console.log(`[Cache] Update received: ${data.type}`);
                }
            }
        });
    });
} 