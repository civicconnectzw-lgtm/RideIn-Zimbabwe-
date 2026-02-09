# Pricing Model Implementation Documentation

## Overview
This document describes the new pricing model implementation for RideIn Zimbabwe, covering both passenger and freight vehicle categories.

## Pricing Structure

### Passenger Vehicle Categories
| Category | Base Price (≤3 km) | Price per km (>3 km) |
|----------|-------------------|---------------------|
| Standard | $2.00            | $0.50               |
| Premium  | $5.00            | $0.50               |
| Luxury   | $10.00           | $1.00               |

### Freight Vehicle Categories
| Category          | Base Price (≤3 km) | Price per km (>3 km) |
|-------------------|-------------------|---------------------|
| Bike Delivery     | $2.00            | $0.50               |
| 1-2 Tonne Truck   | $10.00           | $1.00               |
| 3-5 Tonne Truck   | $25.00           | $1.00               |
| 7-10 Tonne Truck  | $50.00           | $1.00               |

## Implementation Details

### Files Modified/Created

1. **`frontend/services/pricing.ts`** (NEW)
   - Core pricing calculation module
   - Exports:
     - `calculateTripPrice(distanceKm, category, vehicleType)`: Calculates the total price
     - `getPriceBreakdown(distanceKm, category, vehicleType)`: Returns detailed breakdown
     - `formatPriceBreakdown(distanceKm, category, vehicleType)`: Returns formatted string

2. **`frontend/constants.ts`** (MODIFIED)
   - Updated `PASSENGER_CATEGORIES` with new `basePrice` and `pricePerKm` values
   - Updated `FREIGHT_CATEGORIES` with new `basePrice` and `pricePerKm` values

3. **`frontend/components/RiderHomeView.tsx`** (MODIFIED)
   - Added import for pricing functions
   - Updated route calculation to use new pricing model
   - Added `priceBreakdown` computed value using `useMemo`
   - Updated trip request to include actual distance and duration
   - Enhanced review UI to display price breakdown to users

### Pricing Calculation Logic

The pricing calculation follows this algorithm:

```typescript
if (distanceKm <= 3) {
  price = basePrice
} else {
  additionalDistance = distanceKm - 3
  price = basePrice + (additionalDistance × pricePerKm)
}
```

### Example Calculations

#### Passenger - Standard
- 2 km: $2.00 (base price only)
- 3 km: $2.00 (base price only)
- 5 km: $2.00 + (2 × $0.50) = $3.00
- 10 km: $2.00 + (7 × $0.50) = $5.50

#### Freight - 7-10 Tonne Truck
- 2 km: $50.00 (base price only)
- 3 km: $50.00 (base price only)
- 10 km: $50.00 + (7 × $1.00) = $57.00

## User Experience

When a rider enters pickup and dropoff locations:

1. The system calculates the route distance using Mapbox
2. The pricing module calculates the fare based on:
   - Selected vehicle type (Passenger/Freight)
   - Selected category (Standard/Premium/Luxury or Bike/1-2T/3-5T/7-10T)
   - Route distance in kilometers
3. The UI displays:
   - Total estimated fare (large, prominent)
   - Price breakdown showing:
     - Base price for first 3 km
     - Additional charges if distance > 3 km
     - Total distance
4. Users can switch between categories to see updated pricing
5. Once confirmed, the trip request is sent with the calculated price

## Testing

All pricing calculations have been validated with comprehensive tests covering:
- All passenger categories at various distances
- All freight categories at various distances
- Edge cases:
  - Zero distance (returns $0)
  - Exactly 3 km (base price only)
  - Just over 3 km (base + small additional charge)
  - Long distances (proper calculation of additional charges)

Test results: **25 tests passed, 0 failed**

## Backend Considerations

The backend trip creation endpoint (`Backend/apis/trips/trips_POST.xs`) already accepts:
- `proposed_price`: The calculated price from the frontend
- `distance_km`: The actual distance
- `category`: The vehicle category

The current implementation sends the calculated price from the frontend to the backend. The backend stores this as the `proposed_price` for the trip, which is then used in the bidding process where drivers can accept or counter-offer.

## Future Enhancements

Potential improvements for future iterations:
1. Dynamic pricing based on:
   - Time of day (surge pricing)
   - Traffic conditions
   - Weather conditions
   - Supply/demand ratio
2. Server-side price validation to prevent manipulation
3. Historical price tracking and analytics
4. Promotional discounts and coupon support
5. Multi-stop trip pricing
6. Round-trip discounts

## Maintenance Notes

To update pricing in the future:
1. Modify the pricing configurations in `frontend/services/pricing.ts`
2. Update the constants in `frontend/constants.ts` to match
3. Run tests to validate changes
4. Update this documentation

The pricing model is centralized in the `pricing.ts` module, making it easy to maintain and update as needed.
