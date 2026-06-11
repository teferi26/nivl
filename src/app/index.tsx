import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { colors } from '@/lib/theme';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.cyan} />
      </View>
    );
  }

  return <Redirect href={session ? '/(tabs)' : '/login'} />;
}
