"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Clock3, X } from "lucide-react";

import { cn } from "@/lib/utils";

type TimePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
};

const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const hours = Array.from({ length: 12 }, (_, index) => String(index + 1));

function parseTime(value: string) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) {
    return { hour: "9", minute: "00", meridiem: "AM" as const };
  }

  const hour24 = Number(match[1]);
  return {
    hour: String(hour24 % 12 || 12),
    minute: match[2],
    meridiem: hour24 >= 12 ? ("PM" as const) : ("AM" as const),
  };
}

function toTimeValue(hour: string, minute: string, meridiem: "AM" | "PM") {
  const hour12 = Number(hour) % 12;
  const hour24 = hour12 + (meridiem === "PM" ? 12 : 0);
  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

function formatTime(value: string) {
  if (!value) {
    return "Choose a time";
  }

  const { hour, minute, meridiem } = parseTime(value);
  return `${hour}:${minute} ${meridiem}`;
}

export function TimePicker({ id, label, value, onChange, error }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseTime(value));
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function updateDraft(next: Partial<typeof draft>) {
    const nextDraft = { ...draft, ...next };
    setDraft(nextDraft);
    onChange(toTimeValue(nextDraft.hour, nextDraft.minute, nextDraft.meridiem));
  }

  return (
    <div ref={pickerRef} className="relative space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium leading-none">
        {label}
      </label>
      <button
        id={`${id}-picker`}
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-lg border bg-background px-3 text-left text-base outline-none transition-colors sm:text-sm",
          "[@media(pointer:coarse)]:hidden",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          value ? "text-foreground" : "text-muted-foreground",
          error && "border-destructive ring-3 ring-destructive/20",
        )}
        onClick={() => {
          if (!open) {
            setDraft(parseTime(value));
          }
          setOpen((current) => !current);
        }}
      >
        <span className="flex items-center gap-2">
          <Clock3 className="size-4 text-muted-foreground" />
          {formatTime(value)}
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <input
        id={id}
        type="time"
        value={value}
        aria-invalid={Boolean(error)}
        className={cn(
          "hidden h-12 w-full rounded-lg border bg-background px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [@media(pointer:coarse)]:flex sm:text-sm",
          error && "border-destructive ring-3 ring-destructive/20",
        )}
        onChange={(event) => onChange(event.target.value)}
      />

      {open ? (
        <div
          role="dialog"
          aria-label={`Choose ${label.toLowerCase()}`}
          className="absolute right-0 z-30 mt-2 w-[min(22rem,100%)] rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl [@media(pointer:coarse)]:hidden"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">Choose a preferred time</p>
            </div>
            <button
              type="button"
              aria-label={`Clear ${label.toLowerCase()}`}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                onChange("");
                setDraft(parseTime(""));
                setOpen(false);
              }}
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto_1fr_auto] items-end gap-2">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Hour
              <select
                aria-label={`${label} hour`}
                value={draft.hour}
                className="h-11 w-full rounded-lg border bg-background px-2 text-center text-lg font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(event) => updateDraft({ hour: event.target.value })}
              >
                {hours.map((hour) => <option key={hour}>{hour}</option>)}
              </select>
            </label>
            <span className="pb-2 text-xl font-semibold">:</span>
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Minute
              <select
                aria-label={`${label} minute`}
                value={draft.minute}
                className="h-11 w-full rounded-lg border bg-background px-2 text-center text-lg font-semibold text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                onChange={(event) => updateDraft({ minute: event.target.value })}
              >
                {minutes.map((minute) => <option key={minute}>{minute}</option>)}
              </select>
            </label>
            <div className="flex h-11 overflow-hidden rounded-lg border">
              {(["AM", "PM"] as const).map((meridiem) => (
                <button
                  key={meridiem}
                  type="button"
                  aria-pressed={draft.meridiem === meridiem}
                  className={cn(
                    "w-12 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted",
                    draft.meridiem === meridiem && "bg-primary text-primary-foreground hover:bg-primary/90",
                  )}
                  onClick={() => updateDraft({ meridiem })}
                >
                  {meridiem}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={() => {
              onChange(toTimeValue(draft.hour, draft.minute, draft.meridiem));
              setOpen(false);
            }}
          >
            <Check className="size-4" />
            Done
          </button>
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
