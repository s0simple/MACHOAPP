# Kalumalu - Truck Transportation System

A comprehensive truck transportation and logistics platform for Ghana, connecting truck drivers with passengers and customers who need to transport goods.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **ORM**: Prisma 7
- **Database**: PostgreSQL (via Prisma Postgres)
- **Styling**: Tailwind CSS 4
- **Authentication**: better-auth
- **Maps**: Ready for Google Maps / Mapbox integration

## Features

### Passenger/Customer
- Create transportation requests with detailed goods information
- Intelligent truck matching based on location, capacity, and price
- Real-time trip tracking (GPS-ready)
- Trip history and notifications
- Rate and review drivers

### Driver/Truck Owner
- Register and manage trucks
- View available transportation requests
- Accept/reject trips
- Track earnings
- Activity logs

### Administrator
- Comprehensive dashboard with analytics
- Manage drivers, passengers, vehicles
- Configure pricing rules
- View reports and statistics
- Approve/suspend accounts

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Prisma Postgres)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kalumalu
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your database URL:
   ```
   DATABASE_URL="your-postgres-connection-string"
   ```

4. **Generate Prisma Client**
   ```bash
   npx prisma generate
   ```

5. **Run database migrations**
   ```bash
   npx prisma migrate dev
   ```

6. **Seed the database**
   ```bash
   npx tsx prisma/seed.ts
   ```

7. **Start the development server**
   ```bash
   npm run dev
   ```

8. **Open your browser**
   Navigate to `http://localhost:3000`

## Demo Accounts

After seeding, you can use these demo accounts:

| Role | Email | Password |
|------|-------|----------|
| Passenger | passenger@demo.com | password123 |
| Driver 1 | driver1@demo.com | password123 |
| Driver 2 | driver2@demo.com | password123 |
| Driver 3 | driver3@demo.com | password123 |

## Project Structure

```
kalumalu/
├── app/
│   ├── api/                    # API routes
│   │   ├── auth/               # Authentication endpoints
│   │   ├── admin/              # Admin API routes
│   │   ├── matching/           # Truck matching API
│   │   ├── requests/           # Transportation requests
│   │   ├── trips/              # Trip management
│   │   ├── vehicles/           # Vehicle management
│   │   └── notifications/      # Notifications
│   ├── dashboard/              # Dashboard pages
│   │   ├── new-request/        # Create new request
│   │   ├── requests/           # View requests
│   │   ├── available-requests/ # Driver: available requests
│   │   ├── my-trips/           # Driver: trip management
│   │   ├── vehicles/           # Vehicle management
│   │   ├── earnings/           # Driver earnings
│   │   ├── drivers/            # Admin: manage drivers
│   │   ├── passengers/         # Admin: manage passengers
│   │   ├── pricing/            # Admin: pricing rules
│   │   ├── reports/            # Admin: reports
│   │   └── notifications/      # Notifications
│   ├── login/                  # Login page
│   ├── register/               # Registration page
│   ├── page.tsx                # Landing page
│   └── layout.tsx              # Root layout
├── lib/
│   ├── auth.ts                 # Authentication configuration
│   ├── prisma.ts               # Prisma client
│   ├── pricing.ts              # Pricing engine
│   └── matching.ts             # Truck matching algorithm
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── seed.ts                 # Database seeder
│   └── migrations/             # Database migrations
└── public/                     # Static assets
```

## Database Schema

The system uses a comprehensive relational database with the following key entities:

- **User** - Base authentication entity
- **Driver** - Extended profile for truck drivers
- **Passenger** - Extended profile for customers
- **Vehicle** - Truck information and specifications
- **VehicleType** - Categories (Mini Truck, Cargo Truck, Container)
- **TransportationRequest** - Customer transport requests
- **Trip** - Active/completed transportation trips
- **Location** - GPS tracking data
- **PricingRule** - Configurable pricing rules
- **Payment** - Payment records
- **Review** - Driver/passenger reviews
- **Notification** - System notifications
- **DriverActivityLog** - Activity tracking

## Truck Matching Algorithm

The intelligent matching system considers:
- Pickup location proximity
- Destination compatibility
- Truck type and capacity
- Load weight and dimensions
- Vehicle availability
- Driver rating
- Distance efficiency

## Pricing System

Transparent pricing based on:
- Base rate (per vehicle type)
- Distance charge (per km)
- Weight charge (per kg)
- Volume charge (if dimensions provided)
- Fragile goods surcharge (15%)
- Refrigeration surcharge (25%)
- Configurable surge multiplier
- Minimum price enforcement

## API Endpoints

### Authentication
- `POST /api/auth/sign-up` - Register new user
- `POST /api/auth/sign-in` - Sign in
- `POST /api/auth/sign-out` - Sign out

### Transportation Requests
- `GET /api/requests` - List all requests
- `POST /api/requests` - Create new request
- `POST /api/requests/[id]/accept` - Accept a request

### Matching
- `POST /api/matching/find` - Find matching trucks

### Admin
- `GET /api/admin/drivers` - List all drivers
- `POST /api/admin/drivers/[id]/approve` - Approve/suspend driver
- `GET /api/admin/passengers` - List all passengers
- `GET /api/admin/pricing` - List pricing rules
- `GET /api/admin/reports` - System reports

## Future Enhancements

- [ ] Real-time GPS tracking with WebSockets
- [ ] Mobile app (React Native)
- [ ] Payment integration (Mobile Money, card)
- [ ] SMS notifications
- [ ] Advanced route optimization
- [ ] Multi-language support (Twi, Ga, Ewe)
- [ ] Document upload (license, insurance)
- [ ] Fuel price integration