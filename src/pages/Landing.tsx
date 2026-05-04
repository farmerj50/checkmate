import { Link } from "react-router-dom";
import { Heart, ShieldCheck, Sparkles, MessageCircle, Users } from "lucide-react";
import { motion, useReducedMotion, useAnimationFrame, useMotionValue, useTransform } from "framer-motion";
import { useRef } from "react";

// ── Bubble photos ─────────────────────────────────────────────────────────────
const BUBBLES = [
  { src: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300&h=300&fit=crop&crop=faces", size: 120, x: "8%",  y: "12%", delay: 0,    dur: 7,   z: 1,    drift: 28 },
  { src: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=300&h=300&fit=crop&crop=faces", size: 90,  x: "18%", y: "62%", delay: 1.2,  dur: 9,   z: 0.7,  drift: 18 },
  { src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=300&h=300&fit=crop&crop=faces", size: 150, x: "72%", y: "8%",  delay: 0.6,  dur: 8,   z: 1.2,  drift: 34 },
  { src: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=300&h=300&fit=crop&crop=faces", size: 105, x: "82%", y: "55%", delay: 2,    dur: 7.5, z: 0.85, drift: 22 },
  { src: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=300&h=300&fit=crop&crop=faces", size: 80,  x: "55%", y: "76%", delay: 1.5,  dur: 10,  z: 0.6,  drift: 14 },
  { src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&h=300&fit=crop&crop=faces", size: 115, x: "40%", y: "4%",  delay: 0.9,  dur: 9,   z: 0.9,  drift: 26 },
  { src: "https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=300&h=300&fit=crop&crop=faces", size: 95,  x: "90%", y: "28%", delay: 3,    dur: 8,   z: 0.75, drift: 20 },
  { src: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=300&fit=crop&crop=faces", size: 130, x: "2%",  y: "40%", delay: 2.4,  dur: 11,  z: 1.1,  drift: 30 },
  { src: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&h=300&fit=crop&crop=faces", size: 78,  x: "62%", y: "40%", delay: 1.8,  dur: 7,   z: 0.5,  drift: 12 },
  { src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=faces", size: 110, x: "28%", y: "80%", delay: 0.3,  dur: 9.5, z: 0.95, drift: 24 },
  { src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=faces", size: 88,  x: "48%", y: "18%", delay: 4,    dur: 8.5, z: 0.65, drift: 16 },
  { src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop&crop=faces", size: 68,  x: "35%", y: "55%", delay: 2.8,  dur: 6.5, z: 0.45, drift: 10 },
];

const pillars = [
  { icon: "🎥", label: "Real video profiles" },
  { icon: "🧠", label: "Behavior-based matching" },
  { icon: "⚡", label: "No swiping — just scroll" },
];

const features = [
  { icon: Sparkles,       title: "Smart Matching",  desc: "Compatibility scored by interests, values, and vibe." },
  { icon: MessageCircle,  title: "Icebreakers",     desc: "One-tap openers that actually get replies." },
  { icon: ShieldCheck,    title: "Safety First",    desc: "Photo verification + instant block/report tools." },
  { icon: Users,          title: "Real People",     desc: "Every profile manually reviewed before going live." },
];

// ── Floating bubble ───────────────────────────────────────────────────────────
function Bubble({ src, size, x, y, delay, dur, z, drift }: typeof BUBBLES[0]) {
  const reduced = useReducedMotion();
  const translateY = useMotionValue(0);
  const translateX = useMotionValue(0);
  const rotate = useMotionValue(0);
  const startRef = useRef<number | null>(null);

  useAnimationFrame((t) => {
    if (reduced) return;
    if (startRef.current === null) startRef.current = t;
    const elapsed = (t - startRef.current) / 1000 + delay;
    const speed = 1 / dur;
    translateY.set(Math.sin(elapsed * speed * Math.PI * 2) * drift);
    translateX.set(Math.cos(elapsed * speed * Math.PI * 1.3) * (drift * 0.5));
    rotate.set(Math.sin(elapsed * speed * Math.PI * 0.7) * 4);
  });

  const opacity = useTransform(translateY, [-drift, 0, drift], [0.75, 0.92, 0.75]);

  return (
    <motion.div
      className="absolute rounded-full overflow-hidden border-2 border-white/15 shadow-2xl cursor-pointer"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        filter: `blur(${(1 - Math.min(z, 1)) * 2.5}px)`,
        zIndex: Math.round(z * 10),
        translateY,
        translateX,
        rotate,
        opacity,
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 1.2, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.12, filter: "blur(0px)", zIndex: 20, transition: { duration: 0.25 } }}
    >
      {/* glass sphere highlight */}
      <div className="absolute inset-0 rounded-full z-10 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.22) 0%, transparent 55%)`,
          boxShadow: `inset 0 -${size * 0.22}px ${size * 0.4}px rgba(0,0,0,0.6),
                      inset 0 ${size * 0.06}px ${size * 0.12}px rgba(255,255,255,0.12)`,
        }}
      />
      <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
    </motion.div>
  );
}

// ── Mouse parallax hook ───────────────────────────────────────────────────────
function useMouseParallax(strength = 18) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const onMouseMove = (e: React.MouseEvent) => {
    const cx = e.currentTarget.clientWidth / 2;
    const cy = e.currentTarget.clientHeight / 2;
    x.set(((e.clientX - cx) / cx) * strength);
    y.set(((e.clientY - cy) / cy) * strength);
  };

  const onMouseLeave = () => { x.set(0); y.set(0); };

  return { x, y, onMouseMove, onMouseLeave };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Landing() {
  const parallax = useMouseParallax(22);
  return (
    <div className="min-h-screen bg-[#07070d] text-white overflow-x-hidden">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-md border-b border-white/8">
        <div className="mx-auto max-w-7xl px-5 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-pink-600 grid place-items-center shadow-lg shadow-pink-600/40">
              <Heart className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">CheckMate</span>
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#safety"   className="hover:text-white transition-colors">Safety</a>
            <a href="#stories"  className="hover:text-white transition-colors">Stories</a>
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <Link to="/login"
              className="px-4 py-2 rounded-xl border border-white/15 text-white/70 hover:text-white hover:bg-white/5 transition">
              Sign in
            </Link>
            <Link to="/signup"
              className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 transition font-medium shadow-lg shadow-pink-600/30">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        className="relative min-h-[88vh] flex items-center overflow-hidden"
        onMouseMove={parallax.onMouseMove}
        onMouseLeave={parallax.onMouseLeave}
      >

        {/* 3-D bubble field */}
        <div
          className="absolute inset-0"
          style={{ perspective: "900px", perspectiveOrigin: "50% 40%" }}
        >
          {/* Deep radial glow */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,rgba(219,39,119,0.2),transparent_70%)]" />

          {/* Parallax wrapper */}
          <motion.div
            className="absolute inset-0"
            style={{ x: parallax.x, y: parallax.y }}
            transition={{ type: "spring", stiffness: 60, damping: 20 }}
          >
            {BUBBLES.map((b, i) => <Bubble key={i} {...b} />)}
          </motion.div>
        </div>

        {/* Dark vignette so text pops */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_70%_at_50%_50%,rgba(7,7,13,0.82),rgba(7,7,13,0.35)_70%,transparent)]" />

        {/* Hero copy — centred */}
        <div className="relative z-10 w-full max-w-3xl mx-auto px-6 text-center">
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 text-xs tracking-widest uppercase text-pink-400/80 bg-pink-900/20 border border-pink-500/30 rounded-full px-4 py-1.5 mb-6"
          >
            <Sparkles className="w-3 h-3" /> Video-first · Now in early access
          </motion.p>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl md:text-7xl font-bold leading-[1.08] tracking-tight"
          >
            Meet people who<br />
            match your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">
              energy.
            </span>
            <span className="block mt-3 text-3xl md:text-4xl font-semibold text-white/40 tracking-normal">
              No swiping. Just scroll.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-5 text-lg text-white/55 max-w-lg mx-auto"
          >
            Watch real video profiles. Like what feels right. Match based on how you actually engage.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Link to="/signup"
              className="px-7 py-3.5 rounded-2xl bg-pink-600 hover:bg-pink-500 transition font-semibold shadow-xl shadow-pink-600/35 text-base">
              Start exploring
            </Link>
            <Link to="/login"
              className="px-7 py-3.5 rounded-2xl border border-white/15 hover:bg-white/5 transition text-white/70 hover:text-white text-base">
              Sign in
            </Link>
          </motion.div>

          {/* Pillars */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85 }}
            className="mt-12 flex flex-wrap justify-center gap-3"
          >
            {pillars.map((p) => (
              <div key={p.label} className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] text-sm text-white/70">
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-24">
        <h2 className="text-center text-3xl md:text-4xl font-bold mb-3">Built different.</h2>
        <p className="text-center text-white/40 mb-14 text-sm">Everything you need, nothing you don't.</p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-6 hover:border-pink-500/30 transition-colors"
            >
              <div className="w-10 h-10 grid place-items-center rounded-xl bg-pink-600/15 border border-pink-600/20 mb-4">
                <f.icon className="w-5 h-5 text-pink-400" />
              </div>
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-white/45 text-sm leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Safety strip ── */}
      <section id="safety" className="max-w-6xl mx-auto px-5 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl border border-white/8 bg-gradient-to-br from-pink-950/40 to-gray-900/60 p-8 md:p-12 flex flex-col md:flex-row items-start gap-6"
        >
          <div className="w-14 h-14 rounded-2xl bg-pink-600/20 border border-pink-500/20 grid place-items-center flex-shrink-0">
            <ShieldCheck className="w-7 h-7 text-pink-400" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">A safer way to meet</h2>
            <p className="text-white/55 leading-relaxed max-w-2xl">
              Every profile is photo-verified before it goes live. First messages are filtered for spam and harassment.
              One-tap controls let you block, report, and undo — always.
            </p>
          </div>
        </motion.div>
      </section>

      {/* ── CTA ── */}
      <section id="stories" className="max-w-6xl mx-auto px-5 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="rounded-3xl border border-white/8 bg-gradient-to-br from-pink-600/20 to-rose-900/20 p-12 md:p-20"
        >
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Be one of the first.</h2>
          <p className="text-white/45 mb-10 text-lg">Early access — video-first dating, smarter matches, no swiping.</p>
          <Link to="/signup"
            className="inline-flex items-center gap-2 px-9 py-4 rounded-2xl bg-pink-600 hover:bg-pink-500 font-semibold text-lg shadow-2xl shadow-pink-600/40 transition">
            Start exploring <Heart className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-white/8 py-8 text-center text-white/25 text-sm">
        © {new Date().getFullYear()} CheckMate, Inc.
      </footer>
    </div>
  );
}
