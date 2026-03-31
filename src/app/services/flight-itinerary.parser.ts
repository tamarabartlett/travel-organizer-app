import type { Flight } from '../models/trip.model';

export interface ParsedFlightSegment {
  date: string;
  airline: string;
  flightNumber: string;
  departingAirport: string;
  arrivingAirport: string;
  departureTime: string;
  arrivalTime: string;
  departureDateTime: string;
  arrivalDateTime: string;
}

export interface ParsedFlightImport {
  confirmationNumber: string;
  beginDate: string;
  endDate: string;
  segments: ParsedFlightSegment[];
  arrivalFlight: Flight;
  returnFlight: Flight;
}

const MONTHS: Record<string, number> = {
  January: 0, February: 1, March: 2, April: 3, May: 4, June: 5,
  July: 6, August: 7, September: 8, October: 9, November: 10, December: 11,
};

function decodeQuotedPrintable(raw: string): string {
  return raw
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseDateStr(dateStr: string): string | null {
  const match = dateStr.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(\d{4})/);
  if (!match) return null;
  const month = MONTHS[match[1]];
  if (month === undefined) return null;
  const m = String(month + 1).padStart(2, '0');
  const d = String(parseInt(match[2], 10)).padStart(2, '0');
  return `${match[3]}-${m}-${d}`;
}

function toDateTimeLocal(date: string, timeStr: string): string {
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (!match) return '';
  let h = parseInt(match[1], 10);
  const min = match[2];
  if (match[3].toLowerCase() === 'pm' && h !== 12) h += 12;
  if (match[3].toLowerCase() === 'am' && h === 12) h = 0;
  return `${date}T${String(h).padStart(2, '0')}:${min}:00`;
}

/**
 * Parse United Airlines (and similar) itinerary from .eml or HTML.
 */
export function parseFlightItinerary(emlOrHtml: string): ParsedFlightImport | null {
  const decoded = emlOrHtml.includes('=3D') ? decodeQuotedPrintable(emlOrHtml) : emlOrHtml;
  const body = decoded.replace(/\s+/g, ' ');

  const confMatch = body.match(/Confirmation\s+number:\s*([A-Z0-9]+)/i);
  const confirmationNumber = confMatch ? confMatch[1].trim() : '';

  // Find each segment: "Month DD, YYYY" then later "UA123 operated by X"
  const segmentStarts = [...body.matchAll(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}[\s\S]*?(UA\s*\d+)\s+operated\s+by\s+([^<]+?)(?=<)/gi)];
  if (segmentStarts.length === 0) return null;

  const segments: ParsedFlightSegment[] = [];
  const timeRegex = /\d{1,2}:\d{2}\s*(?:am|pm)/gi;
  const airportRegex = /\b([A-Z]{3})\b/g;
  const skipAirports = new Set(['THE', 'AND', 'FOR', 'CSS', 'DOM', 'VAR', 'MSG', 'UTC', 'API', 'USA', 'ALL']);

  for (let i = 0; i < segmentStarts.length; i++) {
    const fullMatch = segmentStarts[i];
    const startIdx = fullMatch.index ?? 0;
    const dateMatch = fullMatch[0].match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s*\d{4}/);
    const date = dateMatch ? parseDateStr(dateMatch[0]) : null;
    if (!date) continue;

    const flightNum = (fullMatch[2] || '').replace(/\s/g, '');
    const airline = (fullMatch[3] || 'United Airlines').trim();

    // From this segment start, take the next chunk (up to next segment or 800 chars) for times and airports
    const chunkEnd = i + 1 < segmentStarts.length && segmentStarts[i + 1].index != null
      ? segmentStarts[i + 1].index
      : startIdx + 1200;
    const chunk = body.slice(startIdx, chunkEnd);

    const times = chunk.match(timeRegex) || [];
    const depTime = times[0] || '';
    const arrTime = times[1] || '';

    const airportCandidates = chunk.match(airportRegex) || [];
    const airports = airportCandidates.filter((c) => !skipAirports.has(c));
    const from = airports[0] || '';
    const to = airports[1] || '';

    if (!depTime || !arrTime || !from || !to) continue;

    segments.push({
      date,
      airline,
      flightNumber: flightNum.toUpperCase(),
      departingAirport: from,
      arrivingAirport: to,
      departureTime: depTime,
      arrivalTime: arrTime,
      departureDateTime: toDateTimeLocal(date, depTime),
      arrivalDateTime: toDateTimeLocal(date, arrTime),
    });
  }

  if (segments.length === 0) return null;

  const first = segments[0];
  const last = segments[segments.length - 1];

  const toFlight = (s: ParsedFlightSegment): Flight => ({
    airline: s.airline,
    flightNumber: s.flightNumber,
    departingAirport: s.departingAirport,
    arrivingAirport: s.arrivingAirport,
    departureTime: s.departureDateTime,
    arrivalTime: s.arrivalDateTime,
    confirmationNumber,
  });

  return {
    confirmationNumber,
    beginDate: first.date,
    endDate: last.date,
    segments,
    arrivalFlight: toFlight(first),
    returnFlight: toFlight(last),
  };
}
