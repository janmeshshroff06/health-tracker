import AppleHealthKit, { HealthKitPermissions } from 'react-native-health';

const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Steps,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
    ],
    write: [],
  },
};

export const initHealthKit = (): Promise<void> =>
  new Promise((resolve, reject) => {
    AppleHealthKit.initHealthKit(permissions, error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
