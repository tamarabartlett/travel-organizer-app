import { Injectable } from '@angular/core';
import { Trip, emptyFlight, emptyLodging, emptyCar } from '../models/trip.model';

const STORAGE_KEY = 'travel_organizer_trips';

@Injectable({
  providedIn: 'root',
})
export class TripService {
  private trips: Trip[] = [];

  constructor() {
    this.loadTrips();
  }

  private loadTrips(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as (Partial<Trip> & { id: string; createdAt: string })[];
        this.trips = parsed.map((t) => this.normalizeTrip(t));
      }
    } catch {
      this.trips = [];
    }
  }

  private normalizeTrip(t: Partial<Trip> & { id: string; createdAt: string }): Trip {
    const legacy = t as Trip & { name?: string; destination?: string; date?: string; startDate?: string; endDate?: string };
    const legacyLodging = t.lodging as LodgingLegacy | undefined;
    return {
      id: t.id,
      event: t.event ?? legacy.name ?? '',
      location: t.location ?? legacy.destination ?? '',
      beginDate: t.beginDate ?? legacy.date ?? legacy.startDate ?? '',
      endDate: t.endDate ?? '',
      dayPlans: t.dayPlans && typeof t.dayPlans === 'object' ? t.dayPlans : {},
      arrivalFlight: t.arrivalFlight ?? emptyFlight(),
      returnFlight: t.returnFlight ?? emptyFlight(),
      lodging: t.lodging
        ? {
            where: (t.lodging as Trip['lodging']).where ?? legacyLodging?.name ?? '',
            withWhom: (t.lodging as Trip['lodging']).withWhom ?? '',
            reservation: (t.lodging as Trip['lodging']).reservation ?? '',
            address: (t.lodging as Trip['lodging']).address ?? legacyLodging?.address ?? '',
            confirmationNumber: (t.lodging as Trip['lodging']).confirmationNumber ?? legacyLodging?.confirmationNumber ?? '',
            notes: (t.lodging as Trip['lodging']).notes ?? legacyLodging?.notes ?? '',
          }
        : emptyLodging(),
      car: t.car ?? emptyCar(),
      richoNotes: t.richoNotes ?? '',
      sidNotes: t.sidNotes ?? '',
      createdAt: t.createdAt,
    };
  }

  private saveTrips(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.trips));
  }

  getAll(): Trip[] {
    return [...this.trips].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getById(id: string): Trip | undefined {
    return this.trips.find((t) => t.id === id);
  }

  add(trip: Omit<Trip, 'id' | 'createdAt'>): Trip {
    const full: Trip = this.normalizeTrip({
      ...trip,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
    this.trips.push(full);
    this.saveTrips();
    return full;
  }

  update(id: string, updates: Partial<Omit<Trip, 'id' | 'createdAt'>>): Trip | undefined {
    const index = this.trips.findIndex((t) => t.id === id);
    if (index === -1) return undefined;
    const current = this.trips[index];
    const merged: Trip = {
      ...current,
      ...updates,
      dayPlans: updates.dayPlans !== undefined ? updates.dayPlans : current.dayPlans,
      arrivalFlight: updates.arrivalFlight
        ? { ...emptyFlight(), ...current.arrivalFlight, ...updates.arrivalFlight }
        : current.arrivalFlight,
      returnFlight: updates.returnFlight
        ? { ...emptyFlight(), ...current.returnFlight, ...updates.returnFlight }
        : current.returnFlight,
      lodging: updates.lodging
        ? { ...emptyLodging(), ...current.lodging, ...updates.lodging }
        : current.lodging,
      car: updates.car ? { ...emptyCar(), ...current.car, ...updates.car } : current.car,
    };
    this.trips[index] = merged;
    this.saveTrips();
    return this.trips[index];
  }

  delete(id: string): boolean {
    const index = this.trips.findIndex((t) => t.id === id);
    if (index === -1) return false;
    this.trips.splice(index, 1);
    this.saveTrips();
    return true;
  }
}

interface LodgingLegacy {
  name?: string;
  address?: string;
  confirmationNumber?: string;
  notes?: string;
}
