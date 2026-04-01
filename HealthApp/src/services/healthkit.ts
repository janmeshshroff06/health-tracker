import { NativeModules, Platform } from 'react-native';
import type { HealthKitPermissions, HealthValue } from 'react-native-health';

const HKPackage = Platform.OS === 'ios' ? require('react-native-health') : null;
const AppleHealthKit =
  NativeModules.AppleHealthKit ??
  NativeModules.RCTAppleHealthKit ??
  HKPackage?.default ??
  HKPackage?.HealthKit ??
  HKPackage;

const HealthConnectNative: any =
  Platform.OS === 'android'
    ? NativeModules.HealthConnect ??
      NativeModules.HealthConnectNative ??
      NativeModules.RNHealthConnectSpec ??
      NativeModules.RNHealthConnect
    : null;

export type DashboardHealthData = {
  steps: number;
  activeCalories: number;
  heartRate: number | null;
  updatedAt: string;
};

const iosPermissions: HealthKitPermissions = {
  permissions: {
    read: ['StepCount', 'HeartRate', 'ActiveEnergyBurned'] as any,
    write: [],
  },
};

const androidReadPermissions = [
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'HeartRate' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
] as const;

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

const getNumberAtPath = (obj: unknown, path: string): number => {
  const value = path
    .split('.')
    .reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  return toFiniteNumber(value);
};

const firstPositiveAtPaths = (obj: unknown, paths: string[]): number => {
  for (const path of paths) {
    const value = getNumberAtPath(obj, path);
    if (value > 0) {
      return value;
    }
  }
  return 0;
};

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

const assertHealthConnectMethod = (name: string) => {
  if (typeof HealthConnectNative?.[name] !== 'function') {
    const keys = Object.keys(HealthConnectNative ?? {});
    throw new Error(
      `Health Connect method "${name}" is missing. Available keys: ${
        keys.length ? keys.join(', ') : 'none'
      }`,
    );
  }
};


const assertHealthKitAvailable = async (): Promise<void> => {
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

const initHealthKit = async (): Promise<void> => {
  assertHKMethod('initHealthKit');

  await new Promise<void>((resolve, reject) => {
    AppleHealthKit.initHealthKit(iosPermissions, (error: string) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }
      resolve();
    });
  });
};

const getIOSStepCountForToday = async (): Promise<number> => {
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

const getIOSActiveCaloriesForToday = async (): Promise<number> => {
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

const getIOSLatestHeartRate = async (): Promise<number | null> => {
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

const assertAndroidHealthConnectReady = async (): Promise<void> => {
  if (Platform.OS !== 'android') {
    throw new Error('Health Connect is only available on Android.');
  }

  if (!HealthConnectNative) {
    const names = Object.keys(NativeModules).filter((k) =>
      k.toLowerCase().includes('health'),
    );
    throw new Error(
      `Health Connect native module not found. Native health modules: ${names.join(', ') || 'none'}`
    );
  }

  assertHealthConnectMethod('initialize');
  assertHealthConnectMethod('requestPermission');

  const initialized = await HealthConnectNative.initialize('com.google.android.apps.healthdata');
  if (!initialized) {
    throw new Error('Health Connect initialization failed.');
  }


  const granted: Array<{ accessType: string; recordType: string }> =
    await HealthConnectNative.requestPermission(androidReadPermissions);

  const hasAllPermissions = androidReadPermissions.every((requiredPermission) =>
    granted.some(
      (grantedPermission) =>
        grantedPermission.accessType === requiredPermission.accessType &&
        grantedPermission.recordType === requiredPermission.recordType,
    ),
  );

  if (!hasAllPermissions) {
    throw new Error(
      'Required Health Connect permissions were not granted (Steps, HeartRate, ActiveCaloriesBurned).',
    );
  }
};

const getAndroidStepCountForToday = async (): Promise<number> => {
  assertHealthConnectMethod('aggregateRecord');
  assertHealthConnectMethod('readRecords');

  const timeRangeFilter = {
    operator: 'between',
    startTime: startOfTodayISO(),
    endTime: nowISO(),
  } as const;

  const aggregate = await HealthConnectNative.aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter,
  });

  const aggregateSteps = firstPositiveAtPaths(aggregate, [
    'COUNT_TOTAL',
    'count',
    'inCount',
  ]);
  if (aggregateSteps > 0) {
    return aggregateSteps;
  }

  const { records } = await HealthConnectNative.readRecords('Steps', {
    timeRangeFilter,
  });

  return (records ?? []).reduce(
    (sum: number, record: Record<string, unknown>) =>
      sum + toFiniteNumber(record.count ?? record.steps ?? record.value),
    0,
  );
};

const getAndroidActiveCaloriesForToday = async (): Promise<number> => {
  assertHealthConnectMethod('aggregateRecord');
  assertHealthConnectMethod('readRecords');

  const timeRangeFilter = {
    operator: 'between',
    startTime: startOfTodayISO(),
    endTime: nowISO(),
  } as const;

  const aggregate = await HealthConnectNative.aggregateRecord({
    recordType: 'ActiveCaloriesBurned',
    timeRangeFilter,
  });

  const aggregateKcal = firstPositiveAtPaths(aggregate, [
    'inKilocalories',
    'energy.inKilocalories',
  ]);
  if (aggregateKcal > 0) {
    return aggregateKcal;
  }

  const { records } = await HealthConnectNative.readRecords(
    'ActiveCaloriesBurned',
    {
      timeRangeFilter,
    },
  );

  return (records ?? []).reduce(
    (sum: number, record: Record<string, unknown>) =>
      sum + getNumberAtPath(record, 'energy.inKilocalories'),
    0,
  );
};

const getAndroidLatestHeartRate = async (): Promise<number | null> => {
  assertHealthConnectMethod('readRecords');

  const timeRangeFilter = {
    operator: 'between',
    startTime: startOfTodayISO(),
    endTime: nowISO(),
  } as const;

  const { records } = await HealthConnectNative.readRecords('HeartRate', {
    timeRangeFilter,
  });

  let latestTime = -1;
  let latestBpm: number | null = null;

  for (const record of records ?? []) {
    const typedRecord = record as Record<string, unknown>;
    const samples = Array.isArray(typedRecord.samples)
      ? (typedRecord.samples as Array<Record<string, unknown>>)
      : [];

    if (samples.length > 0) {
      for (const sample of samples) {
        const bpm = toFiniteNumber(sample.beatsPerMinute ?? sample.value);
        const t = Date.parse(
          String(sample.time ?? typedRecord.endTime ?? typedRecord.startTime),
        );

        if (bpm > 0 && Number.isFinite(t) && t > latestTime) {
          latestTime = t;
          latestBpm = bpm;
        }
      }
      continue;
    }

    const fallbackBpm = toFiniteNumber(
      typedRecord.beatsPerMinute ?? typedRecord.bpm,
    );
    const fallbackTime = Date.parse(
      String(typedRecord.endTime ?? typedRecord.startTime ?? ''),
    );

    if (
      fallbackBpm > 0 &&
      Number.isFinite(fallbackTime) &&
      fallbackTime > latestTime
    ) {
      latestTime = fallbackTime;
      latestBpm = fallbackBpm;
    }
  }

  return latestBpm;
};

const syncFromIOS = async (): Promise<DashboardHealthData> => {
  await assertHealthKitAvailable();
  await initHealthKit();

  const [steps, activeCalories, heartRate] = await Promise.all([
    getIOSStepCountForToday(),
    getIOSActiveCaloriesForToday(),
    getIOSLatestHeartRate(),
  ]);

  return {
    steps: Math.round(steps),
    activeCalories: Math.round(activeCalories),
    heartRate: heartRate === null ? null : Math.round(heartRate),
    updatedAt: nowISO(),
  };
};

const syncFromAndroid = async (): Promise<DashboardHealthData> => {
  await assertAndroidHealthConnectReady();

  const [steps, activeCalories, heartRate] = await Promise.all([
    getAndroidStepCountForToday(),
    getAndroidActiveCaloriesForToday(),
    getAndroidLatestHeartRate(),
  ]);

  return {
    steps: Math.round(steps),
    activeCalories: Math.round(activeCalories),
    heartRate: heartRate === null ? null : Math.round(heartRate),
    updatedAt: nowISO(),
  };
};

export const syncDashboardHealthData = async (): Promise<DashboardHealthData> => {
  if (Platform.OS === 'ios') {
    return syncFromIOS();
  }

  if (Platform.OS === 'android') {
    return syncFromAndroid();
  }

  throw new Error('Unsupported platform for health sync.');
};
