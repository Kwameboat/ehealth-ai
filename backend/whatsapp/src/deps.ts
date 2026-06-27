import type { RequestHandler } from 'express';

export interface DbUser {
  id: string;
  phone?: string | null;
  points_balance: number;
  is_active: number;
  full_name?: string | null;
  email?: string | null;
}

export interface DeductResult {
  charged: number;
  balance: number;
  skipped?: boolean;
}

export interface WhatsAppDeps {
  getDb: () => {
    prepare: (sql: string) => {
      get: (...args: unknown[]) => unknown;
      all: (...args: unknown[]) => unknown[];
      run: (...args: unknown[]) => unknown;
    };
  };
  uuid: () => string;
  now: () => string;
  getSetting: (key: string, fallback?: string | null) => string | null;
  setSetting: (key: string, value: string) => void;
  getGeminiApiKey: () => string | null;
  deductPoints: (userId: string, featureKey: string, note?: string | null) => DeductResult;
  getUserBalance: (userId: string) => number;
  requireAdminAuth: RequestHandler;
  PointsError: new (message: string, code?: string, status?: number) => Error & { code: string; status: number };
  ensureDbReady?: () => Promise<void>;
  findNearbyFacilities?: (opts: {
    latitude: number;
    longitude: number;
    type?: string;
    radiusMeters?: number;
    limit?: number;
  }) => Promise<{ label?: string; places?: Array<Record<string, unknown>> }>;
  initializePaystack?: (opts: {
    email: string;
    amountMinor: number;
    currency: string;
    reference: string;
    metadata?: Record<string, unknown>;
  }) => Promise<{ authorization_url?: string }>;
  getUserEmail?: (userId: string) => string | null;
}
