import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  DashboardHealthData,
  syncDashboardHealthData,
} from './src/services/healthkit';

type ScreenState = 'loading' | 'ready' | 'error' | 'unavailable';

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

export default function App() {
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<DashboardHealthData | null>(null);

  const loadDashboard = useCallback(async () => {
    setScreenState('loading');
    setErrorMessage('');

    try {
      const result = await syncDashboardHealthData();
      setData(result);
      setScreenState('ready');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to load Health data.';
      const lower = message.toLowerCase();

      if (lower.includes('not available') || lower.includes('only available')) {
        setScreenState('unavailable');
      } else {
        setScreenState('error');
      }

      setErrorMessage(message);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const lastSynced =
    data?.updatedAt != null
      ? new Date(data.updatedAt).toLocaleTimeString()
      : 'Not synced yet';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Health Dashboard</Text>
        <Text style={styles.subtitle}>Today&apos;s synced metrics</Text>

        {screenState === 'loading' && (
          <View style={styles.centeredBlock}>
            <ActivityIndicator size="large" />
            <Text style={styles.helperText}>Syncing with Apple Health...</Text>
          </View>
        )}

        {screenState === 'ready' && data && (
          <>
            <MetricCard label="Steps" value={`${data.steps} steps`} />
            <MetricCard
              label="Active Calories"
              value={`${data.activeCalories} kcal`}
            />
            <MetricCard
              label="Heart Rate"
              value={data.heartRate === null ? 'No data' : `${data.heartRate} bpm`}
            />
            <Text style={styles.lastSynced}>Last synced: {lastSynced}</Text>
          </>
        )}

        {(screenState === 'error' || screenState === 'unavailable') && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>
              {screenState === 'unavailable'
                ? 'HealthKit Unavailable'
                : 'Sync Failed'}
            </Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <Pressable onPress={loadDashboard} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>Refresh Health Data</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 15,
    color: '#475569',
  },
  centeredBlock: {
    alignItems: 'center',
    marginVertical: 28,
  },
  helperText: {
    marginTop: 10,
    color: '#334155',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardLabel: {
    fontSize: 14,
    color: '#334155',
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  lastSynced: {
    marginTop: 10,
    marginBottom: 18,
    color: '#64748B',
    fontSize: 12,
  },
  errorBox: {
    backgroundColor: '#FFF1F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  errorTitle: {
    color: '#9F1239',
    fontWeight: '700',
    marginBottom: 6,
  },
  errorText: {
    color: '#9F1239',
  },
  refreshButton: {
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
});
