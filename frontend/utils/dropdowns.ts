import AsyncStorage from '@react-native-async-storage/async-storage';

export const DROPDOWNS_KEY = 'custom_dropdowns';

export const DEFAULT_PRODUCTS = [
  'Whole Life', 'Child Plan', 'Retirement Plan', 'Kanyadaan Plan',
  'Health Plan', 'Motor Protection', 'Travel Plan', 'Home Protection',
  'Corporate Plan', 'ULIP', 'Endowment', 'SIP', 'Mutual Fund',
  'General', 'Others',
];

export const DEFAULT_STATUSES = [
  'New', 'Interested', 'Not Interested', 'Follow-up', 'Pipeline', 'Closed',
];

export const DEFAULT_SOURCES = [
  'Facebook Ads', 'Instagram', 'Google Ads', 'Referral', 'Existing Client',
  'Website Form', 'Walk-in', 'WhatsApp Enquiry', 'Other',
];

export const DEFAULT_FOLLOWUP_TYPES = [
  'WhatsApp', 'Call', 'Meeting', 'Video Call', 'Message', 'Email', 'Visit',
];

export interface CustomDropdowns {
  products:     string[];
  statuses:     string[];
  sources:      string[];
  followupTypes: string[];
}

export const loadDropdowns = async (): Promise<CustomDropdowns> => {
  try {
    const stored = await AsyncStorage.getItem(DROPDOWNS_KEY);
    if (!stored) return {
      products: DEFAULT_PRODUCTS, statuses: DEFAULT_STATUSES,
      sources: DEFAULT_SOURCES, followupTypes: DEFAULT_FOLLOWUP_TYPES,
    };
    const c: Partial<CustomDropdowns> = JSON.parse(stored);
    return {
      products:     c.products?.length     ? c.products     : DEFAULT_PRODUCTS,
      statuses:     c.statuses?.length     ? c.statuses     : DEFAULT_STATUSES,
      sources:      c.sources?.length      ? c.sources      : DEFAULT_SOURCES,
      followupTypes: c.followupTypes?.length ? c.followupTypes : DEFAULT_FOLLOWUP_TYPES,
    };
  } catch {
    return {
      products: DEFAULT_PRODUCTS, statuses: DEFAULT_STATUSES,
      sources: DEFAULT_SOURCES, followupTypes: DEFAULT_FOLLOWUP_TYPES,
    };
  }
};

export const saveDropdowns = async (dd: CustomDropdowns): Promise<void> => {
  await AsyncStorage.setItem(DROPDOWNS_KEY, JSON.stringify(dd));
};
