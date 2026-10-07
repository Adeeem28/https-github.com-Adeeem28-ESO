"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  Factory,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

type Currency = "BAM" | "EUR" | "USD";

const currencies: { code: Currency; label: string }[] = [
  { code: "BAM", label: "KM" },
  { code: "EUR", label: "€" },
  { code: "USD", label: "$" },
];

const plans = [
  {
    name: "ESO Plant",
    eyebrow: "CORE WORKFLOWS",
    description: "A focused safety workspace for one plant and its everyday ESO process.",
    accent: "blue",
    icon: Factory,
    features: ["One plant workspace", "Employee and department tracking", "ESO dashboard and corrective actions", "Mobile and desktop access"],
  },
  {
    name: "ESO Professional",
    eyebrow: "MOST POPULAR",
    description: "More visibility and control for teams that want to improve every week.",
    accent: "orange",
    icon: BarChart3,
    features: ["Everything in ESO Plant", "Advanced reports and filters", "Targets, closure rate and trends", "ESO Hunt and recognition workflows"],
  },
  {
    name: "ESO Enterprise",
    eyebrow: "MULTI-PLANT",
    description: "A governed safety platform for multiple plants, companies and leadership teams.",
    accent: "purple",
    icon: Building2,
    features: ["Multi-plant and company oversight", "Owner console and onboarding", "Custom roles and governance", "Integration and rollout planning"],
  },
];

export default function RegisterPage() {
  const [currency, setCurrency] = useState<Currency>("BAM");

  return (
    <div className="public-site">
      <header className="public-nav">
        <div className="public-nav-inner">
          <Link href="/" className="public-brand" aria-label="ESO home">
            <span className="public-brand-mark"><img src="/eso-shield.png" alt="" /></span>
            <span><b>ESO</b><small>Environment &amp; Safety Opportunity</small></span>
          </Link>
          <nav className="public-nav-links" aria-label="Public navigation">
            <a href="#free">Free account</a>
            <a href="#plans">ESO plans</a>
            <a href="#contact">Contact</a>
            <Link href="/">Sign in <ArrowRight size={14} /></Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="public-hero">
          <div className="public-container public-hero-grid">
            <div className="public-hero-copy">
              <span className="public-eyebrow"><ShieldCheck size={15} /> ESO PLATFORM</span>
              <h1>Register / Subscribe</h1>
              <p>Choose the ESO setup that fits your operation. Start with a practical safety workspace, then add the visibility and governance your plants need.</p>
              <div className="public-hero-actions">
                <a href="#plans" className="public-primary-btn">Explore ESO plans <ArrowRight size={17} /></a>
                <Link href="/" className="public-secondary-btn">Already have an account?</Link>
              </div>
              <div className="public-trust-row">
                <span><LockKeyhole size={14} /> Private by default</span>
                <span><Globe2 size={14} /> Mobile + desktop</span>
                <span><BadgeCheck size={14} /> Built for plants</span>
              </div>
            </div>

            <div className="public-hero-visual" aria-label="ESO platform preview">
              <div className="public-visual-topline"><span>ESO PLATFORM ID</span><span className="public-live-dot">● LIVE WORKSPACE</span></div>
              <h2>One safety identity for your plant.</h2>
              <p>Connect people, departments and actions in one calm, visible workflow.</p>
              <div className="public-visual-chips"><span>Reports</span><span>Targets</span><span>Corrective actions</span></div>
              <div className="public-visual-board">
                <div className="public-mini-card public-mini-card-main"><small>PLANT PERFORMANCE</small><strong>84%</strong><span><i style={{ width: "84%" }} /></span><em>Closure rate this year</em></div>
                <div className="public-mini-card"><small>OPEN ESO</small><strong>24</strong><em>Across departments</em></div>
                <div className="public-mini-card public-mini-card-accent"><small>TEAM TARGET</small><strong>168 / 200</strong><em>ESO reported this year</em></div>
              </div>
            </div>
          </div>
        </section>

        <section id="free" className="public-section public-container">
          <div className="public-section-heading">
            <div><span className="public-eyebrow">START SIMPLE</span><h2>Free ESO account</h2><p>Begin with the essentials. No payment details are needed for the first setup.</p></div>
            <div className="public-currency"><span>Display currency</span><div role="group" aria-label="Display currency">{currencies.map((item) => <button key={item.code} type="button" className={currency === item.code ? "selected" : ""} onClick={() => setCurrency(item.code)} aria-pressed={currency === item.code}><b>{item.label}</b> {item.code}</button>)}</div></div>
          </div>

          <div className="public-free-grid">
            <article className="public-free-card">
              <span className="public-plan-ribbon">FREE</span>
              <div className="public-card-kicker">ESO FREE / DEMO</div>
              <h3>ESO Free Account</h3>
              <strong className="public-free-price">Free of charge</strong>
              <p>Get a clean starting point for reporting, ownership and follow-through before choosing a paid rollout.</p>
              <span className="public-no-payment"><LockKeyhole size={13} /> No payment required</span>
              <ul className="public-feature-list">
                <li><Check size={16} /> One plant workspace</li>
                <li><Check size={16} /> Employee and department setup</li>
                <li><Check size={16} /> ESO reporting and basic dashboard</li>
                <li><Check size={16} /> Private account configuration</li>
              </ul>
              <a href="#contact" className="public-primary-btn public-full-btn">Request free setup <ArrowRight size={16} /></a>
            </article>

            <article className="public-identity-card">
              <span className="public-card-kicker">ESO PLATFORM ID</span>
              <h3>One setup identity for your network.</h3>
              <p>Your ESO identity keeps the people, plants and workflows you manage connected as your operation grows.</p>
              <div className="public-identity-points">
                <span><Users size={17} /><b>People first</b><small>Invite teams without losing ownership.</small></span>
                <span><Factory size={17} /><b>Plant ready</b><small>Organize reports around real work areas.</small></span>
                <span><BarChart3 size={17} /><b>Visible progress</b><small>Targets, closure and trends in one view.</small></span>
              </div>
              <div className="public-identity-note"><Sparkles size={17} /><span><b>Designed to grow with you.</b><small>Move from a demo to a governed subscription when the setup is ready.</small></span></div>
            </article>
          </div>
        </section>

        <section id="plans" className="public-section public-plans-section">
          <div className="public-container">
            <div className="public-section-heading public-section-heading-plans"><div><span className="public-eyebrow">ESO SUBSCRIPTIONS</span><h2>Safety management for every plant</h2><p>Pick the operating level that matches your team. Pricing can be agreed in {currency} when your subscription model is finalized.</p></div><span className="public-quote-pill"><CircleHelp size={15} /> Flexible quote</span></div>
            <div className="public-plan-grid">
              {plans.map((plan) => { const Icon = plan.icon; return <article key={plan.name} className={`public-plan-card ${plan.accent}`}><div className="public-plan-card-top"><span className="public-card-kicker">{plan.eyebrow}</span><Icon size={22} /></div><h3>{plan.name}</h3><p>{plan.description}</p><div className="public-plan-price">Custom quote <small>in {currency}</small></div><ul className="public-feature-list">{plan.features.map((feature) => <li key={feature}><Check size={16} /> {feature}</li>)}</ul><a href="#contact" className="public-outline-btn">Request this plan <ChevronRight size={16} /></a></article>; })}
            </div>
          </div>
        </section>

        <section className="public-section public-container public-how-section">
          <div className="public-section-heading"><div><span className="public-eyebrow">HOW IT WORKS</span><h2>From first report to full rollout</h2><p>A simple path for the people who use ESO and the people who govern it.</p></div></div>
          <div className="public-how-grid"><div><span>01</span><h3>Create the workspace</h3><p>Set up your company, plant, departments and locations.</p></div><div><span>02</span><h3>Invite your people</h3><p>Give employees a clear way to report and follow actions.</p></div><div><span>03</span><h3>Improve with evidence</h3><p>Use targets, closure rate and trends to guide the next step.</p></div></div>
        </section>

        <section id="contact" className="public-contact-section">
          <div className="public-container public-contact-card"><div><span className="public-eyebrow">READY WHEN YOU ARE</span><h2>Let’s shape the right ESO package.</h2><p>For now, subscription activation is handled through the ESO onboarding process. We can connect this section to your final registration and payment flow once the plans, prices and billing method are approved.</p></div><div className="public-contact-actions"><Link href="/owner" className="public-primary-btn">Open Platform Owner <ArrowRight size={16} /></Link><Link href="/" className="public-secondary-btn">Go to ESO login</Link></div></div>
        </section>
      </main>

      <footer className="public-footer"><div className="public-container"><span>© {new Date().getFullYear()} ESO Management System</span><span>Environment &amp; Safety Opportunity</span><Link href="/">Sign in</Link></div></footer>
    </div>
  );
}
