function initInteractiveGrid() {
    const canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const spacing = 24;
    let mouse = { x: -1000, y: -1000 };

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    window.addEventListener('mouseleave', () => {
        mouse.x = -1000;
        mouse.y = -1000;
    });

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const isLight = document.body.classList.contains('light-theme');
        
        // Define theme dot color based on connection state (fetched from global state)
        const currentStatusColor = window.currentStatusColor || 'red';
        let dotRGB = '239, 68, 68'; // default red
        if (currentStatusColor === 'green') {
            dotRGB = '16, 185, 129';
        } else if (currentStatusColor === 'yellow') {
            dotRGB = '245, 158, 11';
        }
        
        const time = Date.now() * 0.002;
        const breathe = Math.sin(time);
        
        for (let x = spacing / 2; x < canvas.width; x += spacing) {
            for (let y = spacing / 2; y < canvas.height; y += spacing) {
                const dx = x - mouse.x;
                const dy = y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const maxDist = 100 + breathe * 15;
                
                let drawX = x;
                let drawY = y;
                
                ctx.beginPath();
                if (dist < maxDist) {
                    const factor = 1 - (dist / maxDist);
                    
                    // Bounce/Magnetic effect: push dots away from the cursor
                    const pushForce = factor * 10 * (1 + breathe * 0.25);
                    drawX += (dx / (dist || 1)) * pushForce;
                    drawY += (dy / (dist || 1)) * pushForce;
                    
                    const size = 1 + factor * (2.2 + breathe * 0.6);
                    ctx.arc(drawX, drawY, size, 0, Math.PI * 2);
                    
                    ctx.fillStyle = isLight 
                        ? `rgba(${dotRGB}, ${0.08 + factor * (0.5 + breathe * 0.05)})`
                        : `rgba(${dotRGB}, ${0.12 + factor * (0.75 + breathe * 0.08)})`;
                    
                    if (factor > 0.6) {
                        ctx.fillStyle = `rgba(${dotRGB}, ${factor * (0.85 + breathe * 0.15)})`;
                    }
                } else {
                    const ambientBreathe = Math.sin(time + (x + y) * 0.015);
                    ctx.arc(drawX, drawY, 1 + ambientBreathe * 0.2, 0, Math.PI * 2);
                    ctx.fillStyle = isLight
                        ? `rgba(${dotRGB}, ${0.05 + ambientBreathe * 0.01})`
                        : `rgba(${dotRGB}, ${0.09 + ambientBreathe * 0.02})`;
                }
                ctx.fill();
            }
        }
        requestAnimationFrame(draw);
    }
    draw();
}
initInteractiveGrid();
