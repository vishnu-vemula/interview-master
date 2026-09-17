import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BrainCircuit, Sparkles, FileText, BarChart3, ArrowRight, Briefcase, MessagesSquare } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';

const FEATURES = [
  {
    icon: FileText,
    title: 'Questions from your actual resume',
    desc: 'Upload a PDF and the interviewer digs into your real projects, stack, and experience — not generic prompts from a question bank.',
    color: 'from-brand-600 to-brand-500',
    wide: true,
  },
  {
    icon: BrainCircuit,
    title: 'Grounded generation',
    desc: 'A RAG pipeline retrieves the parts of your resume that match the job description before each question is written.',
    color: 'from-brand-500 to-brand-400',
  },
  {
    icon: BarChart3,
    title: 'Scored answers, no waiting',
    desc: 'Every answer is evaluated on the spot — clarity, depth, and relevance — with a full report when the session ends.',
    color: 'from-brand-700 to-brand-600',
  },
  {
    icon: MessagesSquare,
    title: 'It talks back',
    desc: 'Follow-up questions arrive in real time over a live connection, the way a real interviewer would push on a thin answer.',
    color: 'from-brand-600 to-brand-500',
    wide: true,
  },
];

const STEPS = [
  { step: '01', title: 'Create an account', desc: 'Email and password. That is the whole form.' },
  { step: '02', title: 'Point it at a job', desc: 'Paste the job description, pick a difficulty, and upload your resume.' },
  { step: '03', title: 'Practice and review', desc: 'Answer live, read the feedback, and watch the trend line on your dashboard.' },
];

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="grain min-h-screen bg-surface overflow-x-hidden">
      {/* ── Navbar ──────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-md border-b border-surface-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 rounded-lg">
            <div className="p-1.5 bg-gradient-brand rounded-lg">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-lg text-white tracking-tight">InterviewMaster</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8">
            <Link to="/jobs" className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Jobs
              <span className="text-[10px] bg-brand-600/20 text-brand-300 px-1.5 py-0.5 rounded border border-brand-500/20 font-semibold uppercase tracking-wide">
                Beta
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn-primary">Go to dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="btn-ghost">Sign in</Link>
                <Link to="/register" className="btn-primary">Start free</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-28 px-6 overflow-hidden">
        {/* Ambient light — single hue, off-center */}
        <div className="absolute top-16 left-1/3 w-[560px] h-[380px] bg-brand-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-left sm:text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="badge-brand badge mb-6 inline-flex">
              <Sparkles className="w-3 h-3" /> Runs on Llama 3 via Groq
            </span>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold text-white leading-[1.05] mb-6">
              The interviewer that<br className="hidden sm:block" />
              <span className="gradient-text">read your resume</span>
            </h1>

            <p className="text-lg text-slate-400 max-w-xl sm:mx-auto mb-10 leading-relaxed">
              Paste a job description, upload your resume, and answer questions
              drawn from your own experience — with feedback on every response.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-center gap-4">
              <Link to="/register" className="btn-primary text-base px-8 py-4">
                Start practicing <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/login" className="btn-secondary text-base px-8 py-4">
                Sign in
              </Link>
            </div>

            <p className="text-slate-600 text-sm mt-6">
              No credit card · Free while in beta · Your resume is never shared
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Features (bento) ────────────────────────────────────── */}
      <section className="py-20 pb-28 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12 max-w-xl">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
              Everything you need to <span className="gradient-text">prepare</span>
            </h2>
            <p className="text-slate-400">
              A mock interview platform that behaves like the real thing.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc, color, wide }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`card-hover p-7 group ${wide ? 'md:col-span-2' : ''}`}
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-5`}>
                  <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed max-w-md">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="py-20 pb-24 px-6 bg-surface-card border-y border-surface-border">
        <div className="max-w-4xl mx-auto">
          <div className="mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white mb-3">
              From upload to <span className="gradient-text">feedback</span>
            </h2>
            <p className="text-slate-400">Three steps, about two minutes of setup.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            {STEPS.map(({ step, title, desc }, i) => (
              <motion.div key={step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="flex md:block items-start gap-5"
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-surface border border-surface-border flex items-center justify-center md:mb-5">
                  <span className="text-brand-300 font-display font-bold text-sm">{step}</span>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white mb-1.5">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center relative"
        >
          <div className="absolute -inset-x-10 -top-10 h-40 bg-brand-600/10 blur-3xl rounded-full pointer-events-none" />
          <h2 className="relative text-3xl sm:text-4xl font-display font-bold text-white mb-4">
            Your next interview has a date.
          </h2>
          <p className="relative text-slate-400 mb-8">
            Get three practice sessions in before it does.
          </p>
          <Link to="/register" className="btn-primary text-base px-10 py-4 inline-flex relative">
            Create a free account <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-surface-border py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-brand-400" />
            <span className="font-display font-semibold text-white">InterviewMaster</span>
          </div>
          <p className="text-slate-500 text-sm">© 2026 InterviewMaster · Built with the MERN stack and Groq</p>
        </div>
      </footer>
    </div>
  );
}
