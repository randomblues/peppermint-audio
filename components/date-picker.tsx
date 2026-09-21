"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

type DatePickerProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  invalid?: boolean;
};

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDate(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date | null) {
  if (!date) {
    return "Select a date";
  }

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function DatePicker({ id, value, onChange, onBlur, invalid = false }: DatePickerProps) {
  const selectedDate = parseDate(value);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => selectedDate ?? new Date(),
  );
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        onBlur();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onBlur]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: firstDay + daysInMonth }, (_, index) =>
    index < firstDay ? null : index - firstDay + 1,
  );

  function changeMonth(offset: number) {
    setVisibleMonth(new Date(year, month + offset, 1));
  }

  function selectDay(day: number) {
    const date = new Date(year, month, day);
    onChange(formatDateValue(date));
    setOpen(false);
    onBlur();
  }

  return (
    <div ref={pickerRef} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border bg-background px-3 text-left text-sm outline-none transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          value ? "text-foreground" : "text-muted-foreground",
          invalid && "border-destructive ring-3 ring-destructive/20",
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{formatDisplayDate(selectedDate)}</span>
        <CalendarDays className="size-4 text-muted-foreground" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose event date"
          className="absolute top-12 right-0 z-20 w-72 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => changeMonth(-1)}
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-medium">
              {new Intl.DateTimeFormat("en-AU", {
                month: "long",
                year: "numeric",
              }).format(visibleMonth)}
            </p>
            <button
              type="button"
              aria-label="Next month"
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => changeMonth(1)}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 text-center text-xs text-muted-foreground">
            {weekdays.map((weekday) => (
              <span key={weekday} className="py-2 font-medium">
                {weekday}
              </span>
            ))}
            {days.map((day, index) => {
              const date = day ? new Date(year, month, day) : null;
              const dateValue = date ? formatDateValue(date) : "";

              return (
                <span key={`${dateValue}-${index}`} className="p-0.5">
                  {day ? (
                    <button
                      type="button"
                      aria-label={date?.toLocaleDateString("en-AU")}
                      aria-pressed={dateValue === value}
                      className={cn(
                        "flex aspect-square w-full items-center justify-center rounded-md text-sm hover:bg-muted",
                        dateValue === value && "bg-primary text-primary-foreground hover:bg-primary/90",
                      )}
                      onClick={() => selectDay(day)}
                    >
                      {day}
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
