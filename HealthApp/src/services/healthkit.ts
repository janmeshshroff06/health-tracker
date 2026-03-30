import { NativeModules, Platform } from 'react-native';
import type { HealthKitPermissions, HealthValue } from 'react-native-health';

const HKPackage = require('react-native-health');
const AppleHealthKit =
  NativeModules.AppleHealthKit ??
  NativeModules.RCTAppleHealthKit ??
  HKPackage?.default ??
  HKPackage?.HealthKit ??
  HKPackage;

const assertHKMethod = (name: string) => {
  if (typeof AppleHealthKit?.[name] !== 'function') {
    const keys = Object.keys(AppleHealthKit ?? {});
    throw new Error(
      `HealthKit native module missing method "${name}". Available keys: ${
        keys.length ? keys.join(', ') : 'none'
      }`,
    );
  }
};

export type DashboardHealthData = {
  steps: number;
  activeCalories: number;
  heartRate: number | null;
  updatedAt: string;
};

const permissions: HealthKitPermissions = {
  permissions: {
    read: ['StepCount', 'HeartRate', 'ActiveEnergyBurned'] as any,
    write: [],
  },
};

const startOfTodayISO = (): string => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
};

const nowISO = (): string => new Date().toISOString();

const toFiniteNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const assertHealthKitAvailable = async (): Promise<void> => {
  if (Platform.OS !== 'ios') {
    throw new Error('HealthKit is only available on iOS.');
  }

  assertHKMethod('isAvailable');

  await new Promise<void>((resolve, reject) => {
    AppleHealthKit.isAvailable((error: object, available: boolean) => {
      if (error || !available) {
        reject(new Error('HealthKit is not available on this device.'));
        return;
      }
      resolve();
    });
  });
};

export const initHealthKit = async (): Promise<void> => {
  assertHKMethod('initHealthKit');

  await new Promise<void>((resolve, reject) => {
    AppleHealthKit.initHealthKit(permissions, (error: string) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }
      resolve();
    });
  });
};

const getStepCountForToday = async (): Promise<number> => {
  assertHKMethod('getStepCount');

  return new Promise<number>((resolve, reject) => {
    AppleHealthKit.getStepCount(
      {
        date: nowISO(),
        includeManuallyAdded: true,
      } as any,
      (error: string, result: HealthValue) => {
        if (error) {
          reject(new Error(String(error)));
          return;
        }
        resolve(toFiniteNumber(result?.value));
      },
    );
  });
};

const getActiveCaloriesForToday = async (): Promise<number> => {
  assertHKMethod('getActiveEnergyBurned');

  return new Promise<number>((resolve, reject) => {
    AppleHealthKit.getActiveEnergyBurned(
      {
        startDate: startOfTodayISO(),
        endDate: nowISO(),
        ascending: false,
        includeManuallyAdded: true,
      } as any,
      (error: string, samples: HealthValue[]) => {
        if (error) {
          reject(new Error(String(error)));
          return;
        }

        const total = (samples ?? []).reduce(
          (sum, sample) => sum + toFiniteNumber(sample?.value),
          0,
        );

        resolve(total);
      },
    );
  });
};

const getLatestHeartRate = async (): Promise<number | null> => {
  assertHKMethod('getHeartRateSamples');

  return new Promise<number | null>((resolve, reject) => {
    AppleHealthKit.getHeartRateSamples(
      {
        unit: 'bpm',
        startDate: startOfTodayISO(),
        endDate: nowISO(),
        ascending: false,
        limit: 1,
      } as any,
      (error: string, samples: HealthValue[]) => {
        if (error) {
          reject(new Error(String(error)));
          return;
        }

        if (!samples || samples.length === 0) {
          resolve(null);
          return;
        }

        resolve(toFiniteNumber(samples[0]?.value));
      },
    );
  });
};

export const syncDashboardHealthData = async (): Promise<DashboardHealthData> => {
  console.log('HK methods', Object.keys(AppleHealthKit || {}));
  console.log('isAvailable type', typeof AppleHealthKit?.isAvailable);

  await assertHealthKitAvailable();
  await initHealthKit();

  const [steps, activeCalories, heartRate] = await Promise.all([
    getStepCountForToday(),
    getActiveCaloriesForToday(),
    getLatestHeartRate(),
  ]);

  return {
    steps: Math.round(steps),
    activeCalories: Math.round(activeCalories),
    heartRate: heartRate === null ? null : Math.round(heartRate),
    updatedAt: nowISO(),
  };
};