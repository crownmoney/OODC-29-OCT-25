import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, animate, type Variants } from 'motion/react';
import {
  Users, LayoutDashboard, Workflow, TrendingUp, Building2, Armchair,
  MessageCircleQuestion, Lightbulb, Hourglass, BadgeCheck, ShieldCheck, Sparkles,
} from 'lucide-react';

// "The Crown Money System – How It Works": client-facing explainer shown
// during the meeting. Content mirrors the approved Crown Money one-pager.

type Prompt = { kind: 'question' | 'idea'; text: string };

const PILLARS: {
  n: number;
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ElementType;
  prompt?: Prompt;
}[] = [
  {
    n: 1, eyebrow: 'Financial coaching', title: 'Stay on track, every month', icon: Users,
    body: 'A coach in your corner keeping you accountable, so you make more and save more.',
    prompt: { kind: 'question', text: 'Have you ever used a personal trainer? Did you get better results?' },
  },
  {
    n: 2, eyebrow: 'Wealth tracking dashboard', title: 'Know your debt-free date', icon: LayoutDashboard,
    body: 'Your entire financial life and all your important numbers on one screen.',
    prompt: { kind: 'question', text: 'Ever worn a watch that counts your steps? Did you walk more?' },
  },
  {
    n: 3, eyebrow: 'Automation', title: 'No more money stress', icon: Workflow,
    body: 'Your entire financial life on autopilot.',
    prompt: { kind: 'idea', text: 'Imagine not having to worry about money.' },
  },
  {
    n: 4, eyebrow: 'Income optimisation', title: 'Years off your loan, same income', icon: TrendingUp,
    body: 'Every spare dollar works against the debt, saving you thousands in interest.',
    prompt: { kind: 'question', text: 'Do you think your income can be working harder?' },
  },
  {
    n: 5, eyebrow: 'Property plan', title: 'Help set your kids up financially for life', icon: Building2,
    body: 'Know what you can afford to do for the kids, when you can afford to do it, and where you should do it, so they have the biggest chance of success.',
  },
  {
    n: 6, eyebrow: 'Retirement review', title: 'Retire with confidence', icon: Armchair,
    body: "Know how much you'll retire on and how long it will last.",
    prompt: { kind: 'idea', text: 'No more worrying about running out of money.' },
  },
];

const STATS = [
  { value: 12, prefix: '', suffix: ' years', label: 'Average to debt-free, not 30' },
  { value: 456, prefix: '', suffix: '%', label: 'More off the loan in the first 90 days, same income' },
  { value: 23, prefix: 'Every ', suffix: ' days', label: 'A Crown client pays off their home in full' },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } }),
};

const CountUp: React.FC<{ to: number; prefix?: string; suffix?: string }> = ({ to, prefix = '', suffix = '' }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration: 1.4, ease: 'easeOut', onUpdate: v => setN(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to]);
  return (
    <span ref={ref}>
      {prefix && <span className="text-[0.6em] font-bold align-middle mr-1">{prefix.trim()}</span>}
      {n}{suffix}
    </span>
  );
};

const PromptBox: React.FC<{ prompt: Prompt }> = ({ prompt }) => {
  const Icon = prompt.kind === 'question' ? MessageCircleQuestion : Lightbulb;
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl bg-[#F3EBF8] px-4 py-3">
      <Icon className="h-6 w-6 shrink-0 text-[#9B4FB0]" strokeWidth={1.75} />
      <p className="text-sm leading-snug text-[#250B40]">{prompt.text}</p>
    </div>
  );
};

const Tab_CrownSystem: React.FC = () => (
  <div className="space-y-6 print:space-y-4">
    {/* Heading */}
    <motion.header initial="hidden" animate="show" custom={0} variants={fadeUp} className="text-center px-2">
      <p className="text-xs font-bold uppercase tracking-[0.25em] text-[#9B4FB0]">The Crown Money System · How it works</p>
      <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight text-[#250B40]">
        What the <span className="text-[#9B4FB0]">Crown Money</span> System does for your family
      </h2>
      <p className="mt-3 text-base sm:text-lg text-[#583d77]">
        More money in your pocket, less stress, and your home paid off years sooner.
      </p>
    </motion.header>

    {/* Banner */}
    <div className="grid gap-4 md:grid-cols-2">
      <motion.div initial="hidden" animate="show" custom={1} variants={fadeUp}
        className="relative overflow-hidden rounded-2xl bg-[#250B40] px-6 py-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[#9B4FB0]/25 blur-2xl" />
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Financial coaching</p>
        <p className="mt-1 text-3xl font-black text-[#C99BDA]">Your Family CFO</p>
      </motion.div>
      <motion.div initial="hidden" animate="show" custom={2} variants={fadeUp}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#9B4FB0] to-[#7B3A9A] px-6 py-5 text-white shadow-lg">
        <Sparkles className="pointer-events-none absolute right-5 top-5 h-8 w-8 text-white/25" />
        <p className="text-2xl font-black">Done for you</p>
        <p className="mt-1 text-white/90">Every single month, so you don't have to.</p>
      </motion.div>
    </div>

    {/* Six pillars */}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {PILLARS.map((p, i) => {
        const Icon = p.icon;
        return (
          <motion.article key={p.n} initial="hidden" animate="show" custom={i + 3} variants={fadeUp}
            whileHover={{ y: -4 }}
            className="group flex flex-col rounded-2xl border border-[#EDE4F3] bg-white p-5 shadow-sm transition-shadow hover:shadow-xl print:shadow-none print:break-inside-avoid">
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#250B40] text-lg font-black text-white shadow-md">
                {p.n}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#583d77]">{p.eyebrow}</p>
                <h3 className="mt-1 text-lg font-black leading-tight text-[#9B4FB0]">{p.title}</h3>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F3EBF8] text-[#250B40] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <Icon className="h-7 w-7" strokeWidth={1.6} />
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#3b2a52]">{p.body}</p>
            <div className="mt-auto">{p.prompt && <PromptBox prompt={p.prompt} />}</div>
          </motion.article>
        );
      })}
    </div>

    {/* Time back / Done for you */}
    <div className="grid gap-4 md:grid-cols-2">
      <motion.div initial="hidden" animate="show" custom={9} variants={fadeUp}
        className="flex items-center gap-5 rounded-2xl bg-[#250B40] px-6 py-5 text-white shadow-lg">
        <motion.span animate={{ rotate: [0, 0, 180, 180] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.7, 0.85, 1] }} className="shrink-0">
          <Hourglass className="h-12 w-12 text-white" strokeWidth={1.5} />
        </motion.span>
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-[#C99BDA]">Your time back</p>
          <p className="mt-1 text-sm leading-relaxed text-white/90">
            Running all six pillars, every single month, for the next 12 years? Nobody has time for that. Life is busy enough.
          </p>
        </div>
      </motion.div>
      <motion.div initial="hidden" animate="show" custom={10} variants={fadeUp}
        className="flex items-center gap-5 rounded-2xl bg-[#250B40] px-6 py-5 text-white shadow-lg">
        <BadgeCheck className="h-12 w-12 shrink-0 text-white" strokeWidth={1.5} />
        <div>
          <p className="text-sm font-black uppercase tracking-wider text-[#C99BDA]">Done for you</p>
          <p className="mt-1 text-base font-black">You live your life. We run the system.</p>
          <p className="text-sm text-white/90">Work, spend and enjoy the family. We take care of the rest.</p>
        </div>
      </motion.div>
    </div>

    {/* What it means for you */}
    <motion.section initial="hidden" animate="show" custom={11} variants={fadeUp}
      className="rounded-2xl border border-[#EDE4F3] bg-white p-5 sm:p-6 shadow-sm print:break-inside-avoid">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:items-center">
        <div className="flex items-center gap-4">
          <MessageCircleQuestion className="h-14 w-14 shrink-0 text-[#9B4FB0]" strokeWidth={1.5} />
          <h3 className="text-3xl font-black leading-tight text-[#9B4FB0]">What it means for you?</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {STATS.map(s => (
            <div key={s.label} className="rounded-xl bg-[#250B40] px-4 py-5 text-center text-white shadow-md">
              <p className="text-4xl font-black text-[#C99BDA] tabular-nums"><CountUp to={s.value} prefix={s.prefix} suffix={s.suffix} /></p>
              <p className="mt-1 text-xs leading-snug text-white/85">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 flex items-start gap-3 rounded-xl bg-[#F3EBF8] px-4 py-3">
        <ShieldCheck className="h-6 w-6 shrink-0 text-[#250B40]" strokeWidth={1.75} />
        <p className="text-sm leading-relaxed text-[#250B40]">
          <strong>Performance guarantee:</strong> If you don't pay more off your home loan with us in the first 12 months than what you're already doing by yourself, we refund our implementation fee in full.
        </p>
      </div>
    </motion.section>
  </div>
);

export default Tab_CrownSystem;
