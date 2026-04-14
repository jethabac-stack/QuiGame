// Math Symbols Rain Background Animation
const canvas = document.getElementById('mathRain');
const ctx = canvas.getContext('2d');

// Comprehensive math symbols from various fields
const symbols = [
  // Basic Math & Numbers
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  '+', '-', '×', '÷', '=', '≠', '<', '>', '≤', '≥',
  '±', '∓', '%', '‰',
  
  // Geometry
  '∠', '∟', '⊥', '∥', '△', '□', '⊙', '⊕', '⊗', '◇',
  '∆', '∇', '⟂',
  
  // Algebra
  '^', '√', '∛', '∜', '∕', '∫', '∂', '∆',
  
  // Linear Algebra & Calculus
  '∑', '∏', '∫', '∂', '∇', '∞', '⊕', '⊗',
  
  // Greek Letters
  'α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ', 'ι', 'κ',
  'λ', 'μ', 'ν', 'ξ', 'π', 'ρ', 'σ', 'τ', 'υ', 'φ',
  'χ', 'ψ', 'ω', 'Α', 'Β', 'Γ', 'Δ', 'Π', 'Σ', 'Ω',
  
  // Set Theory & Logic
  '∈', '∉', '∋', '∌', '⊂', '⊃', '⊆', '⊇', '⊄', '⊅',
  '∩', '∪', '∅', '∀', '∃', '¬', '∧', '∨',
  
  // Other Mathematical Notations
  '≈', '≡', '≅', '≍', '∝', '⟨', '⟩', '⟦', '⟧',
  '↑', '↓', '←', '→', '↔', '↕', '⇒', '⇐', '⇔', '⟹',
  'ℝ', 'ℂ', 'ℚ', 'ℕ', 'ℤ', 'ℂ',
];

let particles = [];

// Particle class
class MathParticle {
  constructor() {
    this.x = Math.random() * canvas.width;
    this.y = Math.random() * canvas.height - canvas.height;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = Math.random() * 2 + 1;
    this.opacity = Math.random() * 0.5 + 0.5;
    this.symbol = symbols[Math.floor(Math.random() * symbols.length)];
    this.size = Math.random() * 24 + 18;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotationSpeed = (Math.random() - 0.5) * 0.1;
    
    // Random color
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#A8D8EA'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.rotationSpeed;
    
    // Fade out near bottom
    if (this.y > canvas.height - 100) {
      this.opacity = Math.max(0, this.opacity - 0.02);
    }
  }

  draw() {
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    // Main text - random color with full opacity
    ctx.fillStyle = this.color;
    ctx.font = `bold ${this.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.symbol, 0, 0);
    ctx.restore();
  }

  isAlive() {
    return this.opacity > 0 && this.y < canvas.height + 50;
  }
}

// Setup canvas
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// Init
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Animation loop
function animate() {
  // Clear canvas completely - no trail effect
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Add new particles
  if (particles.length < 50 && Math.random() > 0.6) {
    particles.push(new MathParticle());
  }

  // Update and draw particles
  particles = particles.filter(p => p.isAlive());
  particles.forEach(p => {
    p.update();
    p.draw();
  });

  requestAnimationFrame(animate);
}

// Start animation
animate();
