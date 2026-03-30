import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import config from '../../../resources/config/config';
import { useFooterVisibility } from '../../../utils/useFooterVisibility';

// Types
export interface TimeSlot { startTime: string; endTime: string; available: boolean; }
export interface DayAvailability { date: string; slots: TimeSlot[]; }
export interface CalendarData { ceo: { name: string; email: string }; timezone: string; meetingDuration: number; availability: DayAvailability[]; }
export type PaymentState = 'loading' | 'not_paid' | 'verifying' | 'paid' | 'booked';
export const VALID_COUPON = 'ILOVEHUSHH';

export function useMeetCeoLogic() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [paymentState, setPaymentState] = useState<PaymentState>('loading');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hushhCoins, setHushhCoins] = useState(0);
  const isFooterVisible = useFooterVisibility();

  // Coupon state
  const [showCoupon, setShowCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);

  // Calendar state
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookingInProgress, setBookingInProgress] = useState(false);

  useEffect(() => { window.scrollTo({ top: 0 }); }, []);
  useEffect(() => { checkPaymentStatus(); }, []);

  // Handle Stripe callback
  useEffect(() => {
    const payment = searchParams.get('payment');
    const sessionId = searchParams.get('session_id');
    if (payment === 'success' && sessionId) verifyPayment(sessionId);
    else if (payment === 'cancel') { setError('Payment cancelled. Try again.'); setPaymentState('not_paid'); }
  }, [searchParams]);

  // Fetch calendar when paid
  useEffect(() => { if (paymentState === 'paid') fetchCalendarSlots(); }, [paymentState]);

  /* ── Send Hushh Coins credit email (fire-and-forget) ── */
  const sendCoinsEmail = async (email: string, name: string, coins: number) => {
    try {
      const { data: { session } } = await config.supabaseClient!.auth.getSession();
      if (!session) return;
      await fetch(`${config.SUPABASE_URL}/functions/v1/coins-credit-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ recipientEmail: email, recipientName: name, coinsAwarded: coins }),
      });
    } catch (err) { console.error('Coins email failed (non-blocking):', err); }
  };

  /* ── Send Hushh Coins deduction email when meeting is booked (fire-and-forget) ── */
  const sendCoinsDeductionEmail = async (email: string, name: string, coins: number, meetingDate: string, meetingTime: string) => {
    try {
      const { data: { session } } = await config.supabaseClient!.auth.getSession();
      if (!session) return;
      await fetch(`${config.SUPABASE_URL}/functions/v1/coins-deduction-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ recipientEmail: email, recipientName: name, coinsDeducted: coins, meetingDate, meetingTime }),
      });
    } catch (err) { console.error('Deduction email failed (non-blocking):', err); }
  };

  /* ── API Handlers ── */

  const checkPaymentStatus = async () => {
    if (!config.supabaseClient) { setPaymentState('not_paid'); return; }
    try {
      const { data: { user } } = await config.supabaseClient.auth.getUser();
      if (!user) { navigate('/login'); return; }
      const { data: payment } = await config.supabaseClient
        .from('ceo_meeting_payments').select('*').eq('user_id', user.id).maybeSingle();
      if (payment?.payment_status === 'completed') {
        setHushhCoins(payment.hushh_coins_awarded || 300000);
        setPaymentState(payment.calendly_booked ? 'booked' : 'paid');
      } else { setPaymentState('not_paid'); }
    } catch { setPaymentState('not_paid'); }
  };

  const verifyPayment = async (sessionId: string) => {
    setPaymentState('verifying'); setError(null);
    try {
      const { data: { session } } = await config.supabaseClient!.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${config.SUPABASE_URL}/functions/v1/onboarding-verify-payment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ sessionId }),
      });
      const result = await res.json();
      if (result.success) {
        const coins = result.hushhCoinsAwarded || 300000;
        setHushhCoins(coins);
        setPaymentState('paid');
        window.history.replaceState({}, '', '/onboarding/meet-ceo');
        // Send coins credit email after Stripe payment
        const { data: { user } } = await config.supabaseClient!.auth.getUser();
        if (user) sendCoinsEmail(user.email || '', user.user_metadata?.full_name || 'Hushh User', coins);
      } else throw new Error(result.error || 'Verification failed');
    } catch (err: any) { setError(err.message); setPaymentState('not_paid'); }
  };

  const handlePayment = async () => {
    setLoading(true); setError(null);
    try {
      const { data: { session } } = await config.supabaseClient!.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${config.SUPABASE_URL}/functions/v1/onboarding-create-checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({}),
      });
      const result = await res.json();
      if (result.alreadyPaid) { setPaymentState('paid'); return; }
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
      else throw new Error(result.error || 'Checkout failed');
    } catch (err: any) { setError(err.message); setLoading(false); }
  };

  const handleCouponRedeem = async () => {
    setCouponError(null);
    const code = couponCode.trim().toUpperCase();
    if (!code) { setCouponError('Please enter a coupon code.'); return; }
    if (code !== VALID_COUPON) { setCouponError('Invalid coupon code. Please try again.'); return; }
    setCouponLoading(true);
    try {
      const { data: { user } } = await config.supabaseClient!.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      // Upsert payment record with coupon
      await config.supabaseClient!.from('ceo_meeting_payments').upsert({
        user_id: user.id, payment_status: 'completed', payment_method: 'coupon',
        coupon_code: code, hushh_coins_awarded: 300000, amount: 0, currency: 'usd',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      setHushhCoins(300000);
      setPaymentState('paid');
      // Send coins credit email notification
      sendCoinsEmail(user.email || '', user.user_metadata?.full_name || 'Hushh User', 300000);
    } catch (err: any) { setCouponError(err.message || 'Failed to redeem coupon'); }
    finally { setCouponLoading(false); }
  };

  const fetchCalendarSlots = async () => {
    setLoadingSlots(true);
    try {
      const { data: { session } } = await config.supabaseClient!.auth.getSession();
      if (!session) { setLoadingSlots(false); return; }
      const res = await fetch(`${config.SUPABASE_URL}/functions/v1/ceo-calendar-booking?days=14`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (data.success) { setCalendarData(data); if (data.availability?.length) setSelectedDate(data.availability[0].date); }
    } catch (err) { console.error('Calendar fetch error:', err); }
    finally { setLoadingSlots(false); }
  };

  const handleBookMeeting = async () => {
    if (!selectedSlot) return;
    setBookingInProgress(true); setError(null);
    try {
      const { data: { session } } = await config.supabaseClient!.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const { data: { user } } = await config.supabaseClient!.auth.getUser();
      const res = await fetch(`${config.SUPABASE_URL}/functions/v1/ceo-calendar-booking`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ startTime: selectedSlot.startTime, endTime: selectedSlot.endTime, attendeeName: user?.user_metadata?.full_name || 'Hushh User' }),
      });
      const result = await res.json();
      if (result.success) {
        setPaymentState('booked');
        // Send coins deduction email after successful booking
        const meetingDate = new Date(selectedSlot.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
        const meetingTime = `${new Date(selectedSlot.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} – ${new Date(selectedSlot.endTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
        sendCoinsDeductionEmail(user?.email || '', user?.user_metadata?.full_name || 'Hushh User', 300000, meetingDate, meetingTime);
      } else throw new Error(result.error || 'Booking failed');
    } catch (err: any) { setError(err.message); }
    finally { setBookingInProgress(false); }
  };

  const handleContinue = () => navigate('/hushh-user-profile');
  const handleBack = () => navigate('/onboarding/step-12');

  return {
    paymentState,
    loading,
    error,
    hushhCoins,
    isFooterVisible,
    // Coupon
    showCoupon,
    setShowCoupon,
    couponCode,
    setCouponCode,
    couponError,
    setCouponError,
    couponLoading,
    // Calendar
    calendarData,
    loadingSlots,
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    bookingInProgress,
    // Handlers
    handlePayment,
    handleCouponRedeem,
    handleBookMeeting,
    handleContinue,
    handleBack,
  };
}
