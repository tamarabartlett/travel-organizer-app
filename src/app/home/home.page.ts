import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Trip, emptyFlight, emptyLodging, emptyCar } from '../models/trip.model';
import { AuthService } from '../services/auth.service';
import { TripService } from '../services/trip.service';
import { parseFlightItinerary, type ParsedFlightImport } from '../services/flight-itinerary.parser';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  @ViewChild('importFileInput') importFileInput?: ElementRef<HTMLInputElement>;

  trips: Trip[] = [];
  selectedTrip: Trip | null = null;

  importPortalOpen = false;
  importPasteContent = '';
  importError = '';
  importLoading = false;

  constructor(
    private tripService: TripService,
    private auth: AuthService,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController
  ) {}

  logout(): void {
    this.auth.logout();
  }

  getEmptyNewTrip(): Omit<Trip, 'id' | 'createdAt'> {
    return {
      event: '',
      location: '',
      beginDate: '',
      endDate: '',
      dayPlans: {},
      arrivalFlight: emptyFlight(),
      returnFlight: emptyFlight(),
      lodging: emptyLodging(),
      car: emptyCar(),
      richoNotes: '',
      sidNotes: '',
    };
  }

  /** List of days from begin to end (inclusive) for the selected trip. */
  getTripDays(): { date: string; label: string }[] {
    const t = this.selectedTrip;
    if (!t?.beginDate) return [];
    const start = new Date(t.beginDate);
    const end = t.endDate ? new Date(t.endDate) : new Date(t.beginDate);
    if (end < start) return [{ date: t.beginDate, label: this.formatDayLabel(t.beginDate) }];
    const out: { date: string; label: string }[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      const dateStr = cur.toISOString().slice(0, 10);
      out.push({ date: dateStr, label: this.formatDayLabel(dateStr) });
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }

  private formatDayLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return `${days[d.getDay()]} ${month}/${day}`;
  }

  getDayPlan(date: string): string {
    return this.selectedTrip?.dayPlans?.[date] ?? '';
  }

  setDayPlan(date: string, plan: string): void {
    if (!this.selectedTrip) return;
    if (!this.selectedTrip.dayPlans) this.selectedTrip.dayPlans = {};
    this.selectedTrip.dayPlans[date] = plan;
    this.saveTrip();
  }

  ngOnInit(): void {
    this.loadTrips();
  }

  loadTrips(): void {
    this.trips = this.tripService.getAll();
    if (this.selectedTrip) {
      this.selectedTrip = this.tripService.getById(this.selectedTrip.id) ?? null;
    }
  }

  /** Trips that are not archived (no end date, or end/begin date is today or in the past). */
  get activeTrips(): Trip[] {
    const today = this.startOfToday();
    return this.trips.filter((t) => !this.isArchived(t, today));
  }

  /** Trips whose end (or begin) date is after today. */
  get archivedTrips(): Trip[] {
    const today = this.startOfToday();
    return this.trips.filter((t) => this.isArchived(t, today));
  }

  private startOfToday(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  private isArchived(trip: Trip, today: Date): boolean {
    const dateStr = trip.endDate || trip.beginDate;
    if (!dateStr) return false;
    const tripDate = new Date(dateStr);
    tripDate.setHours(0, 0, 0, 0);
    return tripDate < today;
  }

  selectTrip(trip: Trip): void {
    this.selectedTrip = trip;
  }

  openNewTrip(): void {
    const newTripData = this.getEmptyNewTrip();
    newTripData.event = 'New trip';
    const created = this.tripService.add(newTripData);
    this.loadTrips();
    this.selectedTrip = created;
  }

  saveTrip(): void {
    if (!this.selectedTrip) return;
    this.tripService.update(this.selectedTrip.id, {
      event: this.selectedTrip.event,
      location: this.selectedTrip.location,
      beginDate: this.selectedTrip.beginDate,
      endDate: this.selectedTrip.endDate,
      dayPlans: this.selectedTrip.dayPlans,
      arrivalFlight: this.selectedTrip.arrivalFlight,
      returnFlight: this.selectedTrip.returnFlight,
      lodging: this.selectedTrip.lodging,
      car: this.selectedTrip.car,
      richoNotes: this.selectedTrip.richoNotes,
      sidNotes: this.selectedTrip.sidNotes,
    });
    this.loadTrips();
    this.selectedTrip = this.tripService.getById(this.selectedTrip.id) ?? null;
  }

  deleteTrip(trip: Trip): void {
    this.tripService.delete(trip.id);
    if (this.selectedTrip?.id === trip.id) {
      this.selectedTrip = null;
    }
    this.loadTrips();
  }

  clearSelection(): void {
    this.selectedTrip = null;
  }

  openImportPortal(): void {
    this.importError = '';
    this.importPasteContent = '';
    this.importPortalOpen = true;
  }

  closeImportPortal(): void {
    this.importPortalOpen = false;
    this.importError = '';
    this.importPasteContent = '';
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    this.importError = '';
    const reader = new FileReader();
    reader.onload = () => {
      this.importPasteContent = (reader.result as string) ?? '';
    };
    reader.onerror = () => {
      this.importError = 'Could not read file.';
    };
    reader.readAsText(file, 'utf-8');
  }

  runImport(): void {
    const raw = this.importPasteContent?.trim();
    if (!raw) {
      this.importError = 'Choose a file or paste email content.';
      return;
    }
    this.importError = '';
    this.importLoading = true;
    const parsed = parseFlightItinerary(raw);
    this.importLoading = false;

    if (!parsed) {
      this.importError = 'Could not parse flight information from this content.';
      return;
    }

    if (this.selectedTrip) {
      this.tripService.update(this.selectedTrip.id, {
        beginDate: parsed.beginDate,
        endDate: parsed.endDate,
        arrivalFlight: { ...parsed.arrivalFlight },
        returnFlight: { ...parsed.returnFlight },
      });
      this.loadTrips();
      this.selectedTrip = this.tripService.getById(this.selectedTrip.id) ?? null;
    }

    this.closeImportPortal();
    this.showImportSuccess(parsed);
  }

  private async showImportSuccess(parsed: ParsedFlightImport): Promise<void> {
    await this.toastCtrl.create({
      message: 'Flight information imported successfully.',
      duration: 3000,
      position: 'top',
      color: 'success',
    }).then((t) => t.present());

    const message = this.formatImportedSummary(parsed);
    await this.alertCtrl.create({
      header: 'Imported flight information',
      message,
      buttons: ['OK'],
    }).then((a) => a.present());
  }

  private formatImportedSummary(parsed: ParsedFlightImport): string {
    const a = parsed.arrivalFlight;
    const r = parsed.returnFlight;
    const lines: string[] = [
      `Confirmation: ${parsed.confirmationNumber || '—'}`,
      `Dates: ${parsed.beginDate} – ${parsed.endDate}`,
      '',
      'Outbound: ' + [a.airline, a.flightNumber, `${a.departingAirport} → ${a.arrivingAirport}`, a.departureTime, a.arrivalTime].filter(Boolean).join(' · '),
      'Return: ' + [r.airline, r.flightNumber, `${r.departingAirport} → ${r.arrivingAirport}`, r.departureTime, r.arrivalTime].filter(Boolean).join(' · '),
    ];
    if (parsed.segments.length > 2) {
      lines.push('', `(${parsed.segments.length} segments total)`);
    }
    return lines.join('\n');
  }
}
