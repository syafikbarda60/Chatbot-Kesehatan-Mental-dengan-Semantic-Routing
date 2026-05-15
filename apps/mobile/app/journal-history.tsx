import React, { useEffect, useState } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, 
  FlatList 
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@prototype/ui-shared';
import { BottomNav, FadeIn } from '../components/ui';
import { apiGetJournals } from '@prototype/api-client';

export default function JournalHistoryScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  
  const [journals, setJournals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    fetchJournals();
  }, []);

  const fetchJournals = async (loadMore = false) => {
    if (isFetchingMore || (!hasMore && loadMore)) return;
    
    if (loadMore) {
      setIsFetchingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const currentOffset = loadMore ? journals.length : 0;
      const limit = 10;
      const data = await apiGetJournals(limit, currentOffset);
      
      const newJournals = data.journals || [];
      if (loadMore) {
        setJournals(prev => [...prev, ...newJournals]);
      } else {
        setJournals(newJournals);
      }
      
      if (newJournals.length < limit) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (e) {
      console.log('Failed to fetch journals', e);
    } finally {
      setIsLoading(false);
      setIsFetchingMore(false);
    }
  };

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case 'Calm': return 'water-outline';
      case 'Anxious': return 'pulse-outline';
      case 'Focused': return 'locate-outline';
      case 'Tired': return 'moon-outline';
      default: return 'leaf-outline';
    }
  };

  const renderItem = ({ item }: any) => (
    <FadeIn delay={0}>
      <TouchableOpacity 
        activeOpacity={0.8}
        onPress={() => {
          router.push({
            pathname: '/journal-detail',
            params: {
              content: item.content,
              mood: item.mood,
              created_at: item.created_at
            }
          });
        }}
        style={[s.card, { backgroundColor: colors.surfaceContainerLowest }]}
      >
        <View style={s.cardHeader}>
          <Text style={[s.dateText, { color: colors.outline }]}>{formatDate(item.created_at)}</Text>
          {item.mood && (
            <View style={[s.moodBadge, { backgroundColor: colors.surfaceContainerLow }]}>
              <Ionicons name={getMoodIcon(item.mood) as any} size={14} color={colors.primary} />
              <Text style={[s.moodText, { color: colors.primary }]}>{item.mood}</Text>
            </View>
          )}
        </View>
        <Text style={[s.contentText, { color: colors.onSurface }]} numberOfLines={3}>
          {item.content}
        </Text>
      </TouchableOpacity>
    </FadeIn>
  );

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={[s.header, { paddingTop: insets.top + 16 }]}>
        <View style={s.headerInner}>
          <Text style={[s.headerTitle, { color: colors.onSurface }]}>History Jurnal</Text>
          <View style={s.avatar}>
            <Ionicons name="person" size={18} color={colors.onSurfaceVariant} />
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={journals}
          keyExtractor={(item) => item.journal_id}
          contentContainerStyle={[s.listContent, { paddingBottom: 100 }]}
          renderItem={renderItem}
          onEndReached={() => fetchJournals(true)}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="book-outline" size={48} color={colors.outline} style={{ marginBottom: 16 }} />
              <Text style={[s.emptyText, { color: colors.onSurfaceVariant }]}>Belum ada jurnal.</Text>
            </View>
          }
          ListFooterComponent={
            isFetchingMore ? (
              <View style={{ paddingVertical: 20 }}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}

      <BottomNav />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#00000008' },
  headerInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 24, fontFamily: 'PlusJakartaSans_800ExtraBold', letterSpacing: -0.5 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 24, gap: 16 },
  empty: { alignItems: 'center', marginTop: 64 },
  emptyText: { fontSize: 16, fontFamily: 'PlusJakartaSans_500Medium' },
  
  card: {
    padding: 20,
    borderRadius: 20,
    shadowColor: '#2b3437',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dateText: { fontSize: 12, fontFamily: 'PlusJakartaSans_700Bold' },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  moodText: { fontSize: 10, fontFamily: 'PlusJakartaSans_700Bold' },
  contentText: {
    fontSize: 14,
    fontFamily: 'PlusJakartaSans_500Medium',
    lineHeight: 22,
  },
});
