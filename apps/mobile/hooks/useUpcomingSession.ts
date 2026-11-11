// The student's next counseling session, for any screen that shows it. Refetched whenever the
// screen regains focus, so a request sent on Konseling, or confirmed by an admin meanwhile,
// is current when the student comes back to Home or Profil.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { apiGetMyCounselingRequests, type MyCounselingRequest } from '@prototype/api-client';
import { nearestSession } from './upcomingSession';

export function useUpcomingSession() {
  const [requests, setRequests] = useState<MyCounselingRequest[]>([]);

  // Optional everywhere it appears: on failure the block simply does not render.
  const reload = useCallback(() => {
    apiGetMyCounselingRequests().then((r) => setRequests(r.requests)).catch(() => {});
  }, []);

  useFocusEffect(reload);

  return { upcoming: nearestSession(requests), reload };
}
