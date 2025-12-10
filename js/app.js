import { FaviconManager } from './favicon.js';

class FavLettersApp {
    constructor() {
        this.myId = crypto.randomUUID();
        this.createdAt = Date.now();
        this.customPriority = 0; // Lower is better (earlier in list)
        this.channel = new BroadcastChannel('favletters_v1');
        
        this.state = {
            text: 'FAV',
            peers: new Map(), // id -> { createdAt, lastSeen, customPriority }
        };

        // Add myself to peers map initially (will be overwritten by logic, but good for local render)
        this.state.peers.set(this.myId, { 
            createdAt: this.createdAt, 
            lastSeen: Date.now(),
            customPriority: this.customPriority
        });

        this.favicon = new FaviconManager();
        this.ui = {
            input: document.getElementById('main-input'),
            peerList: document.getElementById('peer-list'),
            connectionStatus: document.getElementById('connection-status'),
            myIndexDisplay: document.getElementById('my-index-display'),
            makeFirstBtn: document.getElementById('make-first-btn')
        };
        
        this.init();
    }

    init() {
        // UI Events
        this.ui.input.value = this.state.text;
        this.ui.input.addEventListener('input', (e) => this.handleInput(e));
        this.ui.makeFirstBtn.addEventListener('click', () => this.makeMeFirst());

        // Channel Events
        this.channel.onmessage = (e) => this.handleMessage(e.data);

        // Periodic Tasks
        this.cleanPeersInterval = setInterval(() => this.cleanPeers(), 1000);
        this.heartbeatInterval = setInterval(() => this.broadcastHeartbeat(), 1000);
        this.renderInterval = requestAnimationFrame(() => this.renderLoop()); // Using AF for UI updates if needed, but event driven is better. 
        // We'll stick to event-driven + periodic render updates for peer list
        setInterval(() => this.render(), 500);

        // Initial broadcast
        this.broadcastHeartbeat();
        this.channel.postMessage({ type: 'request_state', senderId: this.myId });

        console.log(`FavLetters Initialized. ID: ${this.myId}`);
        this.updateFavicon();
    }

    // --- Logic ---

    handleInput(e) {
        const newText = e.target.value;
        this.state.text = newText;
        // Broadcast
        this.channel.postMessage({
            type: 'text_update',
            text: newText,
            senderId: this.myId,
            timestamp: Date.now()
        });
        this.updateFavicon();
    }

    makeMeFirst() {
        // Find the absolute minimum priority currently known
        let minPrio = 0;
        for (const peer of this.state.peers.values()) {
            if (peer.customPriority < minPrio) minPrio = peer.customPriority;
        }
        
        this.customPriority = minPrio - 1;
        this.state.peers.set(this.myId, {
            createdAt: this.createdAt,
            lastSeen: Date.now(),
            customPriority: this.customPriority
        });
        
        // Force immediate heartbeat to notify others
        this.broadcastHeartbeat();
        this.render();
    }

    broadcastHeartbeat() {
        this.channel.postMessage({
            type: 'heartbeat',
            id: this.myId,
            createdAt: this.createdAt,
            customPriority: this.customPriority
        });
    }

    handleMessage(data) {
        switch (data.type) {
            case 'heartbeat':
                this.state.peers.set(data.id, {
                    createdAt: data.createdAt,
                    lastSeen: Date.now(),
                    customPriority: data.customPriority || 0
                });
                break;
                
            case 'text_update':
                // Only update if it's new (simple logic, could be improved with vector clocks but overkill)
                if (data.text !== this.state.text) {
                    this.state.text = data.text;
                    this.ui.input.value = data.text;
                    this.updateFavicon();
                }
                break;

            case 'request_state':
                // Someone joined, send them the current text if we have it
                // Only one peer needs to respond, ideally the "leader".
                // Simple approach: everyone responds with a heartbeat, but we also send text_update
                this.channel.postMessage({
                    type: 'text_update',
                    text: this.state.text,
                    senderId: this.myId,
                    timestamp: Date.now()
                });
                break;
        }
    }

    cleanPeers() {
        const now = Date.now();
        let changed = false;
        
        // Always ensure I am in the list
        this.state.peers.set(this.myId, {
            createdAt: this.createdAt,
            lastSeen: now,
            customPriority: this.customPriority
        });

        for (const [id, peer] of this.state.peers) {
            if (id !== this.myId && now - peer.lastSeen > 3000) {
                this.state.peers.delete(id);
                changed = true;
            }
        }
        if (changed) this.render();
    }

    getSortedPeers() {
        return Array.from(this.state.peers.entries())
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => {
                // Primary: Custom Priority (asc)
                if (a.customPriority !== b.customPriority) {
                    return a.customPriority - b.customPriority;
                }
                // Secondary: Created At (asc)
                return a.createdAt - b.createdAt;
            });
    }

    getMyIndex() {
        const sorted = this.getSortedPeers();
        return sorted.findIndex(p => p.id === this.myId);
    }

    // --- Rendering ---

    updateFavicon() {
        const index = this.getMyIndex();
        const char = this.state.text[index] || ''; 
        // Fallback: if index out of bounds (e.g. typing "AB" but I'm tab 3), show empty or maybe '?'
        // Actually, let's just show space if undefined
        
        this.favicon.update(char || ' ');
    }

    render() {
        const sortedPeers = this.getSortedPeers();
        const myIndex = this.getMyIndex();
        const peerCount = sortedPeers.length;

        // Update Text
        this.ui.connectionStatus.textContent = `${peerCount} Active Tab${peerCount !== 1 ? 's' : ''}`;
        this.ui.myIndexDisplay.textContent = `Index: ${myIndex}`;

        // Update Dots
        this.ui.peerList.innerHTML = '';
        sortedPeers.forEach((peer, idx) => {
            const dot = document.createElement('div');
            dot.className = 'peer-dot';
            if (peer.id === this.myId) dot.classList.add('me');
            if (this.state.text[idx]) dot.classList.add('active'); // Light up if there's a letter for this slot
            
            // Tooltip or title
            dot.title = `Tab ${idx} ${peer.id === this.myId ? '(You)' : ''}`;
            
            this.ui.peerList.appendChild(dot);
        });

        this.updateFavicon();
    }
}
