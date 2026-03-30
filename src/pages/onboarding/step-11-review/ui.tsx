import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../../resources/config/config';
import HushhTechBackHeader from '../../../components/hushh-tech-back-header/HushhTechBackHeader';
import HushhTechCta, {
  HushhTechCtaVariant,
} from '../../../components/hushh-tech-cta/HushhTechCta';
import { getOnboardingDisplayMeta } from '../../../services/onboarding/flow';

interface ReviewSummary {
  legal_first_name: string | null;
  legal_last_name: string | null;
  phone_number: string | null;
  phone_country_code: string | null;
  citizenship_country: string | null;
  residence_country: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  address_country: string | null;
  class_a_units: number | null;
  class_b_units: number | null;
  class_c_units: number | null;
  initial_investment_amount: number | null;
  recurring_amount: number | null;
  recurring_frequency: string | null;
  recurring_day_of_month: number | null;
}

const DISPLAY_META = getOnboardingDisplayMeta('/onboarding/step-11');
const PROGRESS_PCT = Math.round((DISPLAY_META.displayStep / DISPLAY_META.totalSteps) * 100);

const formatCurrency = (amount: number | null | undefined) => {
  if (!amount) return 'Not set';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatRecurringSummary = (data: ReviewSummary) => {
  if (!data.recurring_amount) return 'No recurring investment configured';
  const frequency = (data.recurring_frequency || 'once_a_month').replace(/_/g, ' ');
  const day = data.recurring_day_of_month === 31 ? 'Last day' : `Day ${data.recurring_day_of_month || 1}`;
  return `${formatCurrency(data.recurring_amount)} • ${frequency} • ${day}`;
};

const joinParts = (parts: Array<string | null | undefined>, fallback = 'Not provided') => {
  const value = parts.map((part) => (part || '').trim()).filter(Boolean).join(', ');
  return value || fallback;
};

const SummaryRow = ({
  icon,
  label,
  value,
  editLabel,
  onEdit,
}: {
  icon: string;
  label: string;
  value: string;
  editLabel: string;
  onEdit: () => void;
}) => (
  <div className="py-5 border-b border-gray-200">
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-gray-700 text-lg" style={{ fontVariationSettings: "'wght' 400" }}>
          {icon}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-gray-900 block mb-1">{label}</span>
        <span className="text-sm text-gray-600 font-medium leading-relaxed">{value}</span>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="text-xs font-semibold text-hushh-blue hover:underline shrink-0"
      >
        {editLabel}
      </button>
    </div>
  </div>
);

export default function OnboardingReviewStep() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.classList.add('onboarding-page-scroll');
    document.body.classList.add('onboarding-page-scroll');

    return () => {
      document.documentElement.classList.remove('onboarding-page-scroll');
      document.body.classList.remove('onboarding-page-scroll');
    };
  }, []);

  useEffect(() => {
    const loadSummary = async () => {
      if (!config.supabaseClient) {
        setError('Configuration error');
        setLoading(false);
        return;
      }

      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }

      const { data, error: fetchError } = await config.supabaseClient
        .from('onboarding_data')
        .select(`
          legal_first_name, legal_last_name,
          phone_number, phone_country_code,
          citizenship_country, residence_country,
          address_line_1, address_line_2, city, state, zip_code, address_country,
          class_a_units, class_b_units, class_c_units,
          initial_investment_amount,
          recurring_amount, recurring_frequency, recurring_day_of_month
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        setError('Failed to load your onboarding summary');
        setLoading(false);
        return;
      }

      setSummary((data || null) as ReviewSummary | null);
      setLoading(false);
    };

    loadSummary();
  }, [navigate]);

  const fullName = joinParts([
    summary?.legal_first_name,
    summary?.legal_last_name,
  ]);

  const phone = joinParts([
    summary?.phone_country_code,
    summary?.phone_number,
  ]);

  const residence = joinParts([
    summary?.residence_country,
    summary?.citizenship_country ? `Citizen of ${summary.citizenship_country}` : null,
  ]);

  const address = joinParts([
    summary?.address_line_1,
    summary?.address_line_2,
    summary?.city,
    summary?.state,
    summary?.zip_code,
    summary?.address_country,
  ]);

  const shareUnits = [
    summary?.class_a_units ? `${summary.class_a_units} Class A` : null,
    summary?.class_b_units ? `${summary.class_b_units} Class B` : null,
    summary?.class_c_units ? `${summary.class_c_units} Class C` : null,
  ].filter(Boolean).join(' • ') || 'No share units selected';

  return (
    <div className="bg-white text-gray-900 min-h-screen antialiased flex flex-col selection:bg-hushh-blue selection:text-white">
      <HushhTechBackHeader onBackClick={() => navigate('/onboarding/step-10')} rightLabel="FAQs" />

      <main className="px-6 flex-grow max-w-md mx-auto w-full pb-48">
        <div className="py-4">
          <div className="flex justify-between text-[11px] font-semibold tracking-wide text-gray-500 mb-3">
            <span>Step {DISPLAY_META.displayStep}/{DISPLAY_META.totalSteps}</span>
            <span>{PROGRESS_PCT}% Complete</span>
          </div>
          <div className="h-0.5 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-hushh-blue transition-all duration-500" style={{ width: `${PROGRESS_PCT}%` }} />
          </div>
        </div>

        <section className="py-8">
          <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase mb-4 font-medium">Review</h3>
          <h1
            className="text-[2.75rem] leading-[1.1] font-normal text-black tracking-tight font-serif"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Confirm Your
            <br />
            <span className="text-gray-400 italic font-light">Details</span>
          </h1>
          <p className="text-sm text-gray-500 mt-4 leading-relaxed font-light">
            We already filled what we could. Review the details once and continue to bank details.
          </p>
        </section>

        {loading && (
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-20 bg-gray-100 rounded-xl border border-gray-200" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="mb-6 flex items-center gap-3 py-4 px-1 border-b border-red-100">
            <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-red-500 text-lg" style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>
                error
              </span>
            </div>
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && (
          <>
            <section className="space-y-0 mb-8">
              <div className="py-4">
                <h3 className="text-[10px] tracking-[0.2em] text-gray-400 uppercase font-medium">KYC Summary</h3>
              </div>

              <SummaryRow
                icon="badge"
                label="Legal Name"
                value={fullName}
                editLabel="Edit"
                onEdit={() => navigate('/onboarding/step-7')}
              />
              <SummaryRow
                icon="call"
                label="Phone Number"
                value={phone}
                editLabel="Edit"
                onEdit={() => navigate('/onboarding/step-5')}
              />
              <SummaryRow
                icon="public"
                label="Citizenship & Residence"
                value={residence}
                editLabel="Edit"
                onEdit={() => navigate('/onboarding/step-4')}
              />
              <SummaryRow
                icon="home_pin"
                label="Address"
                value={address}
                editLabel="Edit"
                onEdit={() => navigate('/onboarding/step-8')}
              />
              <SummaryRow
                icon="monitoring"
                label="Investment"
                value={`${formatCurrency(summary?.initial_investment_amount)} • ${shareUnits} • ${formatRecurringSummary(summary || {} as ReviewSummary)}`}
                editLabel="Edit"
                onEdit={() => navigate('/onboarding/step-10')}
              />
            </section>

            <section className="pb-12 space-y-3">
              <HushhTechCta
                variant={HushhTechCtaVariant.BLACK}
                onClick={() => navigate('/onboarding/step-12')}
              >
                Continue to Bank Details
              </HushhTechCta>
              <HushhTechCta
                variant={HushhTechCtaVariant.WHITE}
                onClick={() => navigate('/onboarding/step-10')}
              >
                Back to Investment Summary
              </HushhTechCta>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
