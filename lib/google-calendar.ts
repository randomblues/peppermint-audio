import { google } from "googleapis";

type BookingCalendarDetails = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  eventType: string;
  eventAddress: string;
  pickupDate: string;
  dropoffDate: string;
  pickupTime?: string | null;
  dropoffTime?: string | null;
  packageInterest: string;
  addOns: string[];
  guestCount: number;
  additionalDetails: string;
};

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALENDAR_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google Calendar is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALENDAR_REDIRECT_URI.",
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getGoogleCalendarAuthorizationUrl() {
  const client = getOAuthClient();

  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
  });
}

export async function exchangeGoogleCalendarCode(code: string) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  return tokens.refresh_token;
}

function addOneDay(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function createBookingCalendarEvent(details: BookingCalendarDetails) {
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  if (!refreshToken) {
    return null;
  }

  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  const calendar = google.calendar({ version: "v3", auth: client });
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

  const start = details.pickupTime
    ? { dateTime: `${details.pickupDate}T${details.pickupTime}:00`, timeZone: "Australia/Melbourne" }
    : { date: details.pickupDate };
  const end = details.dropoffTime
    ? { dateTime: `${details.dropoffDate}T${details.dropoffTime}:00`, timeZone: "Australia/Melbourne" }
    : { date: addOneDay(details.dropoffDate) };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `PA Hire - ${details.eventType} - ${details.firstName} ${details.lastName}`,
      description: [
        `Customer: ${details.firstName} ${details.lastName}`,
        `Email: ${details.email}`,
        `Mobile: ${details.mobile}`,
        `Package: ${details.packageInterest}`,
        `Add-ons: ${details.addOns.length ? details.addOns.join(", ") : "None selected"}`,
        `Estimated guests: ${details.guestCount}`,
        ...(details.pickupTime ? [`Pickup: ${details.pickupDate} at ${details.pickupTime}`] : []),
        ...(details.dropoffTime ? [`Drop-off: ${details.dropoffDate} at ${details.dropoffTime}`] : []),
        "",
        "Additional details:",
        details.additionalDetails || "None provided",
      ].join("\n"),
      location: details.eventAddress,
      start,
      end,
      reminders: { useDefault: true },
    },
  });

  return response.data.htmlLink ?? null;
}
