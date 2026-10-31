import { Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { token } = useAuth();
  return <Redirect href={token ? '/home' : '/login'} />;
}
