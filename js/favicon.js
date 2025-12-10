/**
 * FaviconManager - Handles drawing to canvas and updating the favicon
 */
export class FaviconManager {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = 64;
        this.canvas.height = 64;
        this.ctx = this.canvas.getContext('2d');
        this.link = document.querySelector("link[rel~='icon']") || this.createLink();
    }

    createLink() {
        const link = document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'icon';
        document.head.appendChild(link);
        return link;
    }

    update(char, color = '#ffffff', bg = '#000000') {
        const { ctx, canvas } = this;
        
        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Background (Rounded rect or circle)
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.roundRect(0, 0, 64, 64, 16); // Standard rounded square
        ctx.fill();

        // Text
        ctx.fillStyle = color;
        ctx.font = 'bold 40px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char.toUpperCase(), 32, 34); // Slightly offset for visual center

        // Update Link
        this.link.href = canvas.toDataURL();
    }
}
