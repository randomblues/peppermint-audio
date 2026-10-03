import { beforeEach, describe, expect, it, vi } from "vitest";

const { OAuth2, calendar, eventsInsert, generateAuthUrl, getToken, setCredentials } = vi.hoisted(() => ({
  OAuth2: vi.fn(),
  calendar: vi.fn(),
  eventsInsert: vi.fn(),
  generateAuthUrl: vi.fn(),
  getToken: vi.fn(),
  setCredentials: vi.fn(),
}));

vi.mock("googleapis", () => ({
  google: { auth: { OAuth2 }, calendar },
}));

import {
  createBookingCalendarEvent,
  exchangeGoogleCalendarCode,
  getGoogleCalendarAuthorizationUrl,
} from "./google-calendar";

const details = {
  firstName: "Sam",
  lastName: "Jones",
  email: "sam@example.com",
  mobile: "0412345678",
  eventType: "Wedding",
  eventAddress: "10 Smith Street",
  pickupDate: "2026-12-31",
  dropoffDate: "2027-01-01",
  pickupTime: "10:00",
  dropoffTime: "17:00",
  packageInterest: "Big Events",
  addOns: ["Wireless Microphone", "Subwoofer"],
  additionalDetails: "Please include setup guidance.",
};

describe("Google Calendar integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = "https://example.com/callback";
    delete process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
    delete process.env.GOOGLE_CALENDAR_ID;
    OAuth2.mockImplementation(() => ({ generateAuthUrl, getToken, setCredentials }));
    calendar.mockReturnValue({ events: { insert: eventsInsert } });
    generateAuthUrl.mockReturnValue("https://accounts.google.test/auth");
    getToken.mockResolvedValue({ tokens: { refresh_token: "refresh-token" } });
    eventsInsert.mockResolvedValue({ data: { htmlLink: "https://calendar.google.test/event" } });
  });

  it("rejects missing OAuth configuration", () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(() => getGoogleCalendarAuthorizationUrl()).toThrow("Google Calendar is not configured");
  });

  it("creates an authorization URL and exchanges a code", async () => {
    expect(getGoogleCalendarAuthorizationUrl()).toBe("https://accounts.google.test/auth");
    expect(generateAuthUrl).toHaveBeenCalledWith({
      access_type: "offline",
      prompt: "consent",
      scope: ["https://www.googleapis.com/auth/calendar.events"],
    });
    await expect(exchangeGoogleCalendarCode("auth-code")).resolves.toBe("refresh-token");
    expect(getToken).toHaveBeenCalledWith("auth-code");
  });

  it("skips calendar creation when no refresh token is configured", async () => {
    await expect(createBookingCalendarEvent(details)).resolves.toBeNull();
    expect(eventsInsert).not.toHaveBeenCalled();
  });

  it("builds a timed event when pickup and drop-off times are provided", async () => {
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = "refresh-token";
    process.env.GOOGLE_CALENDAR_ID = "work-calendar";
    await expect(createBookingCalendarEvent(details)).resolves.toBe("https://calendar.google.test/event");
    expect(setCredentials).toHaveBeenCalledWith({ refresh_token: "refresh-token" });
    expect(eventsInsert).toHaveBeenCalledWith({
      calendarId: "work-calendar",
      requestBody: expect.objectContaining({
        summary: "PA Hire - Wedding - Sam Jones",
        location: "10 Smith Street",
        start: { dateTime: "2026-12-31T10:00:00", timeZone: "Australia/Melbourne" },
        end: { dateTime: "2027-01-01T17:00:00", timeZone: "Australia/Melbourne" },
        reminders: { useDefault: true },
        description: expect.stringContaining("Add-ons: Wireless Microphone, Subwoofer"),
      }),
    });

  });

  it("builds an all-day event for older bookings without times", async () => {
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = "refresh-token";
    await createBookingCalendarEvent({ ...details, pickupTime: null, dropoffTime: null });
    expect(eventsInsert.mock.calls[0][0].requestBody.start).toEqual({ date: "2026-12-31" });
    expect(eventsInsert.mock.calls[0][0].requestBody.end).toEqual({ date: "2027-01-02" });
  });

  it("returns null when Google does not provide an event link", async () => {
    process.env.GOOGLE_CALENDAR_REFRESH_TOKEN = "refresh-token";
    eventsInsert.mockResolvedValue({ data: {} });
    await expect(createBookingCalendarEvent({ ...details, addOns: [], additionalDetails: "" })).resolves.toBeNull();
    expect(eventsInsert.mock.calls[0][0].requestBody.description).toContain("Add-ons: None selected");
    expect(eventsInsert.mock.calls[0][0].requestBody.description).toContain("None provided");
  });
});
