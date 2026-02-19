import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  ActivityIndicator,
  Button,
  TextInput,
  SegmentedButtons,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

const BACKEND_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface Lead {
  id: string;
  name: string;
  mobile: string;
  product: string;
  status: string;
  source: string;
  city: string;
  premium_amount: number;
  expected_closing_month: string;
  notes: string;
  next_followup_date?: string;
  created_at: string;
}

interface Interaction {
  id: string;
  type: string;
  description: string;
  created_at: string;
}

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddInteraction, setShowAddInteraction] = useState(false);
  const [interactionType, setInteractionType] = useState('Call');
  const [interactionDescription, setInteractionDescription] = useState('');
  const [addingInteraction, setAddingInteraction] = useState(false);

  const fetchLeadData = async () => {
    try {
      const leadResponse = await fetch(`${BACKEND_URL}/api/leads/${id}`);
      const leadData = await leadResponse.json();
      setLead(leadData);

      const interactionsResponse = await fetch(`${BACKEND_URL}/api/interactions/${id}`);
      const interactionsData = await interactionsResponse.json();
      setInteractions(interactionsData);
    } catch (error) {
      console.error('Error fetching lead data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchLeadData();
    }
  }, [id]);

  const handleCall = (mobile: string) => {
    Linking.openURL(`tel:${mobile}`);
  };

  const handleWhatsApp = (mobile: string) => {
    const cleanMobile = mobile.replace(/[^0-9]/g, '');
    Linking.openURL(`https://wa.me/91${cleanMobile}`);
  };

  const handleAddInteraction = async () => {
    if (!interactionDescription.trim()) {
      Alert.alert('Error', 'Please enter interaction description');
      return;
    }

    setAddingInteraction(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/interactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lead_id: id,
          type: interactionType,
          description: interactionDescription,
        }),
      });

      if (response.ok) {
        setInteractionDescription('');
        setShowAddInteraction(false);
        fetchLeadData();
        Alert.alert('Success', 'Interaction added successfully');
      }
    } catch (error) {
      console.error('Error adding interaction:', error);
      Alert.alert('Error', 'Failed to add interaction');
    } finally {
      setAddingInteraction(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New':
        return '#2196F3';
      case 'Contacted':
        return '#FF9800';
      case 'Interested':
        return '#4CAF50';
      case 'Proposal':
        return '#9C27B0';
      case 'Closed':
        return '#00796B';
      case 'Not Interested':
        return '#757575';
      default:
        return '#757575';
    }
  };

  const getInteractionIcon = (type: string) => {
    switch (type) {
      case 'Call':
        return 'phone';
      case 'WhatsApp':
        return 'whatsapp';
      case 'Meeting':
        return 'account-group';
      case 'Note':
        return 'note-text';
      default:
        return 'information';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#009688" />
      </View>
    );
  }

  if (!lead) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Lead not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="arrow-left"
          size={24}
          color="#FFFFFF"
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <Text variant="headlineMedium" style={styles.headerTitle}>
          Lead Details
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView}>
          <View style={styles.content}>
            {/* Lead Info Card */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="headlineSmall" style={styles.leadName}>
                  {lead.name}
                </Text>
                <Text variant="bodyLarge" style={styles.leadMobile}>
                  {lead.mobile}
                </Text>

                <View style={styles.chipContainer}>
                  <Chip
                    style={[styles.chip, { backgroundColor: getStatusColor(lead.status) }]}
                    textStyle={{ color: '#FFFFFF' }}
                  >
                    {lead.status}
                  </Chip>
                  <Chip style={styles.chip}>{lead.product}</Chip>
                  <Chip style={styles.chip}>{lead.source}</Chip>
                </View>

                {lead.city && (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="map-marker" size={20} color="#757575" />
                    <Text variant="bodyMedium" style={styles.infoText}>
                      {lead.city}
                    </Text>
                  </View>
                )}

                {lead.premium_amount > 0 && (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="currency-inr" size={20} color="#009688" />
                    <Text variant="bodyMedium" style={[styles.infoText, styles.premiumText]}>
                      ₹{lead.premium_amount.toLocaleString()}
                    </Text>
                  </View>
                )}

                {lead.expected_closing_month && (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="calendar" size={20} color="#757575" />
                    <Text variant="bodyMedium" style={styles.infoText}>
                      Expected: {lead.expected_closing_month}
                    </Text>
                  </View>
                )}

                {lead.next_followup_date && (
                  <View style={styles.infoRow}>
                    <MaterialCommunityIcons name="calendar-clock" size={20} color="#FF9800" />
                    <Text variant="bodyMedium" style={[styles.infoText, styles.followupText]}>
                      Next Follow-up: {lead.next_followup_date}
                    </Text>
                  </View>
                )}

                {lead.notes && (
                  <View style={styles.notesContainer}>
                    <Text variant="labelLarge" style={styles.notesLabel}>
                      Notes:
                    </Text>
                    <Text variant="bodyMedium" style={styles.notesText}>
                      {lead.notes}
                    </Text>
                  </View>
                )}

                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.callButton]}
                    onPress={() => handleCall(lead.mobile)}
                  >
                    <MaterialCommunityIcons name="phone" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>Call</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.whatsappButton]}
                    onPress={() => handleWhatsApp(lead.mobile)}
                  >
                    <MaterialCommunityIcons name="whatsapp" size={20} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>WhatsApp</Text>
                  </TouchableOpacity>
                </View>
              </Card.Content>
            </Card>

            {/* Add Interaction Section */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.sectionHeader}>
                  <Text variant="titleLarge" style={styles.sectionTitle}>
                    Add Interaction
                  </Text>
                </View>

                {!showAddInteraction ? (
                  <Button
                    mode="contained"
                    onPress={() => setShowAddInteraction(true)}
                    icon="plus"
                    buttonColor="#009688"
                  >
                    Add New Interaction
                  </Button>
                ) : (
                  <View>
                    <Text variant="labelLarge" style={styles.label}>
                      Interaction Type
                    </Text>
                    <SegmentedButtons
                      value={interactionType}
                      onValueChange={setInteractionType}
                      buttons={[
                        { value: 'Call', label: 'Call' },
                        { value: 'WhatsApp', label: 'WhatsApp' },
                        { value: 'Meeting', label: 'Meeting' },
                        { value: 'Note', label: 'Note' },
                      ]}
                      style={styles.segmented}
                    />

                    <TextInput
                      label="Description"
                      value={interactionDescription}
                      onChangeText={setInteractionDescription}
                      mode="outlined"
                      multiline
                      numberOfLines={3}
                      style={styles.input}
                      outlineColor="#009688"
                      activeOutlineColor="#009688"
                    />

                    <View style={styles.interactionButtons}>
                      <Button
                        mode="contained"
                        onPress={handleAddInteraction}
                        loading={addingInteraction}
                        disabled={addingInteraction}
                        style={styles.addButton}
                        buttonColor="#009688"
                      >
                        Add
                      </Button>
                      <Button
                        mode="outlined"
                        onPress={() => {
                          setShowAddInteraction(false);
                          setInteractionDescription('');
                        }}
                        style={styles.cancelInteractionButton}
                        textColor="#009688"
                      >
                        Cancel
                      </Button>
                    </View>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Interaction Timeline */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.sectionHeader}>
                  <Text variant="titleLarge" style={styles.sectionTitle}>
                    Interaction Timeline
                  </Text>
                  <Chip>{interactions.length}</Chip>
                </View>

                {interactions.length === 0 ? (
                  <View style={styles.emptyInteractions}>
                    <MaterialCommunityIcons name="timeline-text" size={48} color="#BDBDBD" />
                    <Text variant="bodyMedium" style={styles.emptyText}>
                      No interactions yet
                    </Text>
                  </View>
                ) : (
                  <View style={styles.timeline}>
                    {interactions.map((interaction, index) => (
                      <View key={interaction.id} style={styles.timelineItem}>
                        <View style={styles.timelineIconContainer}>
                          <View style={styles.timelineIcon}>
                            <MaterialCommunityIcons
                              name={getInteractionIcon(interaction.type)}
                              size={20}
                              color="#FFFFFF"
                            />
                          </View>
                          {index < interactions.length - 1 && <View style={styles.timelineLine} />}
                        </View>

                        <View style={styles.timelineContent}>
                          <View style={styles.timelineHeader}>
                            <Text variant="titleMedium" style={styles.interactionType}>
                              {interaction.type}
                            </Text>
                            <Text variant="bodySmall" style={styles.interactionDate}>
                              {format(new Date(interaction.created_at), 'MMM dd, yyyy HH:mm')}
                            </Text>
                          </View>
                          <Text variant="bodyMedium" style={styles.interactionDescription}>
                            {interaction.description}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </Card.Content>
            </Card>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#009688',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  leadName: {
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 4,
  },
  leadMobile: {
    color: '#757575',
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    height: 28,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    color: '#424242',
  },
  premiumText: {
    color: '#009688',
    fontWeight: 'bold',
  },
  followupText: {
    color: '#FF9800',
    fontWeight: 'bold',
  },
  notesContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  notesLabel: {
    color: '#000000',
    marginBottom: 8,
  },
  notesText: {
    color: '#424242',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  callButton: {
    backgroundColor: '#4CAF50',
  },
  whatsappButton: {
    backgroundColor: '#25D366',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontWeight: 'bold',
    color: '#000000',
  },
  label: {
    marginTop: 8,
    marginBottom: 12,
    color: '#000000',
  },
  segmented: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
  },
  interactionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    flex: 1,
  },
  cancelInteractionButton: {
    flex: 1,
  },
  emptyInteractions: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    color: '#BDBDBD',
    marginTop: 8,
  },
  timeline: {
    marginTop: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#009688',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E0E0E0',
    marginTop: 8,
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  interactionType: {
    fontWeight: 'bold',
    color: '#000000',
  },
  interactionDate: {
    color: '#757575',
  },
  interactionDescription: {
    color: '#424242',
    lineHeight: 20,
  },
});
