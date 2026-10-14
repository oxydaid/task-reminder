const fs = require('fs')
const path = require('path')

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]
const iconsDir = path.join(__dirname, 'frontend', 'public', 'icons')

// Simple SVG template
const svgTemplate = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <rect width="100" height="100" rx="20" fill="#3b82f6"/>
  <path d="M25 35h50M25 50h30M25 65h40" stroke="white" stroke-width="8" stroke-linecap="round"/>
  <circle cx="75" cy="75" r="15" fill="white" opacity="0.2"/>
  <path d="M70 75l5 5 10-10" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`

// Create SVG files (as placeholder - in production you'd convert to PNG)
sizes.forEach(size => {
  const svgContent = svgTemplate(size)
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.svg`), svgContent)
})

// Create a simple HTML to generate PNGs
const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Generate Icons</title></head>
<body>
  <canvas id="canvas"></canvas>
  <script>
    const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    
    function drawIcon(size) {
      canvas.width = size;
      canvas.height = size;
      
      // Background
      ctx.fillStyle = '#3b82f6';
      roundRect(ctx, 0, 0, size, size, size * 0.2);
      ctx.fill();
      
      // Lines
      ctx.strokeStyle = 'white';
      ctx.lineWidth = size * 0.08;
      ctx.lineCap = 'round';
      
      ctx.beginPath();
      ctx.moveTo(size * 0.25, size * 0.35);
      ctx.lineTo(size * 0.75, size * 0.35);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(size * 0.25, size * 0.5);
      ctx.lineTo(size * 0.55, size * 0.5);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(size * 0.25, size * 0.65);
      ctx.lineTo(size * 0.65, size * 0.65);
      ctx.stroke();
      
      // Checkmark circle
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.beginPath();
      ctx.arc(size * 0.75, size * 0.75, size * 0.15, 0, Math.PI * 2);
      ctx.fill();
      
      // Checkmark
      ctx.strokeStyle = 'white';
      ctx.lineWidth = size * 0.04;
      ctx.beginPath();
      ctx.moveTo(size * 0.7, size * 0.75);
      ctx.lineTo(size * 0.75, size * 0.8);
      ctx.lineTo(size * 0.85, size * 0.65);
      ctx.stroke();
      
      return canvas.toDataURL('image/png');
    }
    
    function roundRect(ctx, x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }
    
    sizes.forEach(size => {
      const dataUrl = drawIcon(size);
      const link = document.createElement('a');
      link.download = 'icon-' + size + 'x' + size + '.png';
      link.href = dataUrl;
      link.click();
    });
  </script>
</body>
</html>`

fs.writeFileSync(path.join(iconsDir, 'generate-icons.html'), htmlContent)

console.log('Icon SVG placeholders created. Open generate-icons.html in browser to download PNGs.')