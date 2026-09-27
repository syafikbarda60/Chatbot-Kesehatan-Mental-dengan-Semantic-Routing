
import { useState, useRef, useEffect, useCallback } from 'react';
import { Animated } from 'react-native';
import { analyzeStress, QUICK_REPLIES, reactToUserMessage, type Expression } from '@prototype/utils';
import { apiChatStream, apiGetChatHistory, apiReportToTeam } from '@prototype/api-client';
import { useToast } from '../components/ui/Toast';
import {Message} from '@prototype/utils';
export interface UseChatReturn {
  messages: Message[];
  inputText: string;
  setInputText: (t: string) => void;
  isTyping: boolean;
  stressLevel: number;
  showAlert: boolean;
  closeAlert: () => void;
  setShowAlert: (v: boolean) => void;
  setAlertTriggered: (v: boolean) => void;
  quickReplies: string[];
  showQuickReplies: boolean;
  sendMessage: (text: string) => void;
  confirmReport: () => void;
  sendBtnScale: Animated.Value;
  sessionId: string;
  isHighRisk: boolean;
  isLoadingHistory: boolean;
  expression: Expression;
}

// Generate session ID per chat session (UUIDv4 for PostgreSQL compatibility)
function generateSessionId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Greeting lokal — tidak perlu hit backend
const GREETINGS = [
  'Hei, senang kamu di sini. Apa yang ingin kamu ceritakan hari ini?',
  'Halo! Aku siap mendengarkan. Bagaimana perasaanmu sekarang?',
  'Selamat datang. Ceritakan apa pun yang ada di pikiranmu.',
];
const pickGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

export function useChat(initialSessionId?: string): UseChatReturn {
  const [messages, setMessages]         = useState<Message[]>([]);
  const [inputText, setInputText]       = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const [stressLevel, setStressLevel]   = useState(0);
  const [showAlert, setShowAlert]       = useState(false);
  const [alertTriggered, setAlertTriggered] = useState(false);
  const [quickReplies, setQuickReplies] = useState(QUICK_REPLIES.initial);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [isHighRisk, setIsHighRisk]     = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending]       = useState(false);
  const [expression, setExpression]     = useState<Expression>('menyapa');

  const toast = useToast();
  const sessionIdRef      = useRef(initialSessionId || generateSessionId());
  const sendBtnScale   = useRef(new Animated.Value(1)).current;
  const abortStreamRef = useRef<(() => void) | null>(null);

  // Keep sessionIdRef in sync with initialSessionId prop changes
  useEffect(() => {
    if (initialSessionId) {
      sessionIdRef.current = initialSessionId;
    }
  }, [initialSessionId]);

  const sessionId = sessionIdRef.current;

  // ── Add AI message ─────────────────────────────────────────────
  const addAI = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `ai-${Date.now()}`, text, sender: 'ai', timestamp: new Date(), expression: 'menyapa' },
    ]);
  }, []);

  // ── Greeting or History on mount ───────────────────────────────
  useEffect(() => {
    if (initialSessionId) {
      setIsLoadingHistory(true);
      apiGetChatHistory(initialSessionId)
        .then((res) => {
          let lastReaction: Expression = 'senang';
          const histMessages: Message[] = res.messages.map((m: any): Message => {
            const isUser = m.role === 'user';
            if (isUser) lastReaction = reactToUserMessage(m.content, lastReaction);
            return {
              id: m.id || `hist-${m.created_at}`,
              text: m.content,
              sender: isUser ? 'user' : 'ai',
              timestamp: new Date(m.created_at),
              expression: isUser ? undefined : (m.route_used === 'guardrail' ? 'tenang' : lastReaction),
            };
          });
          setMessages(histMessages);
          setExpression(lastReaction);
        })
        .catch(err => {
          console.error("Failed to load chat history:", err);
          toast.show('Riwayat percakapan ini belum bisa dimuat.', 'error');
        })
        .finally(() => {
          setIsLoadingHistory(false);
        });
    } else {
      const t = setTimeout(() => addAI(pickGreeting()), 600);
      return () => clearTimeout(t);
    }
  }, [addAI, initialSessionId]);

  // ── Abort stream on unmount ────────────────────────────────────
  useEffect(() => {
    return () => { abortStreamRef.current?.(); };
  }, []);

  // ── Re-analyze stress whenever messages change ─────────────────
  useEffect(() => {
    const level = analyzeStress(messages);
    setStressLevel(level);

    // Trigger alert when stress goes high
    if (level >= 7 && !alertTriggered) {
      const t = setTimeout(() => {
        setShowAlert(true);
        setAlertTriggered(true);
      }, 900);
      return () => clearTimeout(t);
    }

    // Reset alertTriggered when stress drops below threshold
    if (level < 7 && alertTriggered) {
      setAlertTriggered(false);
    }
  }, [messages, alertTriggered]);

  // ── Upgrade/downgrade quick replies on stress change ───────────────────────
  useEffect(() => {
    if (stressLevel >= 4 && messages.length > 3) {
      setQuickReplies(QUICK_REPLIES.mid);
    } else if (stressLevel < 4) {
      setQuickReplies(QUICK_REPLIES.initial);
    }
  }, [stressLevel, messages.length]);


  // ── Send message → SSE stream ─────────────────────────────────
  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      // Abort previous in-flight stream so we can start fresh with the latest message
      abortStreamRef.current?.();

      const userMsg: Message = {
        id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        text: trimmed,
        sender: 'user',
        timestamp: new Date(),
      };

      // Create new empty AI placeholder for the response
      const aiMsgId = `ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      // The companion reacts to what the user said right away
      const reaction = reactToUserMessage(trimmed, expression);
      setExpression(reaction);

      const aiPlaceholder: Message = {
        id: aiMsgId,
        text: '',
        sender: 'ai',
        timestamp: new Date(),
        expression: reaction,
      };

      // Clean existing messages: keep any previous message that has text
      const previousValidMessages = messages.filter(
        (m) => !(m.sender === 'ai' && m.text.trim() === '')
      );

      // Construct history array from all prior messages for LLM context
      const historyPayload = previousValidMessages
        .filter((m) => m.text.trim().length > 0)
        .map((m) => ({
          role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.text,
        }));

      setMessages([...previousValidMessages, userMsg, aiPlaceholder]);
      setInputText('');
      setIsTyping(true);
      setShowQuickReplies(false);
      setIsSending(true);

      // Send button bounce
      Animated.sequence([
        Animated.spring(sendBtnScale, { toValue: 0.82, useNativeDriver: true }),
        Animated.spring(sendBtnScale, { toValue: 1, useNativeDriver: true }),
      ]).start();

      // Start SSE stream with full history
      const abort = apiChatStream(
        {
          message: trimmed,
          session_id: sessionId,
          history: historyPayload,
        },
        (token) => {
          setIsTyping(false); // Hide typing dots once first token arrives
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, text: m.text + token } : m
            )
          );
        },
        // onDone: receive metadata from stream
        (meta) => {
          setIsTyping(false);
          setShowQuickReplies(true);
          setIsSending(false);
          abortStreamRef.current = null;
          if (meta.is_high_risk || meta.route === 'guardrail') {
            // Crisis: never leave a playful face on screen
            setExpression('tenang');
            setMessages((prev) => prev.map((m) => (m.id === aiMsgId ? { ...m, expression: 'tenang' } : m)));
          }
          if (meta.is_high_risk) {
            setIsHighRisk(true);
            setShowAlert(true);
            setAlertTriggered(true);
          }
        },
        // onError: fallback message
        (err) => {
          console.error('Chat stream error:', err);
          toast.show('Sajiwa belum bisa membalas. Periksa koneksimu lalu coba kirim lagi.', 'error');
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, text: m.text || 'Maaf, aku sedang tidak bisa dihubungi. Coba lagi sebentar ya.', expression: 'bingung' }
                : m
            )
          );
          setIsTyping(false);
          setShowQuickReplies(true);
          setIsSending(false);
          abortStreamRef.current = null;
        },
        {
          maxRetries: 3,
          baseRetryDelayMs: 1000,
          onRetry: (attempt, error) => {
            console.warn(`Chat stream retry ${attempt}/3:`, error.message);
          },
        }
      );

      abortStreamRef.current = abort;
    },
    [sendBtnScale, sessionId, messages, expression]
  );

  // ── Report confirmed ──────────────────────────────────────────
  // Actually notify the team (logged as an unread safety signal on the counselor dashboard).
  // Never claim it was sent unless the server confirmed it.
  const confirmReport = useCallback(async () => {
    setShowAlert(false);
    setExpression('tenang');
    try {
      await apiReportToTeam(sessionIdRef.current);
      toast.show('Tim Sajiwa sudah dikabari.');
      addAI(
        'Kabarmu sudah diteruskan ke tim Sajiwa dan akan ditinjau oleh konselor. Sambil menunggu, ' +
        'kamu tetap bisa menghubungi hotline kapan saja. Kamu tidak sendirian.'
      );
    } catch {
      toast.show('Kabar belum terkirim. Kalau mendesak, hubungi hotline langsung dari tombol telepon.', 'error');
    }
  }, [addAI, toast]);

  return {
    messages,
    inputText,
    setInputText,
    isTyping,
    stressLevel,
    showAlert,
    closeAlert: () => setShowAlert(false),
    setShowAlert,
    setAlertTriggered,
    quickReplies,
    showQuickReplies,
    sendMessage,
    confirmReport,
    sendBtnScale,
    sessionId,
    isHighRisk,
    isLoadingHistory,
    expression,
  };
}


