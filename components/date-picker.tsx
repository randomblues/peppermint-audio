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
  minDate?: string;
  rangeStart?: string;
  rangeEnd?: string;
  onRangeChange?: (start: string, end: string) => void;
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

export function DatePicker({
  id,
  value,
  onChange,
  onBlur,
  invalid = false,
  minDate,
  rangeStart = "",
  rangeEnd = "",
  onRangeChange,
}: DatePickerProps) {
  const selectedDate = parseDate(value);
  const [open, setOpen] = useState(false);
  const [hoveredDate, setHoveredDate] = useState("");
  const [pendingRangeStart, setPendingRangeStart] = useState("");
  const [visibleMonth, setVisibleMonth] = useState(
    () => selectedDate ?? new Date(),
  );
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setHoveredDate("");
        setPendingRangeStart("");
        setOpen(false);
        onBlur();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onBlur]);

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const visualRangeStart = pendingRangeStart || rangeStart;
  const activeRangeEnd = pendingRangeStart ? "" : rangeEnd || value;
  const visualRangeEnd = hoveredDate || activeRangeEnd;
  const hasRange = Boolean(visualRangeStart && visualRangeEnd && visualRangeStart <= visualRangeEnd);
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
    const dateValue = formatDateValue(date);
    if (onRangeChange) {
      if (!pendingRangeStart || dateValue < pendingRangeStart) {
        setPendingRangeStart(dateValue);
        setHoveredDate("");
        onChange(dateValue);
        return;
      }
      onRangeChange(pendingRangeStart, dateValue);
      setPendingRangeStart("");
    } else {
      onChange(dateValue);
    }
    setHoveredDate("");
    setOpen(false);
    onBlur();
  }

  return (
    <div
      ref={pickerRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          setHoveredDate("");
          setPendingRangeStart("");
          onBlur();
          pickerRef.current?.querySelector("button")?.focus();
        }
      }}
    >
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
        onClick={() => {
          setHoveredDate("");
          setPendingRangeStart("");
          if (!open) setVisibleMonth(selectedDate ?? parseDate(rangeStart) ?? new Date());
          setOpen((current) => !current);
        }}
        onMouseLeave={() => setHoveredDate("")}
      >
        <span>{formatDisplayDate(selectedDate)}</span>
        <CalendarDays className="size-4 text-muted-foreground" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose event date"
          className={cn(
            "absolute top-12 z-20 w-72 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-3 text-popover-foreground shadow-xl",
            onRangeChange ? "left-0" : "right-0",
          )}
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

          {onRangeChange ? (
            <p role="status" className="mt-2 text-center text-xs text-muted-foreground">
              {pendingRangeStart ? "Select your end date" : "Select your start date, then your end date"}
            </p>
          ) : null}

          <div className="mt-3 grid grid-cols-7 text-center text-xs text-muted-foreground">
            {weekdays.map((weekday) => (
              <span key={weekday} className="py-2 font-medium">
                {weekday}
              </span>
            ))}
            {days.map((day, index) => {
              const date = day ? new Date(year, month, day) : null;
              const dateValue = date ? formatDateValue(date) : "";
              const isBeforeMinDate = Boolean(minDate && dateValue < minDate);
              const isRangeStart = Boolean(visualRangeStart && dateValue === visualRangeStart);
              const isRangeEnd = Boolean(hasRange && visualRangeEnd && dateValue === visualRangeEnd);
              const isWithinRange = Boolean(hasRange && dateValue > visualRangeStart && dateValue < visualRangeEnd);
              const isStandaloneSelected = !visualRangeStart && dateValue === value;
              return (
                <span
                  key={`${dateValue}-${index}`}
                  data-range-start={isRangeStart ? "true" : undefined}
                  data-range-end={isRangeEnd ? "true" : undefined}
                  data-range-middle={isWithinRange ? "true" : undefined}
                  className={cn(
                    "rounded-md p-0.5",
                    isWithinRange && "bg-primary/18",
                    isRangeStart && "bg-gradient-to-r from-primary/22 to-primary/10",
                    isRangeEnd && "bg-gradient-to-l from-primary/22 to-primary/10",
                  )}
                >
                  {day ? (
                    <button
                      type="button"
                      aria-label={date?.toLocaleDateString("en-AU")}
                      aria-pressed={isRangeStart || isRangeEnd || isStandaloneSelected}
                      className={cn(
                        "flex aspect-square w-full items-center justify-center rounded-md text-sm hover:bg-muted",
                        (isRangeStart || isRangeEnd || isStandaloneSelected) && "bg-primary text-primary-foreground hover:bg-primary/90",
                        isWithinRange && "rounded-sm bg-primary/25 text-foreground hover:bg-primary/30",
                        isBeforeMinDate && "cursor-not-allowed text-muted-foreground/40 hover:bg-transparent",
                      )}
                      disabled={isBeforeMinDate}
                      onMouseEnter={() => {
                        if (visualRangeStart && !isBeforeMinDate) setHoveredDate(dateValue);
                      }}
                      onFocus={() => {
                        if (visualRangeStart && !isBeforeMinDate) setHoveredDate(dateValue);
                      }}
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
