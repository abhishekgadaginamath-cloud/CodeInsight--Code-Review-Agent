import { useRef, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion, useAnimationFrame } from "framer-motion";

/* ─── Particle canvas background ─── */
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener("resize", resize);
    const pts = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.5 + 0.4,
      o: Math.random() * 0.4 + 0.08,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(139,92,246,${p.o})`;
        ctx.fill();
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 110) {
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(139,92,246,${0.12 * (1 - d / 110)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}

/* ─── Typewriter hook ─── */
function useTypewriter(text: string, speed = 85, delay = 1300) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    let i = 0;
    const t = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) { clearInterval(iv); setDone(true); }
      }, speed);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(t);
  }, [text, speed, delay]);
  return { displayed, done };
}

/* ─── Orbital rings canvas ─── */
function OrbitalRings({ size }: { size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);

  useAnimationFrame((_, delta) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    angleRef.current += (delta / 1000) * (2 * Math.PI / 13);
    ctx.clearRect(0, 0, W, H);

    const r1 = W * 0.46, r2 = W * 0.38, r3 = W * 0.30;

    // Static faint rings
    for (const [r, alpha, lw] of [[r2, 0.22, 1.5], [r3, 0.13, 1]] as [number, number, number][]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139,92,246,${alpha})`;
      ctx.lineWidth = lw;
      ctx.stroke();
    }

    // Bright outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r1, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(100,80,220,0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rotating glowing arc
    const a = angleRef.current;
    const arcGrad = ctx.createLinearGradient(
      cx + Math.cos(a) * r1, cy + Math.sin(a) * r1,
      cx + Math.cos(a + Math.PI) * r1, cy + Math.sin(a + Math.PI) * r1
    );
    arcGrad.addColorStop(0, "rgba(124,58,237,0)");
    arcGrad.addColorStop(0.35, "rgba(139,92,246,1)");
    arcGrad.addColorStop(0.65, "rgba(59,130,246,1)");
    arcGrad.addColorStop(1, "rgba(59,130,246,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, r1, a, a + Math.PI * 1.1);
    ctx.strokeStyle = arcGrad;
    ctx.lineWidth = 4.5;
    ctx.shadowColor = "#818cf8";
    ctx.shadowBlur = 22;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Three orbiting glowing orbs
    for (const [offset, color] of [
      [0, "#c084fc"],
      [Math.PI * 0.72, "#60a5fa"],
      [Math.PI * 1.44, "#a78bfa"],
    ] as [number, string][]) {
      const ox = cx + Math.cos(a + offset) * r1;
      const oy = cy + Math.sin(a + offset) * r1;
      const grd = ctx.createRadialGradient(ox, oy, 0, ox, oy, 10);
      grd.addColorStop(0, "white");
      grd.addColorStop(0.35, color);
      grd.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(ox, oy, 10, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.shadowColor = color;
      ctx.shadowBlur = 24;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  });

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="absolute inset-0 w-full h-full"
    />
  );
}

/* ─── Floating code symbols ─── */
const FLOATERS: { sym: string; left: string; top: string; fontSize: string; delay: number }[] = [
  { sym: "{ }",  left: "7%",  top: "20%", fontSize: "1.2rem", delay: 0.0 },
  { sym: "</>",  left: "83%", top: "16%", fontSize: "1.1rem", delay: 0.6 },
  { sym: "[ ]",  left: "5%",  top: "60%", fontSize: "1rem",   delay: 1.1 },
  { sym: "=>",   left: "87%", top: "60%", fontSize: "1.1rem", delay: 0.3 },
  { sym: "git",  left: "76%", top: "30%", fontSize: "0.9rem", delay: 0.9 },
  { sym: "fn()", left: "16%", top: "78%", fontSize: "0.85rem",delay: 1.5 },
  { sym: "//",   left: "4%",  top: "38%", fontSize: "1rem",   delay: 1.8 },
  { sym: ">>>",  left: "89%", top: "43%", fontSize: "0.9rem", delay: 0.2 },
  { sym: "null", left: "78%", top: "75%", fontSize: "0.8rem", delay: 1.0 },
];

/* ─── Floating mini UI cards ─── */
const CARDS = [
  { icon: "🔒", label: "Security Scan",  left: "67%", top: "12%", delay: 0.5 },
  { icon: "🧪", label: "Code Smell",     left: "4%",  top: "10%", delay: 1.3 },
  { icon: "⚡", label: "Arch Review",    left: "75%", top: "74%", delay: 0.7 },
  { icon: "📋", label: "Patch Ready",    left: "2%",  top: "75%", delay: 1.6 },
];

export default function LandingPage() {
  const [, setLocation] = useLocation();
  const { displayed, done } = useTypewriter("CodeInsight", 85, 1300);
  const SIZE = 320;

  return (
    <div
      className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center"
      style={{ background: "#04071a" }}
    >
      {/* Particle layer */}
      <ParticleCanvas />

      {/* Radial glow behind center */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full"
        style={{
          width: 700, height: 700,
          background: "radial-gradient(circle, rgba(100,40,220,0.18) 0%, rgba(30,60,180,0.08) 50%, transparent 75%)",
          filter: "blur(8px)",
        }}
      />

      {/* Moving gradient band */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{
          background: "linear-gradient(120deg, transparent 25%, rgba(124,58,237,0.07) 50%, transparent 75%)",
          backgroundSize: "250% 250%",
        }}
      />

      {/* Floating code symbols */}
      {FLOATERS.map((f) => (
        <motion.div
          key={f.sym}
          className="absolute font-mono font-bold pointer-events-none select-none"
          style={{
            left: f.left,
            top: f.top,
            fontSize: f.fontSize,
            color: "rgba(167,139,250,0.55)",
            textShadow: "0 0 14px rgba(139,92,246,0.7)",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.65, 0.38, 0.65], y: [0, -10, 5, -10] }}
          transition={{
            opacity: { delay: f.delay + 1.2, duration: 3.5, repeat: Infinity, ease: "easeInOut" },
            y: { delay: f.delay + 1.2, duration: 4.5 + f.delay * 0.5, repeat: Infinity, ease: "easeInOut" },
          }}
        >
          {f.sym}
        </motion.div>
      ))}

      {/* Floating mini cards */}
      {CARDS.map((c) => (
        <motion.div
          key={c.label}
          className="absolute pointer-events-none select-none flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{
            left: c.left,
            top: c.top,
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(139,92,246,0.22)",
            boxShadow: "0 0 18px rgba(139,92,246,0.18)",
          }}
          initial={{ opacity: 0, scale: 0.75 }}
          animate={{ opacity: [0, 0.9, 0.65, 0.9], y: [0, -7, 4, -7], scale: [0.75, 1, 1, 1] }}
          transition={{
            opacity: { delay: c.delay + 1.6, duration: 4, repeat: Infinity, ease: "easeInOut" },
            y: { delay: c.delay + 1.6, duration: 5 + c.delay * 0.4, repeat: Infinity, ease: "easeInOut" },
            scale: { delay: c.delay + 1.6, duration: 0.5 },
          }}
        >
          <span style={{ fontSize: "0.85rem" }}>{c.icon}</span>
          <span className="text-xs font-medium whitespace-nowrap" style={{ color: "rgba(255,255,255,0.65)" }}>
            {c.label}
          </span>
        </motion.div>
      ))}

      {/* ── Main content ── */}
      <div className="relative z-10 flex flex-col items-center gap-0" style={{ marginTop: "-20px" }}>

        {/* Orbital ring + laptop image */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: SIZE, height: SIZE }}
        >
          <OrbitalRings size={SIZE} />

          {/* Inner soft glow */}
          <div
            className="absolute rounded-full pointer-events-none"
            style={{
              width: "52%", height: "52%",
              background: "radial-gradient(circle, rgba(80,30,160,0.5) 0%, rgba(30,50,140,0.25) 60%, transparent 90%)",
            }}
          />

          {/* Laptop image — floating */}
          <motion.div
            className="absolute flex items-center justify-center"
            style={{ width: "52%", height: "52%" }}
            animate={{ y: [-7, 7, -7] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <img
              src="/laptop-hero.png"
              alt="CodeInsight"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                borderRadius: "50%",
                filter: "drop-shadow(0 0 20px rgba(124,58,237,0.75)) drop-shadow(0 0 50px rgba(59,130,246,0.4))",
              }}
            />
          </motion.div>
        </div>

        {/* App name — typewriter */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          className="flex items-baseline justify-center"
          style={{ marginTop: "-8px" }}
        >
          <h1
            style={{
              fontSize: "clamp(2.6rem, 6vw, 4.5rem)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              background: "linear-gradient(135deg, #c084fc 0%, #818cf8 45%, #60a5fa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              filter: done ? "drop-shadow(0 0 22px rgba(139,92,246,0.65))" : "none",
              transition: "filter 0.6s ease",
              minWidth: "1ch",
            }}
          >
            {displayed || "\u00A0"}
          </h1>
          {!done && (
            <motion.span
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.75, repeat: Infinity }}
              style={{
                display: "inline-block",
                width: "3px",
                height: "0.8em",
                background: "#a78bfa",
                marginLeft: "4px",
                borderRadius: "2px",
                boxShadow: "0 0 10px rgba(167,139,250,0.9)",
                verticalAlign: "middle",
              }}
            />
          )}
        </motion.div>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.7, duration: 0.8 }}
          style={{
            marginTop: "14px",
            fontSize: "1.05rem",
            color: "rgba(255,255,255,0.42)",
            textAlign: "center",
            maxWidth: "340px",
            textShadow: "0 0 20px rgba(139,92,246,0.25)",
            letterSpacing: "0.01em",
          }}
        >
          Let your mind breathe. We handle the bugs.
        </motion.p>

        {/* CTA Button */}
        <motion.div
          initial={{ opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 3.1, duration: 0.5 }}
          style={{ marginTop: "28px" }}
        >
          <motion.button
            onClick={() => setLocation("/sign-in")}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            style={{
              position: "relative",
              padding: "14px 48px",
              borderRadius: "14px",
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "#fff",
              background: "linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)",
              boxShadow: "0 0 32px rgba(124,58,237,0.55), 0 0 64px rgba(59,130,246,0.22)",
              border: "none",
              cursor: "pointer",
              overflow: "hidden",
              letterSpacing: "0.02em",
            }}
          >
            {/* Shimmer sweep */}
            <motion.span
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)",
                transform: "skewX(-15deg)",
              }}
              animate={{ x: ["-120%", "220%"] }}
              transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
            />
            <span style={{ position: "relative", zIndex: 1 }}>Login</span>
          </motion.button>
        </motion.div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none"
        style={{ background: "linear-gradient(to top, #04071a 0%, transparent 100%)" }}
      />
    </div>
  );
}
