/**
 * Pricing calculation module for RideIn Zimbabwe
 * Implements the new pricing model for passenger and freight vehicle categories
 */

import { PassengerCategory, FreightCategory, VehicleType } from '../types';

// ============================================================================
// PRICING CONFIGURATION
// ============================================================================

const BASE_DISTANCE_KM = 3;

interface PricingConfig {
  basePrice: number;    // Price for first 3 km
  pricePerKm: number;   // Price per km after 3 km
}

// Passenger Vehicle Pricing
const PASSENGER_PRICING: Record<PassengerCategory, PricingConfig> = {
  [PassengerCategory.STANDARD]: {
    basePrice: 2,
    pricePerKm: 0.5
  },
  [PassengerCategory.PREMIUM]: {
    basePrice: 5,
    pricePerKm: 0.5
  },
  [PassengerCategory.LUXURY]: {
    basePrice: 10,
    pricePerKm: 1
  }
};

// Freight Vehicle Pricing
const FREIGHT_PRICING: Record<FreightCategory, PricingConfig> = {
  [FreightCategory.BIKE]: {
    basePrice: 2,
    pricePerKm: 0.5
  },
  [FreightCategory.TONNE_1_2]: {
    basePrice: 10,
    pricePerKm: 1
  },
  [FreightCategory.TONNE_3_5]: {
    basePrice: 25,
    pricePerKm: 1
  },
  [FreightCategory.TONNE_7_10]: {
    basePrice: 50,
    pricePerKm: 1
  }
};

// ============================================================================
// PRICING CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate the price for a trip based on distance and category
 * @param distanceKm - Distance of the trip in kilometers
 * @param category - Vehicle category (e.g., "Standard", "Premium", "Luxury", etc.)
 * @param vehicleType - Type of vehicle (PASSENGER or FREIGHT)
 * @returns Calculated price in USD
 */
export function calculateTripPrice(
  distanceKm: number,
  category: string,
  vehicleType: VehicleType
): number {
  // Validate inputs
  if (distanceKm < 0) {
    throw new Error('Distance cannot be negative');
  }
  
  if (distanceKm === 0) {
    return 0;
  }

  // Get the pricing config based on vehicle type and category
  const pricingConfig = getPricingConfig(category, vehicleType);
  
  // Calculate price
  if (distanceKm <= BASE_DISTANCE_KM) {
    // For trips up to 3 km, charge only the base price
    return pricingConfig.basePrice;
  } else {
    // For trips over 3 km, charge base price + per km rate for additional distance
    const additionalDistance = distanceKm - BASE_DISTANCE_KM;
    return pricingConfig.basePrice + (additionalDistance * pricingConfig.pricePerKm);
  }
}

/**
 * Get pricing configuration for a specific category and vehicle type
 * @param category - Vehicle category
 * @param vehicleType - Type of vehicle (PASSENGER or FREIGHT)
 * @returns Pricing configuration
 */
function getPricingConfig(category: string, vehicleType: VehicleType): PricingConfig {
  if (vehicleType === VehicleType.PASSENGER) {
    // Check if category matches a PassengerCategory
    const passengerCategory = Object.values(PassengerCategory).find(cat => cat === category);
    if (passengerCategory) {
      return PASSENGER_PRICING[passengerCategory];
    }
  } else if (vehicleType === VehicleType.FREIGHT) {
    // Check if category matches a FreightCategory
    const freightCategory = Object.values(FreightCategory).find(cat => cat === category);
    if (freightCategory) {
      return FREIGHT_PRICING[freightCategory];
    }
  }
  
  // Fallback to default pricing if category not found
  console.warn(`Unknown category: ${category} for vehicle type: ${vehicleType}. Using default pricing.`);
  return { basePrice: 2, pricePerKm: 0.5 };
}

/**
 * Get a breakdown of the trip price showing base price and additional charges
 * @param distanceKm - Distance of the trip in kilometers
 * @param category - Vehicle category
 * @param vehicleType - Type of vehicle (PASSENGER or FREIGHT)
 * @returns Price breakdown object
 */
export function getPriceBreakdown(
  distanceKm: number,
  category: string,
  vehicleType: VehicleType
): {
  basePrice: number;
  additionalDistance: number;
  additionalCharge: number;
  totalPrice: number;
  pricePerKm: number;
} {
  const pricingConfig = getPricingConfig(category, vehicleType);
  const totalPrice = calculateTripPrice(distanceKm, category, vehicleType);
  
  if (distanceKm <= BASE_DISTANCE_KM) {
    return {
      basePrice: pricingConfig.basePrice,
      additionalDistance: 0,
      additionalCharge: 0,
      totalPrice: totalPrice,
      pricePerKm: pricingConfig.pricePerKm
    };
  } else {
    const additionalDistance = distanceKm - BASE_DISTANCE_KM;
    const additionalCharge = additionalDistance * pricingConfig.pricePerKm;
    
    return {
      basePrice: pricingConfig.basePrice,
      additionalDistance: additionalDistance,
      additionalCharge: additionalCharge,
      totalPrice: totalPrice,
      pricePerKm: pricingConfig.pricePerKm
    };
  }
}

/**
 * Format price breakdown as a human-readable string
 * @param distanceKm - Distance of the trip in kilometers
 * @param category - Vehicle category
 * @param vehicleType - Type of vehicle (PASSENGER or FREIGHT)
 * @returns Formatted price breakdown string
 */
export function formatPriceBreakdown(
  distanceKm: number,
  category: string,
  vehicleType: VehicleType
): string {
  const breakdown = getPriceBreakdown(distanceKm, category, vehicleType);
  
  if (breakdown.additionalDistance === 0) {
    return `Base price (up to ${BASE_DISTANCE_KM} km): $${breakdown.basePrice.toFixed(2)}`;
  } else {
    return `Base price (${BASE_DISTANCE_KM} km): $${breakdown.basePrice.toFixed(2)}\n` +
           `Additional ${breakdown.additionalDistance.toFixed(2)} km @ $${breakdown.pricePerKm}/km: $${breakdown.additionalCharge.toFixed(2)}\n` +
           `Total: $${breakdown.totalPrice.toFixed(2)}`;
  }
}
