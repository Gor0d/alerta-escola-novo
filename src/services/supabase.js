import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = 'https://qzbykuloshtkdxrvivuo.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6YnlrdWxvc2h0a2R4cnZpdnVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzNTAwOTQsImV4cCI6MjA1ODkyNjA5NH0.F5kNlTsiMYDtq66tRJ2Y-0K0dSJ4bjtl4BBTNq9cIY4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});