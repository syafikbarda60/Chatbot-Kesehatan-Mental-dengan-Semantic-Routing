
import { useState, useRef, useEffect, useCallback } from 'react';
import { Animated } from 'react-native';
import { analyzeStress, QUICK_REPLIES } from '@prototype/utils';
import { apiChatStream, apiGetChatHistory } from '@prototype/api-client';
import {Message} from '@prototype/utils';
export interface UseChatReturn {
  messages: Message[];
  inputText: string;
  setInputText: (t: string) => void;
  isTyping: boolean;
  stressLevel: number;
  showAlert: boolean;
  closeAlert: () => void;
  quickReplies: string[];
  showQuickReplies: boolean;
  sendMessage: (text: string) => void;
  confirmReport: () => void;
  sendBtnScale: Animated.Value;
  sessionId: string;
  isHighRisk: boolean;
  isLoadingHistory: boolean;
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
  'Hei, senang kamu di sini  Apa yang ingin kamu ceritakan hari ini?',
  'Halo! Aku siap mendengarkan. Bagaimana perasaanmu sekarang?',
  'Selamat datang  Ceritakan apapun yang ada di pikiranmu.',
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

  const sessionId      = useRef(initialSessionId || generateSessionId()).current;
  const sendBtnScale   = useRef(new Animated.Value(1)).current;
  const abortStreamRef = useRef<(() => void) | null>(null);

  // ── Add AI message ─────────────────────────────────────────────
  const addAI = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `ai-${Date.now()}`, text, sender: 'ai', timestamp: new Date() },
    ]);
  }, []);

  // ── Greeting or History on mount ───────────────────────────────
  useEffect(() => {
    if (initialSessionId) {
      setIsLoadingHistory(true);
      apiGetChatHistory(initialSessionId)
        .then((res) => {
          const histMessages = res.messages.map((m: any) => ({
            id: m.id || `hist-${m.created_at}`,
            text: m.content,
            sender: m.role === 'user' ? 'user' : 'ai',
            timestamp: new Date(m.created_at),
          }));
          setMessages(histMessages);
        })
        .catch(err => {
          console.error("Failed to load chat history:", err);
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

    if (level >= 7 && !alertTriggered) {
      const t = setTimeout(() => {
        setShowAlert(true);
        setAlertTriggered(true);
      }, 900);
      return () => clearTimeout(t);
    }
  }, [messages, alertTriggered]);

  // ── Upgrade quick replies on mid-stress ───────────────────────
  useEffect(() => {
    if (stressLevel >= 4 && messages.length > 3) {
      setQuickReplies(QUICK_REPLIES.mid);
    }
  }, [stressLevel, messages.length]);


  // ── Send message → SSE stream ─────────────────────────────────
  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      // Abort any existing stream
      abortStreamRef.current?.();

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        text: text.trim(),
        sender: 'user',
        timestamp: new Date(),
      };

      // Create empty AI placeholder that we'll fill token-by-token
      const aiMsgId = `ai-${Date.now()}`;
      const aiPlaceholder: Message = {
        id: aiMsgId,
        text: '',
        sender: 'ai',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg, aiPlaceholder]);
      setInputText('');
      setIsTyping(true);
      setShowQuickReplies(false);

      // Send button bounce
      Animated.sequence([
        Animated.spring(sendBtnScale, { toValue: 0.82, useNativeDriver: true }),
        Animated.spring(sendBtnScale, { toValue: 1, useNativeDriver: true }),
      ]).start();

      // Start SSE stream
      const abort = apiChatStream(
        { message: text.trim(), session_id: sessionId },
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
          abortStreamRef.current = null;
          if (meta.is_high_risk) {
            setIsHighRisk(true);
            setShowAlert(true);
            setAlertTriggered(true);
          }
        },
        // onError: fallback message
        () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, text: 'Maaf, aku sedang tidak bisa dihubungi. Coba lagi sebentar ya 🙏' }
                : m
            )
          );
          setIsTyping(false);
          setShowQuickReplies(true);
          abortStreamRef.current = null;
        },
      );

      abortStreamRef.current = abort;
    },
    [sendBtnScale, sessionId]
  );

  // ── Report confirmed ──────────────────────────────────────────
  const confirmReport = useCallback(() => {
    setShowAlert(false);
    addAI(
      '🔔 Informasimu telah dikirim ke tim Sanctuary. Seseorang akan menghubungimu. Kamu tidak sendirian 💙'
    );
  }, [addAI]);

  return {
    messages,
    inputText,
    setInputText,
    isTyping,
    stressLevel,
    showAlert,
    closeAlert: () => setShowAlert(false),
    quickReplies,
    showQuickReplies,
    sendMessage,
    confirmReport,
    sendBtnScale,
    sessionId,
    isHighRisk,
    isLoadingHistory,
  };
}


