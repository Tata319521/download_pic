function downloadAllImages() {
  const files = [
    {
      url: "./images/pic1.jpg",
      name: "image-01.jpg"
    },
    {
      url: "./images/pic2.jpg",
      name: "image-02.jpg"
    },
    {
      url: "./images/pic3.jpg",
      name: "image-03.jpg"
    }
  ];

  files.forEach((file, index) => {
    setTimeout(() => {
      const link = document.createElement("a");
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, index * 300);
  });
}

const canvas = document.getElementById("particle-canvas");
const ctx = canvas.getContext("2d");

let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function createParticles() {
  particles = [];

  const count = Math.min(80, Math.floor(window.innerWidth / 18));

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 1.5 + 0.4,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.35 + 0.08
    });
  }
}

function drawParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;

    if (particle.x < 0 || particle.x > canvas.width) {
      particle.vx *= -1;
    }

    if (particle.y < 0 || particle.y > canvas.height) {
      particle.vy *= -1;
    }

    ctx.beginPath();
    ctx.arc(
      particle.x,
      particle.y,
      particle.radius,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = `rgba(255, 255, 255, ${particle.alpha})`;
    ctx.fill();
  });

  requestAnimationFrame(drawParticles);
}

window.addEventListener("resize", () => {
  resizeCanvas();
  createParticles();
});

resizeCanvas();
createParticles();
drawParticles();