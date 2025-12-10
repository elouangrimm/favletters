import { FaviconManager } from './favicon.js';

class FavLettersApp {

    constructor() {
        try {
            // Safe ID generation (works in non-secure contexts too)
            this.myId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            this.createdAt = Date.now();
            this.customPriority = 0;
            this.channel = new BroadcastChannel('favletters_v1');
            
            // Load from LocalStorage or default
            const initialText = localStorage.getItem('favletters_text') || 'FAV';

            this.state = {
                text: initialText,
                peers: new Map(),
            };

            // Add myself
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
        } catch (e) {
            console.error("Critical Initialization Error:", e);
            document.body.innerHTML = `<div style="color:red; padding:20px;">App Error: ${e.message}</div>`;
        }
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
        
        // Render Immediately
        this.render();

        // Initial broadcast
        this.broadcastHeartbeat();
        this.channel.postMessage({ type: 'request_state', senderId: this.myId });

        console.log(`FavLetters Initialized. ID: ${this.myId}`);
    }

    // --- Logic ---

    handleInput(e) {
        const newText = e.target.value;
        this.state.text = newText;
        
        // Persist
        localStorage.setItem('favletters_text', newText);

        // Broadcast
        this.channel.postMessage({
            type: 'text_update',
            text: newText,
            senderId: this.myId,
            timestamp: Date.now()
        });
        this.updateFavicon();
        // Re-render local UI immediatey to show active dot state change if needed
        this.render(); 
    }

    makeMeFirst() {
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
                this.render(); // Update UI on heartbeat for snappy feeling
                break;
                
            case 'text_update':
                if (data.text !== this.state.text) {
                    this.state.text = data.text;
                    this.ui.input.value = data.text;
                    localStorage.setItem('favletters_text', data.text); // Sync persistence
                    this.updateFavicon();
                    this.render();
                }
                break;

            case 'request_state':
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
                if (a.customPriority !== b.customPriority) {
                    return a.customPriority - b.customPriority;
                }
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
            
            // Check if this slot has a character
            if (idx < this.state.text.length && this.state.text[idx] !== ' ') {
                 dot.classList.add('active');
            }
            
            dot.title = `Tab ${idx} ${peer.id === this.myId ? '(You)' : ''}`;
            
            this.ui.peerList.appendChild(dot);
        });

        this.updateFavicon();
    }
}
