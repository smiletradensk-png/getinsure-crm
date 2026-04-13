import React, { useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Modal, TouchableOpacity, ScrollView, TextInput as RNTextInput, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { Text, ActivityIndicator, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Message {
  id: string;
  text: string;
  isUser: boolean;
}

export default function TabLayout() {
  const [aiVisible, setAiVisible] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm GETINSURE AI, your personal CRM assistant. I can help you:\n\n• Add or search leads\n• Schedule follow-ups\n• Get statistics\n• Compose WhatsApp messages\n• And much more!\n\nHow can I help you today?",
      isUser: false,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/assistant/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage.text }),
      });

      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response,
        isUser: false,
      };

      setMessages(prev => [...prev, aiMessage]);

      // Handle navigation actions
      if (data.action?.action === 'navigate') {
        setAiVisible(false);
        if (data.action.screen === 'leads') router.push('/(tabs)/leads');
        else if (data.action.screen === 'followups') router.push('/(tabs)/followups');
        else if (data.action.screen === 'dashboard') router.push('/(tabs)');
        else if (data.action.screen === 'settings') router.push('/(tabs)/settings');
      } else if (data.action?.action === 'add_lead') {
        setAiVisible(false);
        router.push('/add-lead');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I couldn't process your request. Please try again.",
        isUser: false,
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: '#009688',
          tabBarInactiveTintColor: '#757575',
          headerShown: false,
          tabBarStyle: {
            height: 65,
            paddingBottom: 8,
            paddingTop: 4,
          },
          tabBarLabelStyle: {
            fontSize: 10,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="view-dashboard" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="leads"
          options={{
            title: 'Leads',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="account-group" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="ai"
          options={{
            title: '',
            tabBarButton: (props) => (
              <TouchableOpacity
                style={styles.aiTabContainer}
                onPress={() => setAiVisible(true)}
              >
                <View style={styles.aiTabButton}>
                  <MaterialCommunityIcons name="robot-happy" size={26} color="#FFFFFF" />
                </View>
                <Text style={styles.aiTabLabel}>AI</Text>
              </TouchableOpacity>
            ),
          }}
        />
        <Tabs.Screen
          name="followups"
          options={{
            title: 'Tasks',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="calendar-check" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="pipeline"
          options={{
            title: 'Pipeline',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="chart-timeline-variant" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'More',
            tabBarIcon: ({ color }) => (
              <MaterialCommunityIcons name="dots-horizontal" size={22} color={color} />
            ),
          }}
        />
      </Tabs>

      {/* AI Assistant Modal */}
      <Modal
        visible={aiVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAiVisible(false)}
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
              <IconButton icon="close" iconColor="#757575" size={24} onPress={() => setAiVisible(false)} />
            </View>

            {/* Messages */}
            <ScrollView style={styles.messagesContainer} contentContainerStyle={styles.messagesContent}>
              {messages.map((message) => (
                <View
                  key={message.id}
                  style={[styles.messageBubble, message.isUser ? styles.userBubble : styles.aiBubble]}
                >
                  {!message.isUser && (
                    <MaterialCommunityIcons name="robot" size={16} color="#009688" style={styles.aiIcon} />
                  )}
                  <Text style={[styles.messageText, message.isUser ? styles.userText : styles.aiText]}>
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
                style={styles.micButton}
                onPress={() => Alert.alert('Voice Input', 'Voice input requires Expo development build. Please type your message.')}
              >
                <MaterialCommunityIcons name="microphone-outline" size={24} color="#757575" />
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
                <MaterialCommunityIcons name="send" size={24} color={inputText.trim() ? '#FFFFFF' : '#BDBDBD'} />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  aiTabContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  aiTabButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#009688',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -15,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  aiTabLabel: {
    fontSize: 10,
    color: '#009688',
    marginTop: 2,
    fontWeight: 'bold',
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
