/** Adresse des Servers. Für Tests z. B. EXPO_PUBLIC_API_URL=http://192.168.1.20:3000 setzen. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://fahrschule-beyourself.de').replace(/\/$/, '');
