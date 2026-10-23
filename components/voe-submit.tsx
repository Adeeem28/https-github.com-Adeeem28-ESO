"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  MessageSquare,
  Lightbulb,
  ArrowUpRight,
  Armchair,
  Workflow,
  Wrench,
  CalendarDays,
  MessagesSquare,
  HeartHandshake,
  Send,
} from "lucide-react";
import { VOE_CATEGORIES } from "@/lib/voe";

const examples = [
  {
    category: "workplace_conditions",
    icon: Armchair,
    title: "A better workspace",
    text: "A quieter break area would help us recharge.",
  },
  {
    category: "process_improvement",
    icon: Workflow,
    title: "A simpler process",
    text: "One shared checklist could make shift handovers easier.",
  },
  {
    category: "equipment_tools",
    icon: Wrench,
    title: "The right tools",
    text: "A shared tool station would save time looking for equipment.",
  },
  {
    category: "work_organization",
    icon: CalendarDays,
    title: "Better organization",
    text: "Earlier shift schedules would help us plan ahead.",
  },
  {
    category: "management_communication",
    icon: MessagesSquare,
    title: "Clearer communication",
    text: "A short team update would help everyone stay informed.",
  },
  {
    category: "employee_wellbeing",
    icon: HeartHandshake,
    title: "A supported team",
    text: "A buddy for new colleagues would make their first weeks easier.",
  },
];

export function VoESubmit({ onDone }: { onDone: () => Promise<void> }) {
  const [category, setCategory] = useState("workplace_conditions"),
    [description, setDescription] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/voe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      setDescription("");
      await onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function exampleCard(item: (typeof examples)[number]) {
    const Icon = item.icon;
    return (
      <button
        key={item.category}
        type="button"
        className={
          "voe-example" + (category === item.category ? " is-selected" : "")
        }
        disabled={busy}
        aria-pressed={category === item.category}
        onClick={() => {
          setCategory(item.category);
          descriptionRef.current?.focus({ preventScroll: true });
          descriptionRef.current?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
              .matches
              ? "auto"
              : "smooth",
            block: "nearest",
          });
        }}
      >
        <span className="voe-example-icon">
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="voe-example-copy">
          <strong>{item.title}</strong>
          <span>{item.text}</span>
        </span>
        <ArrowUpRight
          className="voe-example-arrow"
          size={16}
          aria-hidden="true"
        />
      </button>
    );
  }
  return (
    <div className="page voe-submit-page">
      <div className="page-title voe-heading">
        <div>
          <h1>Voice of Employee</h1>
          <p>Share an idea, concern or workplace feedback</p>
        </div>
      </div>
      <div className="voe-canvas">
        <div className="voe-inspiration-intro">
          <span className="voe-eyebrow">
            <Lightbulb size={16} aria-hidden="true" />
            SMALL IDEAS. BETTER WORKDAYS.
          </span>
          <p>What would make your working day better?</p>
        </div>
        <div className="voe-idea-stage">
          <div className="panel voe-form">
            <div className="voe-compose-heading">
              <span className="voe-compose-icon">
                <MessageSquare size={25} aria-hidden="true" />
              </span>
              <div>
                <h2>Your voice matters</h2>
                <p>A suggestion, a concern, or a fresh idea.</p>
              </div>
            </div>
            <form onSubmit={submit}>
              <label>
                Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={busy}
                >
                  {Object.entries(VOE_CATEGORIES).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Description
                <textarea
                  ref={descriptionRef}
                  rows={6}
                  minLength={5}
                  maxLength={10000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What have you noticed, and what could be better?"
                  required
                  disabled={busy}
                />
              </label>
              {error && (
                <div role="alert" className="form-error">
                  {error}
                </div>
              )}
              <button
                className="primary-btn"
                disabled={busy || description.trim().length < 5}
              >
                <Send size={18} aria-hidden="true" />
                {busy ? "SUBMITTING…" : "SUBMIT VOICE"}
              </button>
            </form>
            <p className="voe-help">
              Your submission is saved in Voice of Employee and appears in My
              Voice History.
            </p>
          </div>
          <div className="voe-example-side voe-example-left">
            {examples.slice(0, 3).map(exampleCard)}
          </div>
          <div className="voe-example-side voe-example-right">
            {examples.slice(3).map(exampleCard)}
          </div>
        </div>
        <p className="voe-inspiration-note">
          These are examples for inspiration. Select a topic and describe your
          own experience.
        </p>
      </div>
    </div>
  );
}
