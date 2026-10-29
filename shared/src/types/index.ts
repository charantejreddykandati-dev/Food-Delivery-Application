export type UserRole = 'CUSTOMER' | 'MERCHANT' | 'COURIER' | 'ADMIN';

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentStatus =
  | 'UNPAID'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'REFUNDED';

export type PaymentGateway =
  | 'SIMULATED_STRIPE'
  | 'WALLET_BALANCE'
  | 'CASH_ON_DELIVERY';

export type DeliveryMode = 'STANDARD' | 'PRIORITY_EXPRESS' | 'SCHEDULED';

export type CuisineType =
  | 'Italian'
  | 'South Asian'
  | 'Pan-Asian'
  | 'Mexican'
  | 'American/Burgers'
  | 'Middle Eastern'
  | 'Healthy/Bowls'
  | 'Artisanal Bakery';

export type DietaryFlag =
  | 'Vegan'
  | 'Halal'
  | 'Gluten-Free'
  | 'Keto'
  | 'Nut-Free'
  | 'Dairy-Free'
  | 'Low-FODMAP'
  | 'Organic';

export type ServiceTier =
  | 'Budget Saver'
  | 'Fast Bites'
  | "Chef's Table/Premium"
  | 'Late-Night Kitchen';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  createdAt: string;
}

export interface CustomerAddress {
  id: string;
  userId: string;
  label: string;
  streetAddress: string;
  apartmentUnit?: string | null;
  city: string;
  stateProvince: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  createdAt: string;
}

export interface ModifierOption {
  id: string;
  modifierGroupId: string;
  name: string;
  extraPriceCents: number;
  isAvailable: boolean;
}

export interface ModifierGroup {
  id: string;
  menuItemId: string;
  title: string;
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  options: ModifierOption[];
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  name: string;
  description: string;
  basePriceCents: number;
  imageUrl: string;
  isAvailable: boolean;
  dietaryFlags: DietaryFlag[];
  calories: number | null;
  spiceLevel?: number; // 0 to 5
  prepComplexityMinutes?: number;
  modifierGroups: ModifierGroup[];
}

export interface MenuCategory {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  items: MenuItem[];
}

export interface RestaurantSummary {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  bannerImageUrl: string;
  logoImageUrl: string;
  cuisineTypes: CuisineType[];
  serviceTiers: ServiceTier[];
  isActive: boolean;
  rating: number;
  ratingCount: number;
  priceBracket: '$' | '$$' | '$$$' | '$$$$';
  basePrepTimeMinutes: number;
  address: string;
  latitude: number;
  longitude: number;
  distanceKm?: number;
  estimatedDeliveryMinutes?: number;
  calculatedDeliveryFeeCents?: number;
  operatingHours?: string;
  aiTrendingBadge?: string;
}

export interface RestaurantDetail extends RestaurantSummary {
  categories: MenuCategory[];
}

export interface CartItemModifierSelection {
  modifierOptionId: string;
  modifierName: string;
  extraPriceCents: number;
}

export interface CartItemInput {
  menuItemId: string;
  quantity: number;
  selectedModifiers: CartItemModifierSelection[];
  specialNotes?: string;
}

export interface ValidatedCartLineItem {
  menuItemId: string;
  dishName: string;
  imageUrl: string;
  quantity: number;
  basePriceCents: number;
  modifierTotalCents: number;
  unitPriceCents: number;
  lineTotalCents: number;
  selectedModifiers: CartItemModifierSelection[];
  specialNotes?: string;
}

export interface CartValidationResponse {
  valid: boolean;
  restaurantId: string;
  restaurantName: string;
  distanceKm: number;
  deliveryMode: DeliveryMode;
  scheduledWindow?: string;
  items: ValidatedCartLineItem[];
  subtotalCents: number;
  discountCents: number;
  appliedPromoCode?: string | null;
  deliveryFeeCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  estimatedPrepMinutes: number;
  estimatedTransitMinutes: number;
  estimatedTotalMinutes: number;
  weatherImpactNote: string;
  kitchenLoadLevel: 'LOW' | 'MODERATE' | 'HIGH';
}

export interface OrderItemModifierRecord {
  id: string;
  orderItemId: string;
  modifierNameSnapshot: string;
  extraPriceCents: number;
}

export interface OrderItemRecord {
  id: string;
  orderId: string;
  menuItemId: string;
  itemNameSnapshot: string;
  unitPriceCents: number;
  quantity: number;
  totalPriceCents: number;
  modifiers: OrderItemModifierRecord[];
  specialNotes?: string;
}

export interface OrderEventRecord {
  id: string;
  orderId: string;
  previousStatus: OrderStatus | null;
  newStatus: OrderStatus;
  actorId: string | null;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DriverTelemetry {
  driverName: string;
  driverPhone: string;
  vehicleDescription: string;
  driverRating: number;
  currentLatitude: number;
  currentLongitude: number;
  restaurantLatitude: number;
  restaurantLongitude: number;
  destinationLatitude: number;
  destinationLongitude: number;
  progressRatio: number; // 0.0 to 1.0
  etaRemainingMinutes: number;
  weatherCondition: string;
  kitchenQueuePosition: number;
}

export interface OrderRecord {
  id: string;
  orderNumber: number;
  customerId: string;
  restaurantId: string;
  restaurantName: string;
  restaurantLogoUrl?: string;
  restaurantAddress?: string;
  deliveryAddressId: string | null;
  deliveryAddressSnapshot: {
    label: string;
    streetAddress: string;
    apartmentUnit?: string | null;
    city: string;
    stateProvince: string;
    postalCode: string;
    latitude: number;
    longitude: number;
  };
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentGateway: PaymentGateway;
  deliveryMode: DeliveryMode;
  scheduledWindow?: string | null;
  promoCode?: string | null;
  discountCents: number;
  subtotalCents: number;
  deliveryFeeCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
  estimatedDeliveryTime: string;
  specialInstructions: string | null;
  cancellationReason: string | null;
  customerRating?: number | null;
  customerFeedback?: string | null;
  trackingToken: string;
  items: OrderItemRecord[];
  events: OrderEventRecord[];
  telemetry: DriverTelemetry;
  createdAt: string;
  updatedAt: string;
}

export interface CulinaryRecommendationMatch {
  restaurantId: string;
  restaurantName: string;
  menuItemId: string;
  dishName: string;
  matchReason: string;
  priceCents: number;
  dietaryFitScore: number;
  allergensDetected: string[];
  calories?: number | null;
  estimatedEtaMinutes?: number;
  imageUrl?: string;
}

export interface CulinaryRecommendationResponse {
  recommendationSummary: string;
  matches: CulinaryRecommendationMatch[];
  suggestedBeveragePairing?: string;
  estimatedDeliveryWindow?: string;
}

export interface CartUpsellItem {
  menuItemId: string;
  name: string;
  pairingReason: string;
  priceCents: number;
  imageUrl?: string;
  dietaryFlags?: string[];
}

export interface CartUpsellResponse {
  pitchHeadline: string;
  recommendations: CartUpsellItem[];
}
