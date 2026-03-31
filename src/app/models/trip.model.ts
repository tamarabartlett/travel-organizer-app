export interface Flight {
  airline: string;
  flightNumber: string;
  departingAirport: string;
  arrivingAirport: string;
  departureTime: string;
  arrivalTime: string;
  confirmationNumber: string;
}

export interface Lodging {
  where: string;
  withWhom: string;
  reservation: string;
  address: string;
  confirmationNumber: string;
  notes: string;
}

export interface Car {
  company: string;
  reservation: string;
  type: string;
  days: string;
  location: string;
}

/** Map of date string (YYYY-MM-DD) to plan text for that day */
export type DayPlans = Record<string, string>;

export interface Trip {
  id: string;
  event: string;
  location: string;
  beginDate: string;
  endDate: string;
  dayPlans: DayPlans;
  arrivalFlight: Flight;
  returnFlight: Flight;
  lodging: Lodging;
  car: Car;
  richoNotes: string;
  sidNotes: string;
  createdAt: string;
}

export function emptyFlight(): Flight {
  return {
    airline: '',
    flightNumber: '',
    departingAirport: '',
    arrivingAirport: '',
    departureTime: '',
    arrivalTime: '',
    confirmationNumber: '',
  };
}

export function emptyLodging(): Lodging {
  return {
    where: '',
    withWhom: '',
    reservation: '',
    address: '',
    confirmationNumber: '',
    notes: '',
  };
}

export function emptyCar(): Car {
  return {
    company: '',
    reservation: '',
    type: '',
    days: '',
    location: '',
  };
}
