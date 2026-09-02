// Shared types for the role-aware dashboard (/api/dashboard/stats + /dashboard).
// The API response is a discriminated union keyed by `role`, so the frontend
// can only access the stats / recent items that exist for the signed-in role.

export type UserRole = "passenger" | "driver" | "admin";

export interface PassengerStats {
  totalRequests: number;
  activeTrips: number;
  completedTrips: number;
  totalSpent: number;
}

export interface DriverStats {
  totalTrips: number;
  activeTrips: number;
  completedTrips: number;
  totalEarnings: number;
  rating: number;
  isAvailable: boolean;
}

export interface AdminStats {
  totalDrivers: number;
  totalPassengers: number;
  totalVehicles: number;
  activeTrips: number;
  completedTrips: number;
  totalRevenue: number;
}

/** Recent transportation request row (passenger + admin views). */
export interface RecentRequestItem {
  id: string;
  pickupAddress: string;
  destAddress: string;
  status: string;
  createdAt: string;
  estimatedPrice: number | null;
  /** Only populated for admins (name of the passenger's user account). */
  passengerName?: string | null;
}

/** Recent trip row (driver view). */
export interface RecentTripItem {
  id: string;
  pickupAddress: string;
  destAddress: string;
  status: string;
  createdAt: string;
  driverEarning: number | null;
}

export interface PassengerDashboardData {
  role: "passenger";
  stats: PassengerStats;
  recentRequests: RecentRequestItem[];
  unreadNotifications: number;
}

export interface DriverDashboardData {
  role: "driver";
  stats: DriverStats;
  recentRequests: RecentTripItem[];
  unreadNotifications: number;
}

export interface AdminDashboardData {
  role: "admin";
  stats: AdminStats;
  recentRequests: RecentRequestItem[];
  unreadNotifications: number;
}

export type DashboardData =
  | PassengerDashboardData
  | DriverDashboardData
  | AdminDashboardData;