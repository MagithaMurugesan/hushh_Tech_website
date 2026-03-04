/**
 * Step 2 — All Business Logic
 * Referral source selection, Supabase upsert
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../../resources/config/config';
import { upsertOnboardingData } from '../../../services/onboarding/upsertOnboardingData';
import type { ReferralSource } from '../../../types/onboarding';
import { useFooterVisibility } from '../../../utils/useFooterVisibility';

export const CURRENT_STEP = 2;
export const TOTAL_STEPS = 12;
export const PROGRESS_PCT = Math.round((CURRENT_STEP / TOTAL_STEPS) * 100);

export interface ReferralOption {
  value: ReferralSource; label: string; icon: string; iconBg: string; iconColor: string;
}

export const REFERRAL_OPTIONS: ReferralOption[] = [
  { value: 'social_media_ad', label: 'Social Media', icon: 'smartphone', iconBg: 'bg-blue-100', iconColor: 'text-[#007AFF]' },
  { value: 'family_friend', label: 'Friend or Family', icon: 'group', iconBg: 'bg-green-100', iconColor: 'text-green-600' },
  { value: 'podcast', label: 'Podcast', icon: 'mic', iconBg: 'bg-purple-100', iconColor: 'text-purple-600' },
  { value: 'website_blog_article', label: 'News Article', icon: 'article', iconBg: 'bg-gray-100', iconColor: 'text-gray-600' },
  { value: 'ai_tool', label: 'Google Search', icon: 'search', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600' },
  { value: 'other', label: 'Other', icon: 'add', iconBg: 'bg-gray-100', iconColor: 'text-gray-600' },
];

export interface Step2Logic {
  selectedSource: ReferralSource | null;
  isLoading: boolean;
  isFooterVisible: boolean;
  setSelectedSource: (s: ReferralSource) => void;
  handleContinue: () => Promise<void>;
  handleSkip: () => Promise<void>;
  handleBack: () => void;
}

export const useStep2Logic = (): Step2Logic => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<ReferralSource | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isFooterVisible = useFooterVisibility();

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    const getCurrentUser = async () => {
      if (!config.supabaseClient) return;
      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) { navigate('/login'); return; }
      setUserId(user.id);
      const { data } = await config.supabaseClient.from('onboarding_data').select('referral_source').eq('user_id', user.id).maybeSingle();
      if (data?.referral_source) setSelectedSource(data.referral_source as ReferralSource);
    };
    getCurrentUser();
  }, [navigate]);

  const handleContinue = async () => {
    if (!userId || !config.supabaseClient || !selectedSource) return;
    setIsLoading(true);
    try { await upsertOnboardingData(userId, { referral_source: selectedSource, current_step: 2 }); navigate('/onboarding/step-4'); }
    catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  };

  const handleSkip = async () => {
    if (userId) { try { await upsertOnboardingData(userId, { current_step: 2 }); } catch (e) { console.error('Error:', e); } }
    navigate('/onboarding/step-4');
  };

  const handleBack = () => navigate('/onboarding/step-1');

  return { selectedSource, isLoading, isFooterVisible, setSelectedSource, handleContinue, handleSkip, handleBack };
};
