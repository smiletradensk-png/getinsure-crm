import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput as RNTextInput,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Text, ActivityIndicator, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { getAllLeadsLocal, getLocalStats, searchLeadsLocal } from '../utils/database';


interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface AIAssistantProps {
  onNavigate?: (screen: string) => void;
}

export default function AIAssistant({ onNavigate }: AIAssistantProps) {
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm GETINSURE AI, your personal CRM assistant. I can help you:\n\n• Add or search leads\n• Schedule follow-ups\n• Get statistics\n• Compose WhatsApp messages\n• And much more!\n\nHow can I help you today?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const processMessageLocally = (userText: string): { response: string; action?: any } => {
    const text = userText.toLowerCase().trim();
    const today = new Date().toISOString().split('T')[0];

    // Stats / summary
    if (/\b(stats|statistics|summary|overview)\b/.test(text) || /\bhow many\b/.test(text)) {
      const stats = getLocalStats();
      return {
        response:
          `📊 Your CRM Summary:\n\n` +
          `• Total Leads: ${stats.total_leads}\n` +
          `• Interested: ${stats.interested_leads}\n` +
          `• Closed: ${stats.closed_leads}\n` +
          `• Today's Follow-ups: ${stats.today_followups}\n` +
          `• Overdue: ${stats.overdue_followups}`,
      };
    }

    // Today's follow-ups
    if (/today.{0,10}follow|follow.{0,10}today/.test(text)) {
      const leads = getAllLeadsLocal();
      const todayLeads = leads.filter((l: any) => l.next_followup_date === today);
      if (todayLeads.length === 0) return { response: "You have no follow-ups scheduled for today. 🎉" };
      const list = todayLeads.slice(0, 5).map((l: any) => `• ${l.name} (${l.mobile}) — ${l.status}`).join('\n');
      const extra = todayLeads.length > 5 ? `\n\n...and ${todayLeads.length - 5} more.` : '';
      return { response: `📅 Today's follow-ups (${todayLeads.length}):\n\n${list}${extra}` };
    }

    // Overdue
    if (/\boverdue\b/.test(text)) {
      const leads = getAllLeadsLocal();
      const overdue = leads.filter(
        (l: any) => l.next_followup_date && l.next_followup_date < today &&
          !['Closed', 'Not Interested'].includes(l.status)
      );
      if (overdue.length === 0) return { response: "Great news! You have no overdue follow-ups. ✅" };
      const list = overdue.slice(0, 5).map((l: any) => `• ${l.name} (${l.mobile}) — due ${l.next_followup_date}`).join('\n');
      const extra = overdue.length > 5 ? `\n\n...and ${overdue.length - 5} more.` : '';
      return { response: `⚠️ Overdue follow-ups (${overdue.length}):\n\n${list}${extra}` };
    }

    // Search / find by name, mobile, or city
    const searchMatch = text.match(/(?:search|find|show|look\s*up)\s+(?:lead\s+)?(?:for\s+)?(.+)/);
    if (searchMatch) {
      const query = searchMatch[1].trim();
      const results = searchLeadsLocal(query);
      if (results.length === 0) return { response: `No leads found matching "${query}".` };
      const list = results.slice(0, 5).map((l: any) => `• ${l.name} (${l.mobile}) — ${l.status}`).join('\n');
      return { response: `🔍 Found ${results.length} lead(s) for "${query}":\n\n${list}` };
    }

    // All leads
    if (/\b(all leads|list leads|show leads|my leads)\b/.test(text)) {
      const leads = getAllLeadsLocal();
      if (leads.length === 0) return { response: "You have no leads yet. Say \"add new lead\" to get started!" };
      const list = leads.slice(0, 5).map((l: any) => `• ${l.name} (${l.mobile}) — ${l.status}`).join('\n');
      const extra = leads.length > 5 ? `\n\n...and ${leads.length - 5} more. Open the Leads tab to see all.` : '';
      return { response: `📋 Your leads (${leads.length}):\n\n${list}${extra}` };
    }

    // By status
    const statusKeywords: Record<string, string> = {
      'interested': 'Interested',
      'closed': 'Closed',
      'new': 'New',
      'not interested': 'Not Interested',
      'called': 'Called',
      'pending': 'Pending',
    };
    for (const [keyword, status] of Object.entries(statusKeywords)) {
      if (text.includes(keyword)) {
        const leads = getAllLeadsLocal();
        const filtered = leads.filter((l: any) => l.status === status);
        if (filtered.length === 0) return { response: `No leads with status "${status}" found.` };
        const list = filtered.slice(0, 5).map((l: any) => `• ${l.name} (${l.mobile})`).join('\n');
        const extra = filtered.length > 5 ? `\n\n...and ${filtered.length - 5} more.` : '';
        return { response: `📋 ${status} leads (${filtered.length}):\n\n${list}${extra}` };
      }
    }

    // Add lead
    if (/\b(add|create|new)\b.*\blead\b/.test(text) || /\blead\b.*\b(add|create|new)\b/.test(text)) {
      return { response: "Sure! Taking you to add a new lead.", action: { action: 'add_lead' } };
    }

    // Navigation
    if (/\b(dashboard|home)\b/.test(text)) {
      return { response: "Taking you to the dashboard!", action: { action: 'navigate', screen: 'dashboard' } };
    }
    if (/\bleads\b/.test(text) && /\b(go|open|show|navigate)\b/.test(text)) {
      return { response: "Taking you to the leads screen!", action: { action: 'navigate', screen: 'leads' } };
    }
    if (/\bfollow.?ups?\b/.test(text) && /\b(go|open|show|navigate)\b/.test(text)) {
      return { response: "Taking you to follow-ups!", action: { action: 'navigate', screen: 'followups' } };
    }
    if (/\bsettings\b/.test(text)) {
      return { response: "Taking you to settings!", action: { action: 'navigate', screen: 'settings' } };
    }

    // Default help
    return {
      response:
        "I can help you with:\n\n" +
        "• Stats — \"show me stats\"\n" +
        "• Search — \"find John\"\n" +
        "• By status — \"show interested leads\"\n" +
        "• Follow-ups — \"today's follow-ups\"\n" +
        "• Overdue — \"show overdue leads\"\n" +
        "• All leads — \"list all leads\"\n" +
        "• Navigate — \"go to dashboard\"\n" +
        "• Add lead — \"add new lead\"\n\n" +
        "What would you like to know?",
    };
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    const result = processMessageLocally(userMessage.text);

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: result.response,
      isUser: false,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, aiMessage]);
    setLoading(false);

    if (result.action) {
      handleAction(result.action);
    }
  };

  const handleAction = (action: any) => {
    switch (action.action) {
      case 'navigate':
        setVisible(false);
        if (action.screen === 'leads') router.push('/(tabs)/leads');
        else if (action.screen === 'followups') router.push('/(tabs)/followups');
        else if (action.screen === 'dashboard') router.push('/(tabs)');
        else if (action.screen === 'settings') router.push('/(tabs)/settings');
        break;
      case 'add_lead':
        setVisible(false);
        router.push('/add-lead');
        break;
      default:
        break;
    }
  };

  const handleVoiceInput = () => {
    // Voice input - show alert for now since expo-speech-recognition requires native builds
    Alert.alert(
      'Voice Input',
      'Voice input requires Expo development build. For now, please type your message.',
      [{ text: 'OK' }]
    );
    setIsListening(false);
  };

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  return (
    <>
      {/* Floating AI Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => setVisible(true)}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="robot-happy" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Chat Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.chatContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <MaterialCommunityIcons name="robot-happy" size={32} color="#009688" />
                <View style={styles.headerText}>
                  <Text style={styles.headerTitle}>GETINSURE AI</Text>
                  <Text style={styles.headerSubtitle}>Your Personal Assistant</Text>
                </View>
              </View>
              <IconButton
                icon="close"
                iconColor="#757575"
                size={24}
                onPress={() => setVisible(false)}
              />
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
            >
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.isUser ? styles.userBubble : styles.aiBubble,
                  ]}
                >
                  {!message.isUser && (
                    <MaterialCommunityIcons
                      name="robot"
                      size={16}
                      color="#009688"
                      style={styles.aiIcon}
                    />
                  )}
                  <Text
                    style={[
                      styles.messageText,
                      message.isUser ? styles.userText : styles.aiText,
                    ]}
                  >
                    {message.text}
                  </Text>
                </View>
              ))}
              {loading && (
                <View style={[styles.messageBubble, styles.aiBubble]}>
                  <ActivityIndicator size="small" color="#009688" />
                  <Text style={styles.typingText}>Thinking...</Text>
                </View>
              )}
            </ScrollView>

            {/* Input Area */}
            <View style={styles.inputContainer}>
              <TouchableOpacity
                style={[styles.micButton, isListening && styles.micButtonActive]}
                onPress={handleVoiceInput}
              >
                <MaterialCommunityIcons
                  name={isListening ? 'microphone' : 'microphone-outline'}
                  size={24}
                  color={isListening ? '#F44336' : '#757575'}
                />
              </TouchableOpacity>
              
              <RNTextInput
                style={styles.textInput}
                placeholder="Type your message..."
                placeholderTextColor="#9E9E9E"
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={sendMessage}
                multiline
                maxLength={500}
              />
              
              <TouchableOpacity
                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                onPress={sendMessage}
                disabled={!inputText.trim() || loading}
              >
                <MaterialCommunityIcons
                  name="send"
                  size={24}
                  color={inputText.trim() ? '#FFFFFF' : '#BDBDBD'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#009688',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 1000,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  chatContainer: {
    height: '85%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#757575',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  userBubble: {
    backgroundColor: '#009688',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  aiIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: '#424242',
  },
  typingText: {
    color: '#757575',
    marginLeft: 8,
    fontStyle: 'italic',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  micButtonActive: {
    backgroundColor: '#FFEBEE',
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    backgroundColor: '#F5F5F5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#424242',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#009688',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
});
