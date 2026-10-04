'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Database,
  Shield,
  Layers,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Heart,
  Ticket,
  Clock,
  Download,
  Check,
  X,
  Eye,
  Sliders,
  AlertCircle,
  Building2,
  Users,
  Award,
  Flame,
  Calendar,
  ChevronRight,
  HelpCircle,
  Server,
  FileText,
  ExternalLink,
  CalendarDays,
  BarChart3,
  Mail,
  Send,
  Filter,
  Link as LinkIcon,
  Save,
  Lock,
  LogOut,
  KeyRound,
  EyeOff,
  UserCheck,
  ShieldCheck
} from 'lucide-react';
import { DashboardStats, ImportBatch, EventRecord, PreImportAnalysis, EventId, DayWiseStat, HourlyStat, VolunteerStat, DivisionStats, SystemSettings } from '@/lib/types';

const ALL_HOURS_META = Array.from({ length: 24 }, (_, h) => {
  const startPeriod = h >= 12 ? 'PM' : 'AM';
  const startH12 = h % 12 === 0 ? 12 : h % 12;
  const startStr = `${String(startH12).padStart(2, '0')}:00 ${startPeriod}`;
  const startShort = `${String(startH12).padStart(2, '0')} ${startPeriod}`;

  const nextH = (h + 1) % 24;
  const nextPeriod = nextH >= 12 ? 'PM' : 'AM';
  const nextH12 = nextH % 12 === 0 ? 12 : nextH % 12;
  const nextStr = `${String(nextH12).padStart(2, '0')}:00 ${nextPeriod}`;

  return {
    hour: h,
    key: String(h),
    hourLabel: startShort,
    hourDisplay: `${startStr} - ${nextStr}`,
    isoHour: String(h).padStart(2, '0'),
  };
});

interface EventMeta {
  id: 'garba_groove' | 'navratri_utsav';
  name: string;
  subname: string;
  tagline: string;
  color: string;
  accentBg: string;
  borderColor: string;
  badge: string;
  icon: string;
}

const EVENTS_META: Record<'garba_groove' | 'navratri_utsav', EventMeta> = {
  garba_groove: {
    id: 'garba_groove',
    name: 'Garba Groove 2026',
    subname: 'Youth & Family Dandiya Night',
    tagline: 'High-energy rhythmic Garba & Dandiya celebration with live orchestra',
    color: 'from-amber-500 via-orange-500 to-rose-600',
    accentBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    borderColor: 'border-amber-500/40 hover:border-amber-400',
    badge: '🌟 Garba Groove',
    icon: '✨',
  },
  navratri_utsav: {
    id: 'navratri_utsav',
    name: 'Navratri Utsav 2026',
    subname: 'Grand Divine Mahotsav',
    tagline: 'Traditional 9-night spiritual devotion, cultural garba & community seva',
    color: 'from-purple-600 via-pink-600 to-amber-500',
    accentBg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    borderColor: 'border-purple-500/40 hover:border-purple-400',
    badge: '🪔 Navratri Utsav',
    icon: '🪔',
  },
};

export default function Home() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isDataCached, setIsDataCached] = useState<boolean>(false);
  const [cacheAgeSeconds, setCacheAgeSeconds] = useState<number>(0);

  // Event Scope State
  const [selectedEvent, setSelectedEvent] = useState<EventId | null>('garba_groove');
  const [showEventHub, setShowEventHub] = useState<boolean>(false);

  // Navigation & Role State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'divisions' | 'upload' | 'history' | 'passes' | 'donations' | 'system'>('dashboard');

  // Stats & Core Data
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isSupabase, setIsSupabase] = useState<boolean>(false);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [passes, setPasses] = useState<EventRecord[]>([]);
  const [donations, setDonations] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Search & Filter State
  const [passSearch, setPassSearch] = useState<string>('');
  const [passDivisionFilter, setPassDivisionFilter] = useState<string>('all');
  const [donationSearch, setDonationSearch] = useState<string>('');
  const [divisionSearch, setDivisionSearch] = useState<string>('');
  const [divisionSortBy, setDivisionSortBy] = useState<'passes' | 'donations' | 'total'>('passes');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [selectedHourFilter, setSelectedHourFilter] = useState<string>('all');
  const [divisionViewMode, setDivisionViewMode] = useState<'cards' | 'l1_volunteers' | 'daywise_timeline'>('cards');
  const [expandedDivisionVolunteers, setExpandedDivisionVolunteers] = useState<string | null>(null);
  const [volunteerSearch, setVolunteerSearch] = useState<string>('');
  const [volunteerDivisionFilter, setVolunteerDivisionFilter] = useState<string>('all');

  // Upload Flow State
  const [uploadTargetEvent, setUploadTargetEvent] = useState<'garba_groove' | 'navratri_utsav'>('garba_groove');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<PreImportAnalysis | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [importSuccess, setImportSuccess] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<{ batch: ImportBatch; syncResult: unknown } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email sending and dispatch hub state
  const [passEmailFilter, setPassEmailFilter] = useState<'all' | 'pending' | 'sent' | 'failed'>('all');
  const [selectedPassIds, setSelectedPassIds] = useState<Set<string>>(new Set());
  const [emailSending, setEmailSending] = useState<boolean>(false);
  const [emailResults, setEmailResults] = useState<Map<string, { status: string; error?: string }>>(new Map());
  const [dispatchProgress, setDispatchProgress] = useState<{ current: number; total: number; sent: number; failed: number } | null>(null);

  // Email Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState<boolean>(false);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewEventTarget, setPreviewEventTarget] = useState<'garba_groove' | 'navratri_utsav'>('garba_groove');
  const [previewSelectedOrder, setPreviewSelectedOrder] = useState<string | null>(null);

  // Email selection handlers
  const handleSelectPass = (orderId: string) => {
    setSelectedPassIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const exportL1VolunteersCSV = (volunteersToExport?: VolunteerStat[]) => {
    const allL1 = (stats?.divisionStats || []).flatMap((div) => div.allVolunteers || []);
    let volunteers = volunteersToExport;

    if (!volunteers) {
      volunteers = allL1.filter((vol) => {
        const matchesSearch =
          !volunteerSearch ||
          vol.name.toLowerCase().includes(volunteerSearch.toLowerCase()) ||
          vol.l2.toLowerCase().includes(volunteerSearch.toLowerCase()) ||
          vol.division.toLowerCase().includes(volunteerSearch.toLowerCase());
        const matchesDiv =
          volunteerDivisionFilter === 'all' ||
          vol.division.toLowerCase() === volunteerDivisionFilter.toLowerCase();
        return matchesSearch && matchesDiv;
      });
    }

    if (volunteers.length === 0) return;

    const headers = [
      'Rank',
      'L1 Volunteer (Referred)',
      'Division',
      'L2 Leader',
      'Passes Sold',
      'Pass Txns',
      'Donations (INR)',
      'Donation Txns',
      'Total Txns',
    ];
    const rows = volunteers.map((v, idx) => [
      idx + 1,
      `"${(v.name || '').replace(/"/g, '""')}"`,
      `"${(v.division || '').replace(/"/g, '""')}"`,
      `"${(v.l2 || '').replace(/"/g, '""')}"`,
      v.passes,
      v.passTransactions,
      v.donations,
      v.donationTransactions,
      v.totalTransactions,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    const divTag = volunteerDivisionFilter && volunteerDivisionFilter !== 'all' ? `_${volunteerDivisionFilter.replace(/[^a-zA-Z0-9_-]/g, '_')}` : '';
    link.setAttribute(
      'download',
      `L1_Volunteers_Report_${selectedEvent || 'all'}${divTag}_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Email Preview Modal
  const handleOpenEmailPreview = async (orderId?: string, targetEvent?: 'garba_groove' | 'navratri_utsav') => {
    const ev = targetEvent || (selectedEvent === 'navratri_utsav' ? 'navratri_utsav' : 'garba_groove');
    setPreviewEventTarget(ev);
    setPreviewSelectedOrder(orderId || null);
    setPreviewModalOpen(true);
    setPreviewLoading(true);

    try {
      const url = orderId
        ? `/api/email/preview?orderId=${encodeURIComponent(orderId)}&eventId=${ev}`
        : `/api/email/preview?eventId=${ev}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.html) {
        setPreviewHtml(data.html);
      } else {
        setPreviewHtml(`<div style="color: #f87171; padding: 24px; font-family: sans-serif;">Failed to load preview: ${data.error || 'Unknown error'}</div>`);
      }
    } catch (err) {
      setPreviewHtml(`<div style="color: #f87171; padding: 24px; font-family: sans-serif;">Error fetching preview: ${err instanceof Error ? err.message : String(err)}</div>`);
    } finally {
      setPreviewLoading(false);
    }
  };

  // Batch Email Dispatcher with live chunking & progress updates
  const handleSendEmails = async (orderIds: string[]) => {
    if (orderIds.length === 0) return;

    type EmailDispatchResult = { orderId: string; status: string; error?: string };

    setEmailSending(true);
    const targetEvent = selectedEvent === 'navratri_utsav' ? 'navratri_utsav' : 'garba_groove';
    setDispatchProgress({ current: 0, total: orderIds.length, sent: 0, failed: 0 });

    const chunkSize = 20;
    let totalSent = 0;
    let totalFailed = 0;

    for (let i = 0; i < orderIds.length; i += chunkSize) {
      const chunk = orderIds.slice(i, i + chunkSize);

      try {
        const res = await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds: chunk, eventId: targetEvent }),
        });

        const data = await res.json();

        if (data.success && data.results) {
          (data.results as EmailDispatchResult[]).forEach((r) => {
            if (r.status === 'Sent') {
              totalSent++;
            } else {
              totalFailed++;
            }
          });

          setEmailResults((prev) => {
            const next = new Map(prev);
            (data.results as EmailDispatchResult[]).forEach((r) => {
              next.set(r.orderId, { status: r.status, error: r.error });
            });
            return next;
          });

          // Deselect successfully sent items
          setSelectedPassIds((prev) => {
            const next = new Set(prev);
            (data.results as EmailDispatchResult[]).forEach((r) => {
              if (r.status === 'Sent') next.delete(r.orderId);
            });
            return next;
          });
        } else {
          totalFailed += chunk.length;
        }
      } catch {
        totalFailed += chunk.length;
      }

      setDispatchProgress({
        current: Math.min(i + chunkSize, orderIds.length),
        total: orderIds.length,
        sent: totalSent,
        failed: totalFailed,
      });
    }

    // Refresh passes after dispatch to sync state from database
    await fetchPasses(passSearch, passDivisionFilter, selectedEvent, selectedDateFilter, selectedHourFilter);
    setEmailSending(false);
  };

  // System Backend Info State
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    storageMode: 'auto',
    googleSheetsMode: 'mock',
    googleSpreadsheetId: '',
    garbaGrooveSpreadsheetId: '',
    navratriUtsavSpreadsheetId: '',
    navratriPassBgUrl: 'https://res.cloudinary.com/dhrj3rpg8/image/upload/v1789971984/EVENT_PASS.png',
    acceptedPaymentStatuses: ['captured', 'paid', 'success', 'successful', 'completed'],
    passKeywords: ['pass', 'ticket', 'entry', 'single', 'couple', 'vip', 'garba', 'dandiya'],
    donationKeywords: ['donation', 'donate', 'daan', 'seva', 'contribut', 'sponsorship', 'support'],
  });

  // Auth Check
  const checkAuth = useCallback(async () => {
    try {
      setAuthLoading(true);
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      if (res.ok && data.authenticated) {
        setIsAuthenticated(true);
        setUserEmail(data.user?.email || '');
      } else {
        setIsAuthenticated(false);
        setUserEmail('');
      }
    } catch {
      setIsAuthenticated(false);
      setUserEmail('');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  // Auth Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError('Please enter email and password.');
      return;
    }
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsAuthenticated(true);
        setUserEmail(data.user?.email || loginEmail);
        setLoginEmail('');
        setLoginPassword('');
        setLoginError(null);
        void refreshAll(selectedEvent, true);
      } else {
        setLoginError(data.error || 'Invalid credentials');
      }
    } catch {
      setLoginError('Network connection error. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsAuthenticated(false);
      setUserEmail('');
      setStats(null);
      setBatches([]);
      setPasses([]);
      setDonations([]);
    }
  };

  // Fetch Dashboard Stats & Batches for Active Event
  const fetchStats = useCallback(async (eventId?: EventId | null, forceRefresh = false) => {
    try {
      setRefreshing(true);
      const params = new URLSearchParams();
      if (eventId) params.set('eventId', eventId);
      if (forceRefresh) params.set('forceRefresh', 'true');
      const res = await fetch(`/api/stats?${params.toString()}`);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setIsSupabase(data.isSupabase);
        setIsDataCached(Boolean(data.isCached));
        setCacheAgeSeconds(data.cacheAgeSeconds || 0);
        if (data.settings) setSystemSettings(data.settings);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setRefreshing(false);
    }
  }, [setSystemSettings]);

  // Fetch Import History
  const fetchBatches = useCallback(async (eventId?: EventId | null) => {
    try {
      const evParam = eventId ? `?eventId=${eventId}` : '';
      const res = await fetch(`/api/history${evParam}`);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setBatches(data.batches || []);
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
    }
  }, []);

  // Fetch Passes (load all matching records for full selection)
  const fetchPasses = useCallback(async (search = '', division = 'all', eventId?: EventId | null, date = 'all', hour = 'all') => {
    try {
      const params = new URLSearchParams();
      params.set('type', 'PASS');
      if (search) params.set('search', search);
      if (division && division !== 'all') params.set('division', division);
      if (eventId && eventId !== 'all') params.set('eventId', eventId);
      if (date && date !== 'all') params.set('date', date);
      if (hour && hour !== 'all') params.set('hour', hour);
      params.set('limit', '5000');

      const res = await fetch(`/api/records?${params.toString()}`);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setPasses(data.records || []);
      }
    } catch (err) {
      console.error('Error fetching passes:', err);
    }
  }, []);

  // Fetch Donations (load all matching records)
  const fetchDonations = useCallback(async (search = '', eventId?: EventId | null, date = 'all', hour = 'all') => {
    try {
      const params = new URLSearchParams();
      params.set('type', 'DONATION');
      if (search) params.set('search', search);
      if (eventId && eventId !== 'all') params.set('eventId', eventId);
      if (date && date !== 'all') params.set('date', date);
      if (hour && hour !== 'all') params.set('hour', hour);
      params.set('limit', '5000');

      const res = await fetch(`/api/records?${params.toString()}`);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setDonations(data.records || []);
      }
    } catch (err) {
      console.error('Error fetching donations:', err);
    }
  }, []);

  // Refresh All for Event
  const refreshAll = useCallback(
    async (eventId: EventId | null, forceRefresh = false) => {
      setLoading(true);
      await Promise.all([
        fetchStats(eventId, forceRefresh),
        fetchBatches(eventId),
        fetchPasses(passSearch, passDivisionFilter, eventId, selectedDateFilter, selectedHourFilter),
        fetchDonations(donationSearch, eventId, selectedDateFilter, selectedHourFilter),
      ]);
      setLoading(false);
    },
    [fetchStats, fetchBatches, fetchPasses, fetchDonations, passSearch, passDivisionFilter, donationSearch, selectedDateFilter, selectedHourFilter]
  );

  useEffect(() => {
    if (isAuthenticated && selectedEvent) {
      void refreshAll(selectedEvent, false);
      if (selectedEvent !== 'all') {
        setUploadTargetEvent(selectedEvent as 'garba_groove' | 'navratri_utsav');
      }
    }
  }, [isAuthenticated, selectedEvent, refreshAll]);

  // When date or hour filter changes, re-query passes and donations
  useEffect(() => {
    if (isAuthenticated && selectedEvent) {
      void fetchPasses(passSearch, passDivisionFilter, selectedEvent, selectedDateFilter, selectedHourFilter);
      void fetchDonations(donationSearch, selectedEvent, selectedDateFilter, selectedHourFilter);
    }
  }, [isAuthenticated, selectedEvent, selectedDateFilter, selectedHourFilter, passSearch, passDivisionFilter, donationSearch, fetchPasses, fetchDonations]);

  // Stage 1: Analyze File on Select
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setUploadError(null);
    setAnalysis(null);
    setImportSuccess(false);
    setImportResult(null);
    setAnalyzing(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('eventId', uploadTargetEvent);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze file');
      }
      setAnalysis(data.analysis);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  // Stage 2: Confirm & Import
  const handleConfirmImport = async () => {
    if (!selectedFile) return;

    setImporting(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('eventId', uploadTargetEvent);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to import file');
      }

      setImportResult(data);
      setImportSuccess(true);
      await refreshAll(selectedEvent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setUploadError(msg);
    } finally {
      setImporting(false);
    }
  };

  const handleResetUpload = () => {
    setSelectedFile(null);
    setAnalysis(null);
    setImportSuccess(false);
    setImportResult(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filtered divisions list based on date & hour selection
  const activeDayStat = selectedDateFilter !== 'all'
    ? stats?.dayWiseStats?.find((d) => d.date === selectedDateFilter)
    : null;

  const activeHourlyList: HourlyStat[] = (activeDayStat ? activeDayStat.hourlyStats : stats?.hourlyStats) || [];

  const activeHourStat = selectedHourFilter !== 'all'
    ? activeHourlyList.find((h) => String(h.hour) === selectedHourFilter)
    : null;

  const rawDivisionList: DivisionStats[] = activeHourStat
    ? activeHourStat.divisionStats.map((d) => {
        const fullDiv = stats?.divisionStats?.find((s) => s.division === d.division);
        return {
          division: d.division,
          passTransactions: d.passTransactions,
          totalPasses: d.totalPasses,
          donationTransactions: d.donationTransactions,
          totalDonationAmount: d.totalDonationAmount,
          totalRevenue: d.totalRevenue,
          totalTransactions: d.totalTransactions,
          volunteersCount: fullDiv?.volunteersCount || 0,
          topVolunteers: fullDiv?.topVolunteers || [],
          allVolunteers: fullDiv?.allVolunteers || [],
          dayWiseTrend: fullDiv?.dayWiseTrend || [],
        };
      })
    : activeDayStat
    ? activeDayStat.divisionStats.map((d) => {
        const fullDiv = stats?.divisionStats?.find((s) => s.division === d.division);
        return {
          division: d.division,
          passTransactions: d.passTransactions,
          totalPasses: d.totalPasses,
          donationTransactions: d.donationTransactions,
          totalDonationAmount: d.totalDonationAmount,
          totalRevenue: d.totalRevenue,
          totalTransactions: d.totalTransactions,
          volunteersCount: fullDiv?.volunteersCount || 0,
          topVolunteers: fullDiv?.topVolunteers || [],
          allVolunteers: fullDiv?.allVolunteers || [],
          dayWiseTrend: fullDiv?.dayWiseTrend || [],
        };
      })
    : stats?.divisionStats || [];

  const filteredDivisions = rawDivisionList
    .filter((d) => d.division.toLowerCase().includes(divisionSearch.toLowerCase()))
    .sort((a, b) => {
      if (divisionSortBy === 'passes') return b.totalPasses - a.totalPasses;
      if (divisionSortBy === 'donations') return b.totalDonationAmount - a.totalDonationAmount;
      return b.totalTransactions - a.totalTransactions;
    });

  const maxPassesInDiv = Math.max(...(filteredDivisions.map((d) => d.totalPasses) || [1]), 1);

  // Available unique dates
  const availableDates = stats?.dayWiseStats || [];

  // Filtered totals for cards
  const displayTotalPasses = activeHourStat
    ? activeHourStat.totalPasses
    : activeDayStat
    ? activeDayStat.totalPasses
    : stats?.totalCapturedPasses || 0;

  const displayPassTransactions = activeHourStat
    ? activeHourStat.passTransactions
    : activeDayStat
    ? activeDayStat.passTransactions
    : stats?.passTransactions || 0;

  const displayTotalDonations = activeHourStat
    ? activeHourStat.totalDonationAmount
    : activeDayStat
    ? activeDayStat.totalDonationAmount
    : stats?.totalDonationAmount || 0;

  const displayDonationTransactions = activeHourStat
    ? activeHourStat.donationTransactions
    : activeDayStat
    ? activeDayStat.donationTransactions
    : stats?.capturedDonations || 0;

  const peakHour = activeHourlyList.reduce<HourlyStat | null>((max, curr) => {
    if (!max || curr.totalTransactions > max.totalTransactions) {
      return curr.totalTransactions > 0 ? curr : null;
    }
    return max;
  }, null);

  // AUTHENTICATION CHECKING LOADING SCREEN
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="text-center z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center shadow-xl shadow-amber-500/20 mx-auto mb-4 animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-rose-300 to-purple-300">
            SC Dandiya 2026
          </h2>
          <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" /> Verifying Auditor Session Security...
          </p>
        </div>
      </div>
    );
  }

  // AUDITOR LOGIN PORTAL (WHEN NOT AUTHENTICATED)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12 relative overflow-hidden">
        {/* Background glow ornaments */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header */}
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-rose-300 to-purple-300">
                SC Dandiya 2026
              </h1>
              <p className="text-xs text-slate-400 font-medium">Auditor General & Security Portal</p>
            </div>
          </div>

          <a
            href="/verify"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 text-xs font-semibold shadow-md transition"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>QR Scanner Portal</span>
            <ExternalLink className="w-3 h-3 text-slate-500" />
          </a>
        </div>

        {/* Center Login Box */}
        <div className="max-w-md mx-auto w-full my-auto py-10 z-10">
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-8 shadow-2xl shadow-amber-500/10 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4 text-amber-400 shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Auditor General Access
              </span>
              <h2 className="text-2xl font-extrabold text-white">Sign In to Dashboard</h2>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Authorized access required to view real-time statistics, pass sales, donations, division rankings, and import files.
              </p>
            </div>

            {loginError && (
              <div className="mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{loginError}</div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Auditor Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="auditorgeneral.streetcausehyd@gmail.com"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Auditor Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter security password"
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-slate-950 font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {loginLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Authorize & Enter Dashboard</span>
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-800 text-center">
              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Protected by HMAC Sessions, In-Memory Rate Limiting & 60s Cache</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-6xl mx-auto w-full text-center text-xs text-slate-500 z-10">
          SC Dandiya 2026 • Street Cause Auditor General System
        </div>
      </div>
    );
  }

  // EVENT SELECTION HUB MODAL / VIEW
  if (showEventHub || !selectedEvent) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 md:p-12 relative overflow-hidden">
        {/* Background glow ornaments */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Branding */}
        <div className="max-w-6xl mx-auto w-full flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-rose-300 to-purple-300">
                SC Dandiya 2026
              </h1>
              <p className="text-xs text-slate-400 font-medium">Event Data Automation & Capture Hub</p>
            </div>
          </div>
          {selectedEvent && (
            <button
              onClick={() => setShowEventHub(false)}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-2 transition"
            >
              Return to Current Event <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Main Event Selection Portal */}
        <div className="max-w-5xl mx-auto w-full my-auto py-8 z-10">
          <div className="text-center mb-10">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-3">
              <Sparkles className="w-3.5 h-3.5" /> Dual Event Management System
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
              Select Dandiya Event
            </h2>
            <p className="text-slate-400 text-base max-w-xl mx-auto">
              Choose an event to access dedicated ticket pass tracking, donation collections, day-wise metrics, division leaderboards, and automated Google Sheets sync.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Event 1: Garba Groove */}
            <div
              onClick={() => {
                setSelectedEvent('garba_groove');
                setShowEventHub(false);
              }}
              className="group relative bg-slate-900/90 hover:bg-slate-900 border border-amber-500/30 hover:border-amber-400/80 rounded-2xl p-7 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/20 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    🌟 Main Event
                  </span>
                  <span className="text-2xl">✨</span>
                </div>
                <h3 className="text-2xl font-bold text-white group-hover:text-amber-300 transition mb-1">
                  Garba Groove 2026
                </h3>
                <p className="text-xs font-semibold text-amber-400/90 mb-3">Youth & Family Dandiya Night</p>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Manage pass sales, entries, VIP passes, donor contributions, daily timelines, and division rankings for Garba Groove night.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-200">
                  Open Event Dashboard
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 group-hover:bg-amber-500 text-amber-300 group-hover:text-slate-950 flex items-center justify-center transition">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Event 2: Navratri Utsav */}
            <div
              onClick={() => {
                setSelectedEvent('navratri_utsav');
                setShowEventHub(false);
              }}
              className="group relative bg-slate-900/90 hover:bg-slate-900 border border-purple-500/30 hover:border-purple-400/80 rounded-2xl p-7 transition-all duration-300 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-1 cursor-pointer flex flex-col justify-between"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition" />
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                    🪔 Mahotsav
                  </span>
                  <span className="text-2xl">🪔</span>
                </div>
                <h3 className="text-2xl font-bold text-white group-hover:text-purple-300 transition mb-1">
                  Navratri Utsav 2026
                </h3>
                <p className="text-xs font-semibold text-purple-400/90 mb-3">Grand Divine Mahotsav</p>
                <p className="text-sm text-slate-400 leading-relaxed mb-6">
                  Track multi-day passes, traditional garba admissions, seva contributions, 80G tax donations, and daily volunteer performance.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-200">
                  Open Event Dashboard
                </span>
                <div className="w-9 h-9 rounded-xl bg-purple-500/20 group-hover:bg-purple-500 text-purple-300 group-hover:text-slate-950 flex items-center justify-center transition">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* Consolidated View Option */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setSelectedEvent('all');
                setShowEventHub(false);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              <Layers className="w-4 h-4 text-slate-400" /> View Consolidated Combined Metrics (Both Events)
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-6xl mx-auto w-full text-center text-xs text-slate-500 z-10">
          SC Dandiya 2026 • Automated Ingestion & Zapier Dispatch Pipeline
        </div>
      </div>
    );
  }

  const activeEventMeta =
    selectedEvent === 'navratri_utsav'
      ? EVENTS_META.navratri_utsav
      : selectedEvent === 'garba_groove'
      ? EVENTS_META.garba_groove
      : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Event Tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 flex items-center justify-center shadow-md shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-rose-300 to-purple-300">
                  SC Dandiya 2026
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  v1.2
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Event Data Automation & Google Sheets Pipeline
              </p>
            </div>
          </div>

          {/* Center: Event Switcher Pill */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setSelectedEvent('garba_groove')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                selectedEvent === 'garba_groove'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🌟 Garba Groove
            </button>
            <button
              onClick={() => setSelectedEvent('navratri_utsav')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                selectedEvent === 'navratri_utsav'
                  ? 'bg-purple-600 text-white shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              🪔 Navratri Utsav
            </button>
            <button
              onClick={() => setSelectedEvent('all')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedEvent === 'all'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="View All Combined"
            >
              🌐 All
            </button>
            <button
              onClick={() => setShowEventHub(true)}
              className="ml-1 px-2 py-1 text-slate-400 hover:text-amber-400 text-xs font-medium border-l border-slate-800 pl-2 transition"
              title="Open Event Hub"
            >
              Switch Hub
            </button>
          </div>

          {/* Right Actions: Backend Status & Refresh */}
          <div className="flex items-center gap-2.5">
            {/* Cache Age Indicator */}
            {isDataCached && (
              <div
                className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-900 border border-slate-800 text-amber-300/90"
                title={`Database data served from fast in-memory cache (${cacheAgeSeconds}s old). Click refresh to bust cache.`}
              >
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Cached ({cacheAgeSeconds}s)</span>
              </div>
            )}

            {/* Admin Verification Portal Button */}
            <a
              href="/verify"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white font-bold text-xs shadow-md shadow-amber-500/20 transition"
              title="Open Organizer QR Verification Login"
            >
              <Shield className="w-3.5 h-3.5 text-white" />
              <span className="hidden sm:inline">Admin QR Scan</span>
            </a>

            {/* Supabase Status Badge */}
            <div
              className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isSupabase
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isSupabase ? 'Supabase Active' : 'Local DB Active'}</span>
            </div>

            {/* Manual Refresh Button (Busts Cache) */}
            <button
              onClick={() => refreshAll(selectedEvent, true)}
              disabled={refreshing}
              className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition disabled:opacity-50"
              title="Refresh Data (Bypass Cache)"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
            </button>

            {/* Auditor Profile & Sign Out Button */}
            <div className="flex items-center gap-1.5 pl-1 border-l border-slate-800">
              <div
                className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold"
                title={`Logged in as ${userEmail || 'Auditor General'}`}
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate max-w-[130px]">{userEmail || 'Auditor'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Sub-Header */}
      <nav className="border-b border-slate-800/60 bg-slate-900/40 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center gap-1 overflow-x-auto py-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'dashboard'
                ? 'bg-slate-800 text-amber-400 border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Overview Dashboard
          </button>
          <button
            onClick={() => setActiveTab('divisions')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'divisions'
                ? 'bg-slate-800 text-amber-400 border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" /> Division & Day-Wise Stats
            {stats?.divisionStats && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-300 font-bold">
                {stats.divisionStats.length} divs
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'upload'
                ? 'bg-slate-800 text-amber-400 border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <UploadCloud className="w-4 h-4" /> Upload Excel
          </button>
          <button
            onClick={() => setActiveTab('passes')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'passes'
                ? 'bg-slate-800 text-amber-400 border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Ticket className="w-4 h-4" /> Pass Records
            {stats && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-400">
                {stats.totalCapturedPasses}
              </span>
            )}
          </button>
          <a
            href="/verify"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition shrink-0 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30"
          >
            <Shield className="w-4 h-4 text-amber-400" /> Admin Verification Login
          </a>
          <button
            onClick={() => setActiveTab('donations')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'donations'
                ? 'bg-slate-800 text-amber-400 border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Heart className="w-4 h-4" /> Donation Records
            {stats && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-800 text-slate-400">
                {stats.capturedDonations}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'history'
                ? 'bg-slate-800 text-amber-400 border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" /> Import History
          </button>
          <button
            onClick={() => setActiveTab('system')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
              activeTab === 'system'
                ? 'bg-slate-800 text-amber-400 border border-slate-700 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Server className="w-4 h-4" /> Backend Architecture
          </button>
        </div>
      </nav>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Event Banner */}
        {activeEventMeta && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900 border border-slate-800 p-5 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${activeEventMeta.accentBg}`}>
                    {activeEventMeta.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">• Active Event Filter</span>
                </div>
                <h2 className="text-xl font-bold text-white">{activeEventMeta.name}</h2>
                <p className="text-xs text-slate-400 mt-0.5">{activeEventMeta.tagline}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('upload')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-2 shadow-md shadow-amber-500/20"
                >
                  <UploadCloud className="w-3.5 h-3.5" /> Upload {activeEventMeta.name} Excel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 1. OVERVIEW DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Global Date & Hourly Filter Ribbon */}
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 mr-1">
                  <Filter className="w-3.5 h-3.5 text-amber-400" /> Filter Time Scope:
                </span>
                
                {/* Date Dropdown */}
                <select
                  value={selectedDateFilter}
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="all">📅 All Dates (Overall)</option>
                  {availableDates.map((day) => (
                    <option key={day.date} value={day.date}>
                      📅 {day.displayDate} ({day.totalPasses} passes)
                    </option>
                  ))}
                </select>

                {/* Hourly Filter Dropdown */}
                <select
                  value={selectedHourFilter}
                  onChange={(e) => setSelectedHourFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="all">⏰ All Hours (24 Hours)</option>
                  {ALL_HOURS_META.map((meta) => {
                    const hStat = activeHourlyList.find((h) => h.hour === meta.hour);
                    const txCount = hStat ? hStat.totalTransactions : 0;
                    return (
                      <option key={meta.key} value={meta.key}>
                        ⏰ {meta.hourDisplay} {txCount > 0 ? `(${txCount} txns)` : ''}
                      </option>
                    );
                  })}
                </select>

                {(selectedDateFilter !== 'all' || selectedHourFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSelectedDateFilter('all');
                      setSelectedHourFilter('all');
                    }}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Clear Filters
                  </button>
                )}
              </div>

              {/* Active Filter Pill */}
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {selectedDateFilter === 'all' && selectedHourFilter === 'all'
                    ? 'Displaying all-time metrics'
                    : `Filtered: ${selectedDateFilter !== 'all' ? activeDayStat?.displayDate : 'All Days'} • ${selectedHourFilter !== 'all' ? ALL_HOURS_META[Number(selectedHourFilter)]?.hourDisplay : '24h'}`}
                </span>
              </div>
            </div>

            {/* Realtime KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Passes */}
              <div className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-5 transition shadow-lg relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {selectedHourFilter !== 'all' || selectedDateFilter !== 'all' ? 'Filtered Passes Sold' : 'Total Passes Sold'}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                    <Ticket className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white tracking-tight">
                  {displayTotalPasses.toLocaleString()}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  from <span className="text-slate-200 font-bold">{displayPassTransactions}</span> captured transactions
                </p>
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-amber-400/90">
                  <span>Target Google Sheet: PASS</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>

              {/* Total Donation Amount */}
              <div className="bg-slate-900/90 border border-slate-800 hover:border-rose-500/40 rounded-2xl p-5 transition shadow-lg relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {selectedHourFilter !== 'all' || selectedDateFilter !== 'all' ? 'Filtered Donations' : 'Total Donations Collected'}
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                    <Heart className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white tracking-tight">
                  ₹{displayTotalDonations.toLocaleString()}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  from <span className="text-slate-200 font-bold">{displayDonationTransactions}</span> donor contributions
                </p>
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-rose-400/90">
                  <span>Target Google Sheet: DONATION</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>

              {/* Participating Divisions */}
              <div className="bg-slate-900/90 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-5 transition shadow-lg relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Active Divisions
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white tracking-tight">
                  {rawDivisionList.length}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  across <span className="text-purple-300 font-semibold">{stats?.dayWiseStats?.length || 0} active days</span>
                </p>
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-purple-400/90">
                  <button onClick={() => setActiveTab('divisions')} className="hover:underline flex items-center gap-1">
                    View Division Leaderboard <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Deduplication & Ingestion Batches */}
              <div className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 transition shadow-lg relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Total Ingested Rows
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-white tracking-tight">
                  {stats ? stats.totalCapturedRows.toLocaleString() : '0'}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  across <span className="text-slate-200 font-bold">{batches.length}</span> batch uploads
                </p>
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-400/90">
                  <span>per-table sorting active</span>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>
            </div>

            {/* 24-HOUR TRANSACTION VELOCITY & HOURLY BREAKDOWN */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" /> 24-Hour Velocity & Hourly Ingestion Breakdown
                  </h3>
                  <p className="text-xs text-slate-400">
                    Explore transaction activity for every hour of the day. Click any hour to filter the entire dashboard.
                  </p>
                </div>

                {peakHour && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span>Peak Hour: {peakHour.hourDisplay} ({peakHour.totalPasses} passes • ₹{peakHour.totalDonationAmount.toLocaleString()})</span>
                  </div>
                )}
              </div>

              {/* Hourly Matrix Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {ALL_HOURS_META.map((meta) => {
                  const hStat = activeHourlyList.find((h) => h.hour === meta.hour);
                  const passesSold = hStat?.totalPasses || 0;
                  const donationsAmt = hStat?.totalDonationAmount || 0;
                  const txCount = hStat?.totalTransactions || 0;
                  const isSelected = selectedHourFilter === meta.key;
                  const isPeak = peakHour && peakHour.hour === meta.hour && txCount > 0;

                  return (
                    <button
                      key={meta.key}
                      onClick={() => setSelectedHourFilter(isSelected ? 'all' : meta.key)}
                      className={`p-3 rounded-xl border text-left transition relative overflow-hidden flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-500/20 border-amber-400 shadow-md shadow-amber-500/20 ring-1 ring-amber-400'
                          : txCount > 0
                          ? 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          : 'bg-slate-950/40 border-slate-900 opacity-60 hover:opacity-100 hover:border-slate-800'
                      }`}
                    >
                      {isPeak && (
                        <div className="absolute top-1 right-1 text-[10px]" title="Peak velocity hour">
                          🔥
                        </div>
                      )}
                      <div>
                        <div className="text-[11px] font-bold text-slate-300 mb-1 flex items-center justify-between">
                          <span>{meta.hourLabel}</span>
                          {txCount > 0 && (
                            <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-800 text-amber-300">
                              {txCount} tx
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-extrabold text-white">
                          {passesSold} <span className="text-[10px] font-normal text-slate-400">passes</span>
                        </div>
                      </div>

                      {donationsAmt > 0 && (
                        <div className="text-[10px] font-semibold text-rose-400 mt-1">
                          +₹{donationsAmt.toLocaleString()}
                        </div>
                      )}

                      <div className="text-[9px] text-slate-500 mt-1">
                        {meta.hourDisplay.split(' - ')[0]}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Day-Wise Growth Snapshot & Top Divisions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Day-Wise Activity Timeline Snapshot */}
              <div className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-amber-400" /> Day-Wise Ingestion Timeline & Daily Breakdown
                    </h3>
                    <p className="text-xs text-slate-400">Day-by-day progression of pass collections and donations</p>
                  </div>
                  <button
                    onClick={() => {
                      setDivisionViewMode('daywise_timeline');
                      setActiveTab('divisions');
                    }}
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    View Details <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {stats?.dayWiseStats && stats.dayWiseStats.length > 0 ? (
                  <div className="space-y-3">
                    {stats.dayWiseStats.map((day) => (
                      <div
                        key={day.date}
                        className="bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              📅 {day.displayDate}
                            </span>
                            <span className="text-xs text-slate-400">
                              ({day.totalTransactions} transactions)
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs font-semibold">
                            <span className="text-amber-400">
                              <strong>{day.totalPasses}</strong> Passes
                            </span>
                            {day.totalDonationAmount > 0 && (
                              <span className="text-rose-400">
                                <strong>₹{day.totalDonationAmount.toLocaleString()}</strong> Donations
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Top divisions on that date */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-900 text-[11px] text-slate-400">
                          <span className="text-slate-500 font-medium">Top on {day.displayDate}:</span>
                          {day.divisionStats.slice(0, 4).map((d) => (
                            <span
                              key={d.division}
                              className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300"
                            >
                              {d.division} <strong className="text-amber-400 font-semibold">({d.totalPasses}p)</strong>
                            </span>
                          ))}
                          {day.divisionStats.length > 4 && (
                            <span className="text-[10px] text-slate-500">
                              +{day.divisionStats.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-slate-500 text-xs">
                    No date-stamped records found. Upload an Excel export with payment dates to view day-wise statistics.
                  </div>
                )}
              </div>

              {/* Top 5 Divisions Snapshot */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-400" /> Overall Top Divisions
                      </h3>
                      <p className="text-xs text-slate-400">All-time leaderboard</p>
                    </div>
                  </div>

                  {stats?.divisionStats && stats.divisionStats.length > 0 ? (
                    <div className="space-y-3">
                      {stats.divisionStats.slice(0, 5).map((div, idx) => (
                        <div key={div.division} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1.5 text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-5 h-5 rounded-md text-[10px] font-bold flex items-center justify-center ${
                                  idx === 0
                                    ? 'bg-amber-500 text-slate-950'
                                    : idx === 1
                                    ? 'bg-slate-400 text-slate-950'
                                    : idx === 2
                                    ? 'bg-amber-700 text-white'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                #{idx + 1}
                              </span>
                              <span className="font-bold text-slate-200">{div.division}</span>
                            </div>
                            <span className="text-amber-400 font-bold">{div.totalPasses} Passes</span>
                          </div>

                          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-amber-500 h-1.5 rounded-full"
                              style={{ width: `${Math.max((div.totalPasses / maxPassesInDiv) * 100, 4)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-500 text-xs">
                      No division data available yet.
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800">
                  <button
                    onClick={() => setActiveTab('divisions')}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition"
                  >
                    <Building2 className="w-4 h-4 text-amber-400" /> Open Full Division Analytics
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. DIVISION & DAY-WISE ANALYTICS TAB */}
        {activeTab === 'divisions' && (
          <div className="space-y-6">
            {/* Header & Date / View Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-amber-400" /> Division & Day-Wise Performance Analytics
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Analyze performance by specific day, overall all-time totals, and daily division growth trends
                </p>
              </div>

              {/* View Mode Toggle: Cards vs L1 Volunteers vs Daywise Timeline */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => setDivisionViewMode('cards')}
                    className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                      divisionViewMode === 'cards' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" /> Division Cards
                  </button>
                  <button
                    onClick={() => setDivisionViewMode('l1_volunteers')}
                    className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                      divisionViewMode === 'l1_volunteers' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" /> L1 Volunteers
                  </button>
                  <button
                    onClick={() => setDivisionViewMode('daywise_timeline')}
                    className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                      divisionViewMode === 'daywise_timeline' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" /> Day-Wise Timeline
                  </button>
                </div>
              </div>
            </div>

            {/* Date & Hourly Filter Bar */}
            <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5 mr-1">
                  <Filter className="w-3.5 h-3.5 text-amber-400" /> Filter:
                </span>
                
                {/* Date Dropdown */}
                <select
                  value={selectedDateFilter}
                  onChange={(e) => setSelectedDateFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="all">📅 All Dates (Overall)</option>
                  {availableDates.map((day) => (
                    <option key={day.date} value={day.date}>
                      📅 {day.displayDate} ({day.totalPasses} passes)
                    </option>
                  ))}
                </select>

                {/* Hourly Filter Dropdown */}
                <select
                  value={selectedHourFilter}
                  onChange={(e) => setSelectedHourFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-500"
                >
                  <option value="all">⏰ All Hours (24h)</option>
                  {ALL_HOURS_META.map((meta) => {
                    const hStat = activeHourlyList.find((h) => h.hour === meta.hour);
                    const txCount = hStat ? hStat.totalTransactions : 0;
                    return (
                      <option key={meta.key} value={meta.key}>
                        ⏰ {meta.hourDisplay} {txCount > 0 ? `(${txCount} txns)` : ''}
                      </option>
                    );
                  })}
                </select>

                {(selectedDateFilter !== 'all' || selectedHourFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSelectedDateFilter('all');
                      setSelectedHourFilter('all');
                    }}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Clear
                  </button>
                )}
              </div>

              {/* Search & Sort Controls */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search division..."
                    value={divisionSearch}
                    onChange={(e) => setDivisionSearch(e.target.value)}
                    className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                  <span className="text-[10px] text-slate-400 px-1">Sort:</span>
                  <button
                    onClick={() => setDivisionSortBy('passes')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition ${
                      divisionSortBy === 'passes' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
                    }`}
                  >
                    Passes
                  </button>
                  <button
                    onClick={() => setDivisionSortBy('donations')}
                    className={`px-2 py-0.5 rounded-md font-semibold transition ${
                      divisionSortBy === 'donations' ? 'bg-rose-500 text-white font-bold' : 'text-slate-400'
                    }`}
                  >
                    Donations
                  </button>
                </div>
              </div>
            </div>

            {/* Selected Scope Summary Banner (if a date or hour is picked) */}
            {(activeDayStat || activeHourStat) && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-300">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  <div>
                    <span className="font-bold text-sm text-white">
                      Showing Filtered Performance: {activeDayStat ? activeDayStat.displayDate : 'All Days'} {activeHourStat ? `• ${ALL_HOURS_META[Number(selectedHourFilter)]?.hourDisplay}` : ''}
                    </span>
                    <p className="text-[11px] text-amber-400/80">
                      {activeHourStat ? `${activeHourStat.totalTransactions} transactions across ${activeHourStat.divisionStats.length} divisions` : `${activeDayStat?.totalTransactions} transactions recorded across ${activeDayStat?.divisionStats.length} divisions`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Passes: </span>
                    <strong className="text-white font-extrabold text-sm">{displayTotalPasses}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Donations: </span>
                    <strong className="text-rose-400 font-extrabold text-sm">
                      ₹{displayTotalDonations.toLocaleString()}
                    </strong>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedDateFilter('all');
                      setSelectedHourFilter('all');
                    }}
                    className="text-xs text-amber-400 hover:text-amber-200 underline font-semibold ml-2"
                  >
                    Reset to Overall
                  </button>
                </div>
              </div>
            )}

            {/* VIEW MODE 1: DIVISION CARDS */}
            {divisionViewMode === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredDivisions.map((div, idx) => (
                  <div
                    key={div.division}
                    className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      {/* Title & Rank */}
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">
                            Rank #{idx + 1}
                          </span>
                          <h4 className="text-base font-bold text-white mt-0.5">{div.division}</h4>
                        </div>
                        <div className="w-8 h-8 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300">
                          <Building2 className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-2.5 mb-4">
                        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
                          <div className="text-[11px] text-slate-400">Passes Sold</div>
                          <div className="text-xl font-extrabold text-amber-400 mt-0.5">
                            {div.totalPasses.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-500">{div.passTransactions} txns</div>
                        </div>

                        <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
                          <div className="text-[11px] text-slate-400">Donations Collected</div>
                          <div className="text-xl font-extrabold text-rose-400 mt-0.5">
                            ₹{div.totalDonationAmount.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-slate-500">{div.donationTransactions} donations</div>
                        </div>
                      </div>

                      {/* Progress Bar for Passes */}
                      <div className="space-y-1 mb-4">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Pass Share</span>
                          <span>
                            {Math.round(
                              (div.totalPasses / (activeDayStat ? activeDayStat.totalPasses : (stats?.totalCapturedPasses || 1))) * 100
                            )}
                            %
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber-500 h-1.5 rounded-full"
                            style={{
                              width: `${Math.max(
                                (div.totalPasses / (activeDayStat ? activeDayStat.totalPasses : (stats?.totalCapturedPasses || 1))) * 100,
                                3
                              )}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Daily Trajectory for this Division */}
                      {div.dayWiseTrend && div.dayWiseTrend.length > 0 && selectedDateFilter === 'all' && (
                        <div className="pt-3 border-t border-slate-800 mb-3">
                          <div className="text-[11px] font-semibold text-slate-400 mb-2 flex items-center gap-1">
                            <CalendarDays className="w-3 h-3 text-amber-400" /> Daily Ingestion Trend:
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {div.dayWiseTrend.map((t) => (
                              <span
                                key={t.date}
                                className="px-2 py-0.5 rounded-md text-[10px] bg-slate-950 border border-slate-800 text-slate-300"
                              >
                                {t.displayDate}: <strong className="text-amber-400">{t.passes}p</strong>
                                {t.donations > 0 && <span className="text-rose-400 font-semibold ml-1">₹{t.donations}</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Top / All Volunteers */}
                      {div.topVolunteers && div.topVolunteers.length > 0 && (
                        <div className="pt-3 border-t border-slate-800">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-500" /> Active L1 Volunteers ({div.allVolunteers?.length || div.volunteersCount || 0}):
                            </div>
                            {div.allVolunteers && div.allVolunteers.length > 0 && (
                              <button
                                onClick={() =>
                                  setExpandedDivisionVolunteers(
                                    expandedDivisionVolunteers === div.division ? null : div.division
                                  )
                                }
                                className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold underline"
                              >
                                {expandedDivisionVolunteers === div.division ? 'Hide Details' : 'View All L1s'}
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {div.topVolunteers.map((vol) => (
                              <span
                                key={vol.name}
                                className="px-2 py-0.5 rounded-md text-[11px] bg-slate-950 border border-slate-800 text-slate-300"
                              >
                                {vol.name} <strong className="text-amber-400 font-semibold">({vol.passes}p)</strong>
                              </span>
                            ))}
                          </div>

                          {/* Expanded Full L1 Volunteers List */}
                          {expandedDivisionVolunteers === div.division && div.allVolunteers && (
                            <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800/80 space-y-2 text-xs">
                              <div className="font-semibold text-amber-400 text-[11px] flex items-center justify-between border-b border-slate-800 pb-1.5">
                                <span>All L1 Volunteers in {div.division}</span>
                                <span className="text-[10px] text-slate-400">{div.allVolunteers.length} total</span>
                              </div>
                              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-900">
                                {div.allVolunteers.map((vol: VolunteerStat, vIdx: number) => (
                                  <div key={vol.name + vIdx} className="pt-1.5 flex items-center justify-between text-[11px]">
                                    <div>
                                      <span className="font-semibold text-white">{vol.name}</span>
                                      {vol.l2 && vol.l2 !== '-' && (
                                        <span className="text-[10px] text-slate-500 ml-1.5">(L2: {vol.l2})</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-amber-400 font-bold">{vol.passes} passes</span>
                                      {vol.donations > 0 && <span className="text-rose-400 font-semibold">₹{vol.donations}</span>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-800/60 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setPassDivisionFilter(div.division);
                          setActiveTab('passes');
                        }}
                        className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                      >
                        View All Passes for Division <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* VIEW MODE 2: ALL L1 VOLUNTEERS BREAKDOWN TABLE */}
            {divisionViewMode === 'l1_volunteers' && (() => {
              const allL1Volunteers = (stats?.divisionStats || []).flatMap((div) => div.allVolunteers || []);

              const filteredL1 = allL1Volunteers.filter((vol) => {
                const matchesSearch =
                  !volunteerSearch ||
                  vol.name.toLowerCase().includes(volunteerSearch.toLowerCase()) ||
                  vol.l2.toLowerCase().includes(volunteerSearch.toLowerCase()) ||
                  vol.division.toLowerCase().includes(volunteerSearch.toLowerCase());
                const matchesDiv =
                  volunteerDivisionFilter === 'all' ||
                  vol.division.toLowerCase() === volunteerDivisionFilter.toLowerCase();
                return matchesSearch && matchesDiv;
              });

              const totalL1Passes = filteredL1.reduce((sum, v) => sum + v.passes, 0);
              const totalL1Donations = filteredL1.reduce((sum, v) => sum + v.donations, 0);
              const topL1Vol = filteredL1.length > 0 ? filteredL1[0] : null;

              return (
                <div className="space-y-5">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                      <div className="text-xs text-slate-400">Total Active L1 Volunteers</div>
                      <div className="text-2xl font-extrabold text-amber-400 mt-1">{filteredL1.length}</div>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                      <div className="text-xs text-slate-400">Total Passes Sold by L1s</div>
                      <div className="text-2xl font-extrabold text-amber-400 mt-1">{totalL1Passes}</div>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                      <div className="text-xs text-slate-400">Total Donations Raised by L1s</div>
                      <div className="text-2xl font-extrabold text-rose-400 mt-1">
                        ₹{totalL1Donations.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                      <div className="text-xs text-slate-400">Top L1 Performer</div>
                      <div className="text-sm font-bold text-white mt-1 truncate">
                        {topL1Vol ? `${topL1Vol.name} (${topL1Vol.passes}p)` : '-'}
                      </div>
                      {topL1Vol && <div className="text-[10px] text-amber-400">{topL1Vol.division}</div>}
                    </div>
                  </div>

                  {/* Filter and CSV Export Toolbar */}
                  <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                      <div className="relative flex-1 md:w-72">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search L1 volunteer, L2, division..."
                          value={volunteerSearch}
                          onChange={(e) => setVolunteerSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <select
                        value={volunteerDivisionFilter}
                        onChange={(e) => setVolunteerDivisionFilter(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                      >
                        <option value="all">All Divisions ({stats?.divisionStats?.length || 0})</option>
                        {(stats?.divisionStats || []).map((d) => (
                          <option key={d.division} value={d.division}>
                            {d.division} ({d.allVolunteers?.length || 0} vols)
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => exportL1VolunteersCSV(filteredL1)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition"
                    >
                      <Download className="w-4 h-4" /> Export L1 Volunteers CSV
                    </button>
                  </div>

                  {/* L1 Volunteers Table */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="py-3.5 px-4 text-center">Rank</th>
                            <th className="py-3.5 px-4">L1 Volunteer (Referred)</th>
                            <th className="py-3.5 px-4">Division</th>
                            <th className="py-3.5 px-4">L2 Leader</th>
                            <th className="py-3.5 px-4 text-center">Passes Sold</th>
                            <th className="py-3.5 px-4 text-center">Pass Txns</th>
                            <th className="py-3.5 px-4 text-center">Donations (₹)</th>
                            <th className="py-3.5 px-4 text-center">Total Txns</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-slate-300">
                          {filteredL1.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-500">
                                No L1 volunteers found matching filter.
                              </td>
                            </tr>
                          ) : (
                            filteredL1.map((vol, idx) => (
                              <tr key={vol.name + vol.division + idx} className="hover:bg-slate-800/40 transition">
                                <td className="py-3 px-4 text-center font-bold text-amber-400 text-xs">
                                  #{idx + 1}
                                </td>
                                <td className="py-3 px-4">
                                  <span className="font-semibold text-white">{vol.name}</span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-950 border border-slate-800 text-slate-300 font-medium">
                                    {vol.division}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-400">{vol.l2 || '-'}</td>
                                <td className="py-3 px-4 text-center">
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    {vol.passes} passes
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-center text-slate-400">{vol.passTransactions}</td>
                                <td className="py-3 px-4 text-center font-bold text-rose-400">
                                  {vol.donations > 0 ? `₹${vol.donations.toLocaleString()}` : '-'}
                                </td>
                                <td className="py-3 px-4 text-center text-slate-400 font-semibold">
                                  {vol.totalTransactions}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* VIEW MODE 3: DAY-WISE CHRONOLOGICAL TIMELINE TABLE */}
            {divisionViewMode === 'daywise_timeline' && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-amber-400" /> Day-by-Day Historical Breakdown
                  </h4>
                  <span className="text-xs text-slate-400">{availableDates.length} Days Recorded</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3.5 px-4">Date</th>
                        <th className="py-3.5 px-4 text-center">Total Passes Sold</th>
                        <th className="py-3.5 px-4 text-center">Pass Txns</th>
                        <th className="py-3.5 px-4 text-center">Donations Collected (₹)</th>
                        <th className="py-3.5 px-4 text-center">Donation Txns</th>
                        <th className="py-3.5 px-4">Divisions Breakdown on Day</th>
                        <th className="py-3.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {availableDates.map((day) => (
                        <tr key={day.date} className="hover:bg-slate-800/30 transition">
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              📅 {day.displayDate}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center text-amber-400 font-extrabold text-sm">
                            {day.totalPasses}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-400">{day.passTransactions}</td>
                          <td className="py-3.5 px-4 text-center font-bold text-rose-400">
                            ₹{day.totalDonationAmount.toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-400">{day.donationTransactions}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1.5 max-w-lg">
                              {day.divisionStats.map((d) => (
                                <span
                                  key={d.division}
                                  className="px-2 py-0.5 rounded-md text-[10px] bg-slate-950 border border-slate-800 text-slate-300"
                                >
                                  {d.division}: <strong className="text-amber-400">{d.totalPasses}p</strong>
                                  {d.totalDonationAmount > 0 && (
                                    <span className="text-rose-400 ml-1">₹{d.totalDonationAmount}</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => {
                                setSelectedDateFilter(day.date);
                                setDivisionViewMode('cards');
                              }}
                              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold"
                            >
                              Filter to Day
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {availableDates.length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No day-wise activity recorded yet.
                  </div>
                )}
              </div>
            )}

            {filteredDivisions.length === 0 && divisionViewMode === 'cards' && (
              <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800">
                <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-400">No divisions found matching your filter</p>
              </div>
            )}
          </div>
        )}

        {/* 3. UPLOAD EXCEL TAB (TWO-STAGE FLOW) */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            {/* Step Header */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <UploadCloud className="w-5 h-5 text-amber-400" /> Ingest Razorpay Excel Export
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Stage 1 performs duplicate checks and item classification without altering data. Stage 2 commits verified records to database & Sheets.
                  </p>
                </div>

                {/* Sample Download Button */}
                <a
                  href="/api/sample"
                  download="Payments_Sample_Razorpay.xlsx"
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition shrink-0"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" /> Download Sample Razorpay File
                </a>
              </div>

              {/* Target Event Selection */}
              <div className="mb-6 p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-slate-300">Target Event for this Upload:</span>
                  <p className="text-[11px] text-slate-400">All parsed transactions will be tagged to this event</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setUploadTargetEvent('garba_groove')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      uploadTargetEvent === 'garba_groove'
                        ? 'bg-amber-500 text-slate-950 shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    🌟 Garba Groove 2026
                  </button>
                  <button
                    onClick={() => setUploadTargetEvent('navratri_utsav')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      uploadTargetEvent === 'navratri_utsav'
                        ? 'bg-purple-600 text-white shadow-md'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    🪔 Navratri Utsav 2026
                  </button>
                </div>
              </div>

              {/* Drag & Drop Area */}
              {!analysis && !importSuccess && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-amber-400 bg-slate-950/60 hover:bg-slate-950/90 rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 group-hover:bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4 transition">
                    <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-white mb-1">
                    {analyzing ? 'Analyzing Excel structure...' : 'Click to select or drag & drop Razorpay Excel'}
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                    Supports Razorpay Payment Page exports (.xlsx, .xls, .csv).
                  </p>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" /> Strict order_id duplicate prevention active
                  </span>
                </div>
              )}

              {/* Upload Error Banner */}
              {uploadError && (
                <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>

            {/* STAGE 1 ANALYSIS PREVIEW MODAL / CARD */}
            {analysis && !importSuccess && (
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Stage 1 Complete: Verification Summary
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1">{analysis.fileName}</h3>
                    <p className="text-xs text-slate-400">
                      Target Event: <strong className="text-amber-400">{analysis.eventName}</strong> •{' '}
                      {(analysis.fileSizeBytes / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <button
                    onClick={handleResetUpload}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold self-start sm:self-auto"
                  >
                    Cancel / Choose Another
                  </button>
                </div>

                {/* Analysis KPI Metric Counters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-medium">Total Rows in File</div>
                    <div className="text-xl font-bold text-white mt-0.5">{analysis.totalRows}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{analysis.capturedRows} valid captured</div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                    <div className="text-[11px] text-emerald-400 font-medium flex items-center justify-between">
                      <span>New Rows to Ingest</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">NEW</span>
                    </div>
                    <div className="text-xl font-bold text-emerald-400 mt-0.5">
                      {analysis.newRecordsToImport}{' '}
                      <span className="text-xs font-normal text-slate-400">/ {analysis.capturedRows}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {analysis.totalDuplicatesToSkip > 0 ? (
                        <span className="text-amber-400 font-medium">{analysis.totalDuplicatesToSkip} duplicates skipped</span>
                      ) : (
                        <span className="text-emerald-400/80">0 duplicates detected</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
                    <div className="text-[11px] text-amber-400 font-medium flex items-center justify-between">
                      <span>New Passes</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">NEW</span>
                    </div>
                    <div className="text-xl font-bold text-amber-400 mt-0.5">
                      +{analysis.newPasses ?? analysis.totalPasses}{' '}
                      <span className="text-xs font-normal text-slate-400">passes</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      +{analysis.newPassTransactions ?? analysis.passTransactions} new rows
                      {(analysis.existingPasses ?? 0) > 0 && (
                        <span className="text-slate-500"> • {analysis.existingPasses} existing</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5">
                    <div className="text-[11px] text-rose-400 font-medium flex items-center justify-between">
                      <span>New Donations</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">NEW</span>
                    </div>
                    <div className="text-xl font-bold text-rose-400 mt-0.5">
                      +₹{(analysis.newDonationAmount ?? analysis.totalDonationAmount).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      +{analysis.newDonationTransactions ?? analysis.donationTransactions} new donors
                      {(analysis.existingDonationAmount ?? 0) > 0 && (
                        <span className="text-slate-500"> • ₹{analysis.existingDonationAmount.toLocaleString()} existing</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Classification Breakdown */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/20">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Ticket className="w-4 h-4" /> Pass Ingestion Preview
                    </div>
                    <div className="text-2xl font-extrabold text-white">
                      +{analysis.newPasses ?? analysis.totalPasses}{' '}
                      <span className="text-sm font-semibold text-slate-400">New Passes</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      from <strong className="text-amber-300">{analysis.newPassTransactions ?? analysis.passTransactions}</strong> new transactions → Target Sheet: <strong className="text-amber-300">PASS TABLE</strong>
                    </p>
                    {(analysis.existingPasses ?? 0) > 0 && (
                      <div className="mt-2.5 text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                        ℹ️ {analysis.existingPasses} passes ({analysis.existingPassTransactions} transactions) already exist in database and will be safely skipped.
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-950 p-4 rounded-xl border border-rose-500/20">
                    <div className="text-xs font-bold text-rose-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Heart className="w-4 h-4" /> Donation Ingestion Preview
                    </div>
                    <div className="text-2xl font-extrabold text-white">
                      +₹{(analysis.newDonationAmount ?? analysis.totalDonationAmount).toLocaleString()}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      from <strong className="text-rose-300">{analysis.newDonationTransactions ?? analysis.donationTransactions}</strong> new donors → Target Sheet: <strong className="text-rose-300">DONATION TABLE</strong>
                    </p>
                    {(analysis.existingDonationAmount ?? 0) > 0 && (
                      <div className="mt-2.5 text-[11px] text-rose-300/80 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                        ℹ️ ₹{analysis.existingDonationAmount.toLocaleString()} ({analysis.existingDonationTransactions} donors) already exist in database and will be safely skipped.
                      </div>
                    )}
                  </div>
                </div>

                {/* Stage 2 Action Bar */}
                <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs font-medium flex items-center gap-2">
                    {analysis.newRecordsToImport > 0 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span className="text-emerald-400">
                          Ready to ingest <strong>{analysis.newRecordsToImport}</strong> new records
                          {analysis.totalDuplicatesToSkip > 0 && (
                            <span className="text-slate-400 font-normal"> ({analysis.totalDuplicatesToSkip} duplicates will be skipped)</span>
                          )}
                          .
                        </span>
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="text-amber-300">
                          All {analysis.capturedRows} valid records in this file are already imported in the database. No new records to ingest.
                        </span>
                      </>
                    )}
                  </div>

                  <button
                    onClick={handleConfirmImport}
                    disabled={importing || analysis.newRecordsToImport === 0}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                  >
                    {importing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Ingesting & Sorting Records...
                      </>
                    ) : analysis.newRecordsToImport > 0 ? (
                      <>
                        <Check className="w-4 h-4" /> Confirm & Ingest {analysis.newRecordsToImport} New Records
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" /> All Records Already Ingested
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STAGE 2 SUCCESS CONFIRMATION */}
            {importSuccess && importResult && (
              <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-white">Batch Successfully Ingested!</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Batch ID <code className="text-amber-400">{importResult.batch.id}</code> has been committed to database and synced downstream to Google Sheets.
                </p>

                <div className="flex justify-center gap-3 pt-2">
                  <button
                    onClick={() => setActiveTab('passes')}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950"
                  >
                    View Ingested Passes
                  </button>
                  <button
                    onClick={handleResetUpload}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300"
                  >
                    Upload Another File
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. PASS RECORDS & EMAIL DISPATCH HUB */}
        {activeTab === 'passes' && (() => {
          const pendingPasses = passes.filter((p) => p.email_status === 'Pending' || !p.email_status);
          const sentPasses = passes.filter((p) => p.email_status === 'Sent');
          const failedPasses = passes.filter((p) => p.email_status === 'Failed');
          const sentRate = passes.length > 0 ? Math.round((sentPasses.length / passes.length) * 100) : 0;

          const filteredPasses = passes.filter((p) => {
            if (passEmailFilter === 'pending') return p.email_status === 'Pending' || !p.email_status;
            if (passEmailFilter === 'sent') return p.email_status === 'Sent';
            if (passEmailFilter === 'failed') return p.email_status === 'Failed';
            return true;
          });

          const isNavratri = selectedEvent === 'navratri_utsav';
          const currentEventName = isNavratri ? 'Navratri Utsav 2026' : 'Garba Groove 2026';
          const currentEventDate = isNavratri ? '11 Oct 2026' : '10 Oct 2026';

          return (
            <div className="space-y-5">
              {/* Event Hub Selector & Overview Card */}
              <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isNavratri ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                        {isNavratri ? '🪔 Navratri Utsav 2026' : '🌟 Garba Groove 2026'}
                      </span>
                      <span className="text-xs text-slate-400">• {currentEventDate} • Telangana Gardens</span>
                    </div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Ticket className={`w-5 h-5 ${isNavratri ? 'text-purple-400' : 'text-amber-400'}`} />
                      Pass Ingestion & Email Dispatch Hub
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Target event: <strong className={isNavratri ? 'text-purple-300' : 'text-amber-300'}>{currentEventName}</strong> ({passes.length} loaded records)
                    </p>
                  </div>

                  {/* Event Switcher Toggle & Preview Button */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                      <button
                        onClick={() => setSelectedEvent('garba_groove')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          selectedEvent === 'garba_groove'
                            ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        🌟 Garba Groove
                      </button>
                      <button
                        onClick={() => setSelectedEvent('navratri_utsav')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                          selectedEvent === 'navratri_utsav'
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        🪔 Navratri Utsav
                      </button>
                    </div>

                    <button
                      onClick={() => handleOpenEmailPreview(undefined, isNavratri ? 'navratri_utsav' : 'garba_groove')}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-400" />
                      Preview Pass Template
                    </button>
                  </div>
                </div>

                {/* KPI Email Health Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-[11px] text-slate-400 font-medium">Total Passes</div>
                    <div className="text-xl font-bold text-white mt-0.5">{passes.length}</div>
                    <div className="text-[10px] text-slate-500 mt-1">100% captured</div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5">
                    <div className="text-[11px] text-amber-400 font-medium flex items-center justify-between">
                      <span>⏳ Pending Email</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">READY</span>
                    </div>
                    <div className="text-xl font-bold text-amber-400 mt-0.5">{pendingPasses.length}</div>
                    <div className="text-[10px] text-slate-400 mt-1">Awaiting dispatch</div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                    <div className="text-[11px] text-emerald-400 font-medium flex items-center justify-between">
                      <span>✅ Already Sent</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold">{sentRate}%</span>
                    </div>
                    <div className="text-xl font-bold text-emerald-400 mt-0.5">{sentPasses.length}</div>
                    <div className="text-[10px] text-emerald-400/80 mt-1">Delivered to attendees</div>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/5">
                    <div className="text-[11px] text-rose-400 font-medium flex items-center justify-between">
                      <span>❌ Failed / Retry</span>
                      {failedPasses.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 font-bold">ALERT</span>
                      )}
                    </div>
                    <div className="text-xl font-bold text-rose-400 mt-0.5">{failedPasses.length}</div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      {failedPasses.length > 0 ? 'Requires resending' : 'No failed dispatches'}
                    </div>
                  </div>
                </div>

                {/* Smart Dispatch Action Bar */}
                <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleSendEmails(pendingPasses.map((p) => p.order_id))}
                      disabled={emailSending || pendingPasses.length === 0}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-40"
                    >
                      {emailSending ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      🚀 Send All Pending ({pendingPasses.length})
                    </button>

                    {failedPasses.length > 0 && (
                      <button
                        onClick={() => handleSendEmails(failedPasses.map((p) => p.order_id))}
                        disabled={emailSending}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 flex items-center gap-1.5 transition disabled:opacity-40"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        🔄 Resend Failed ({failedPasses.length})
                      </button>
                    )}

                    {selectedPassIds.size > 0 && (
                      <button
                        onClick={() => handleSendEmails(Array.from(selectedPassIds))}
                        disabled={emailSending}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 flex items-center gap-1.5 transition disabled:opacity-40"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        ✉️ Resend Selected ({selectedPassIds.size})
                      </button>
                    )}
                  </div>

                  {/* Status Filter Pills */}
                  <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setPassEmailFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        passEmailFilter === 'all'
                          ? 'bg-slate-800 text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      All ({passes.length})
                    </button>
                    <button
                      onClick={() => setPassEmailFilter('pending')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        passEmailFilter === 'pending'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
                          : 'text-slate-400 hover:text-amber-300'
                      }`}
                    >
                      ⏳ Pending ({pendingPasses.length})
                    </button>
                    <button
                      onClick={() => setPassEmailFilter('sent')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        passEmailFilter === 'sent'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold'
                          : 'text-slate-400 hover:text-emerald-300'
                      }`}
                    >
                      ✅ Sent ({sentPasses.length})
                    </button>
                    <button
                      onClick={() => setPassEmailFilter('failed')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                        passEmailFilter === 'failed'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
                          : 'text-slate-400 hover:text-rose-300'
                      }`}
                    >
                      ❌ Failed ({failedPasses.length})
                    </button>
                  </div>
                </div>
              </div>

              {/* Table Toolbar (Search, Division, Date, Hour) */}
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search order ID, attendee, email..."
                      value={passSearch}
                      onChange={(e) => {
                        setPassSearch(e.target.value);
                        void fetchPasses(e.target.value, passDivisionFilter, selectedEvent, selectedDateFilter, selectedHourFilter);
                      }}
                      className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 w-48 sm:w-60"
                    />
                  </div>

                  {/* Division Filter */}
                  <select
                    value={passDivisionFilter}
                    onChange={(e) => {
                      setPassDivisionFilter(e.target.value);
                      void fetchPasses(passSearch, e.target.value, selectedEvent, selectedDateFilter, selectedHourFilter);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">🏢 All Divisions</option>
                    {(stats?.divisionStats || []).map((d) => (
                      <option key={d.division} value={d.division}>
                        {d.division} ({d.totalPasses}p)
                      </option>
                    ))}
                  </select>

                  {/* Date Dropdown */}
                  <select
                    value={selectedDateFilter}
                    onChange={(e) => {
                      setSelectedDateFilter(e.target.value);
                      void fetchPasses(passSearch, passDivisionFilter, selectedEvent, e.target.value, selectedHourFilter);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">📅 All Dates</option>
                    {availableDates.map((day) => (
                      <option key={day.date} value={day.date}>
                        📅 {day.displayDate}
                      </option>
                    ))}
                  </select>

                  {/* Hourly Dropdown */}
                  <select
                    value={selectedHourFilter}
                    onChange={(e) => {
                      setSelectedHourFilter(e.target.value);
                      void fetchPasses(passSearch, passDivisionFilter, selectedEvent, selectedDateFilter, e.target.value);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-amber-300 font-semibold focus:outline-none focus:border-amber-500"
                  >
                    <option value="all">⏰ All Hours (24h)</option>
                    {ALL_HOURS_META.map((meta) => {
                      const hStat = activeHourlyList.find((h) => h.hour === meta.hour);
                      const txCount = hStat ? hStat.passTransactions : 0;
                      return (
                        <option key={meta.key} value={meta.key}>
                          ⏰ {meta.hourDisplay} {txCount > 0 ? `(${txCount}p)` : ''}
                        </option>
                      );
                    })}
                  </select>

                  {(selectedDateFilter !== 'all' || selectedHourFilter !== 'all' || passDivisionFilter !== 'all' || passEmailFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSelectedDateFilter('all');
                        setSelectedHourFilter('all');
                        setPassDivisionFilter('all');
                        setPassEmailFilter('all');
                        void fetchPasses(passSearch, 'all', selectedEvent, 'all', 'all');
                      }}
                      className="p-1.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition"
                      title="Clear All Filters"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="text-xs text-slate-400">
                  Showing <strong className="text-white">{filteredPasses.length}</strong> of {passes.length} passes
                </div>
              </div>

              {/* Passes Table */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden relative">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={filteredPasses.length > 0 && selectedPassIds.size === filteredPasses.length}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPassIds(new Set(filteredPasses.map((p) => p.order_id)));
                              } else {
                                setSelectedPassIds(new Set());
                              }
                            }}
                            className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                          />
                        </th>
                        <th className="py-3 px-4">Order ID</th>
                        <th className="py-3 px-4">Attendee Name</th>
                        <th className="py-3 px-4">Email</th>
                        <th className="py-3 px-4">Pass Item</th>
                        <th className="py-3 px-4 text-center">Qty</th>
                        <th className="py-3 px-4">Division</th>
                        <th className="py-3 px-4">Email Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredPasses.map((rec) => {
                        const result = emailResults.get(rec.order_id);
                        const status = result?.status || rec.email_status || 'Pending';
                        const isSelected = selectedPassIds.has(rec.order_id);

                        return (
                          <tr
                            key={rec.order_id}
                            className={`hover:bg-slate-800/30 transition ${isSelected ? 'bg-amber-500/5' : ''}`}
                          >
                            <td className="py-3 px-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectPass(rec.order_id)}
                                className="rounded border-slate-700 bg-slate-900 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
                              />
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-amber-400">{rec.order_id}</td>
                            <td className="py-3 px-4 font-medium text-white">{rec.name || 'Anonymous'}</td>
                            <td className="py-3 px-4 text-slate-400 text-[11px]">{rec.email || '-'}</td>
                            <td className="py-3 px-4 text-slate-200">{rec.item_name}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300">
                                {rec.item_quantity}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800 text-slate-300">
                                {rec.divisions || 'Direct'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {status === 'Sent' ? (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  title={rec.email_sent_at ? `Sent at: ${new Date(rec.email_sent_at).toLocaleString()}` : 'Pass Delivered'}
                                >
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Sent
                                </span>
                              ) : status === 'Failed' ? (
                                <span
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                  title={rec.email_error || result?.error || 'Failed to dispatch email'}
                                >
                                  <AlertCircle className="w-3 h-3 text-rose-400" /> Failed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                  <Clock className="w-3 h-3 text-slate-400" /> Pending
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => handleOpenEmailPreview(rec.order_id, isNavratri ? 'navratri_utsav' : 'garba_groove')}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-amber-300 transition"
                                  title="Preview Attendee Pass"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleSendEmails([rec.order_id])}
                                  disabled={emailSending}
                                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 hover:text-emerald-300 transition disabled:opacity-50"
                                  title={status === 'Sent' ? 'Resend Pass Email' : 'Send Pass Email'}
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {filteredPasses.length === 0 && (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No pass records matching the current filters.
                  </div>
                )}
              </div>

              {/* LIVE DISPATCH PROGRESS MODAL */}
              {emailSending && dispatchProgress && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                        Dispatching Event Passes...
                      </h4>
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {Math.round((dispatchProgress.current / (dispatchProgress.total || 1)) * 100)}%
                      </span>
                    </div>

                    <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                        style={{
                          width: `${Math.round((dispatchProgress.current / (dispatchProgress.total || 1)) * 100)}%`,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span>Progress: {dispatchProgress.current} / {dispatchProgress.total}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-emerald-400 font-medium">✓ {dispatchProgress.sent} Sent</span>
                        <span className="text-rose-400 font-medium">✗ {dispatchProgress.failed} Failed</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* EMAIL PASS PREVIEW MODAL */}
              {previewModalOpen && (
                <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                    {/* Header */}
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                      <div className="flex items-center gap-2">
                        <Ticket className={`w-4 h-4 ${previewEventTarget === 'navratri_utsav' ? 'text-purple-400' : 'text-amber-400'}`} />
                        <h4 className="text-sm font-bold text-white">
                          Email Pass Preview • {previewEventTarget === 'navratri_utsav' ? 'Navratri Utsav 2026' : 'Garba Groove 2026'}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                          <button
                            onClick={() => handleOpenEmailPreview(previewSelectedOrder || undefined, 'garba_groove')}
                            className={`px-2.5 py-1 rounded font-semibold transition ${
                              previewEventTarget === 'garba_groove'
                                ? 'bg-amber-500 text-slate-950'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Garba Groove
                          </button>
                          <button
                            onClick={() => handleOpenEmailPreview(previewSelectedOrder || undefined, 'navratri_utsav')}
                            className={`px-2.5 py-1 rounded font-semibold transition ${
                              previewEventTarget === 'navratri_utsav'
                                ? 'bg-purple-600 text-white'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            Navratri Utsav
                          </button>
                        </div>

                        <button
                          onClick={() => setPreviewModalOpen(false)}
                          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Preview Content */}
                    <div className="flex-1 overflow-y-auto p-4 bg-slate-950/60">
                      {previewLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs">
                          <RefreshCw className="w-6 h-6 animate-spin mb-2 text-amber-400" />
                          Rendering Email Template...
                        </div>
                      ) : (
                        <div
                          className="rounded-xl overflow-hidden border border-slate-800 bg-white"
                          dangerouslySetInnerHTML={{ __html: previewHtml }}
                        />
                      )}
                    </div>

                    {/* Footer */}
                    <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs text-slate-400">
                      <span>Live responsive email rendering with QR code and event styling.</span>
                      <button
                        onClick={() => setPreviewModalOpen(false)}
                        className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
                      >
                        Close Preview
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* 5. DONATION RECORDS TAB */}
        {activeTab === 'donations' && (
          <div className="space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-400" /> Captured Donation Transactions
                </h3>
                <p className="text-xs text-slate-400">
                  Showing all donor contributions ({donations.length} records)
                </p>
              </div>

              {/* Filter Toolbar */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search donor name, PAN number, order ID..."
                    value={donationSearch}
                    onChange={(e) => {
                      setDonationSearch(e.target.value);
                      void fetchDonations(e.target.value, selectedEvent, selectedDateFilter, selectedHourFilter);
                    }}
                    className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500 w-48 sm:w-60"
                  />
                </div>

                {/* Date Dropdown */}
                <select
                  value={selectedDateFilter}
                  onChange={(e) => {
                    setSelectedDateFilter(e.target.value);
                    void fetchDonations(donationSearch, selectedEvent, e.target.value, selectedHourFilter);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-rose-500"
                >
                  <option value="all">📅 All Dates</option>
                  {availableDates.map((day) => (
                    <option key={day.date} value={day.date}>
                      📅 {day.displayDate}
                    </option>
                  ))}
                </select>

                {/* Hourly Dropdown */}
                <select
                  value={selectedHourFilter}
                  onChange={(e) => {
                    setSelectedHourFilter(e.target.value);
                    void fetchDonations(donationSearch, selectedEvent, selectedDateFilter, e.target.value);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-rose-300 font-semibold focus:outline-none focus:border-rose-500"
                >
                  <option value="all">⏰ All Hours (24h)</option>
                  {ALL_HOURS_META.map((meta) => {
                    const hStat = activeHourlyList.find((h) => h.hour === meta.hour);
                    const txCount = hStat ? hStat.donationTransactions : 0;
                    return (
                      <option key={meta.key} value={meta.key}>
                        ⏰ {meta.hourDisplay} {txCount > 0 ? `(${txCount}d)` : ''}
                      </option>
                    );
                  })}
                </select>

                {(selectedDateFilter !== 'all' || selectedHourFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSelectedDateFilter('all');
                      setSelectedHourFilter('all');
                      void fetchDonations(donationSearch, selectedEvent, 'all', 'all');
                    }}
                    className="p-1.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition"
                    title="Clear Filters"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Donations Table */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Donor Name</th>
                      <th className="py-3 px-4">Payment Date</th>
                      <th className="py-3 px-4">PAN Number</th>
                      <th className="py-3 px-4">Donation Description</th>
                      <th className="py-3 px-4">Amount (₹)</th>
                      <th className="py-3 px-4">Division</th>
                      <th className="py-3 px-4">Referred Volunteer</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {donations.map((rec) => (
                      <tr key={rec.order_id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-[11px] text-rose-400">{rec.order_id}</td>
                        <td className="py-3 px-4 font-medium text-white">{rec.name || 'Anonymous Donor'}</td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">{rec.payment_date || '-'}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{rec.pan_number || '-'}</td>
                        <td className="py-3 px-4 text-slate-200">{rec.item_name}</td>
                        <td className="py-3 px-4 font-bold text-rose-400">
                          ₹{Number(rec.total_payment_amount || rec.item_payment_amount || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800 text-slate-300">
                            {rec.divisions || 'Direct'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{rec.referred_volunteer || '-'}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            Captured
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {donations.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No donation records found.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. IMPORT HISTORY TAB */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" /> Batch Upload & Ingestion Audit Log
              </h3>
              <p className="text-xs text-slate-400">
                Complete history of all Excel uploads, deduplication metrics, and downstream sync status
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Batch ID</th>
                      <th className="py-3 px-4">File Name</th>
                      <th className="py-3 px-4">Event</th>
                      <th className="py-3 px-4 text-center">Total Rows</th>
                      <th className="py-3 px-4 text-center">Captured Passes</th>
                      <th className="py-3 px-4 text-center">Donations (₹)</th>
                      <th className="py-3 px-4 text-center">Duplicates Skipped</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {batches.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-800/30 transition">
                        <td className="py-3 px-4 font-mono text-[11px] text-amber-400">{b.id}</td>
                        <td className="py-3 px-4 font-medium text-white">{b.file_name}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">
                            {b.event_name || 'Garba Groove'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">{b.total_rows}</td>
                        <td className="py-3 px-4 text-center text-amber-400 font-bold">{b.total_passes}</td>
                        <td className="py-3 px-4 text-center text-rose-400 font-bold">
                          ₹{b.total_donation_amount.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-400">{b.duplicates_skipped}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {new Date(b.created_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {batches.length === 0 && (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No batches have been uploaded yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 7. BACKEND ARCHITECTURE & DATA STORAGE TAB */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            {/* System Status Banner */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                <Server className="w-5 h-5 text-amber-400" /> Backend Architecture & Storage Breakdown
              </h3>
              <p className="text-xs text-slate-400">
                Primary Database: <strong>Supabase PostgreSQL</strong>. All authentication & settings are securely configured server-side.
              </p>
            </div>

            {/* Event Pass Artwork Configuration */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                🎨 Event Pass Custom Artwork URLs
              </h3>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">
                  Navratri Utsav 2026 Pass Background Image URL
                </label>
                <input
                  type="text"
                  value={systemSettings.navratriPassBgUrl || ''}
                  onChange={(e) => setSystemSettings({ ...systemSettings, navratriPassBgUrl: e.target.value })}
                  placeholder="https://res.cloudinary.com/dhrj3rpg8/image/upload/..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
                <p className="text-[11px] text-slate-500">Cloudinary image URL for Navratri Utsav 2026 passes (Event Date: 11 Oct 2026).</p>
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ settings: systemSettings }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        alert('Pass Artwork Settings saved successfully!');
                      } else {
                        alert(`Error saving settings: ${data.error}`);
                      }
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : 'Network error saving settings';
                      alert(`Network error saving settings: ${message}`);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition-all flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" /> Save Settings
                </button>
              </div>
            </div>

            {/* Architecture Card: Supabase PostgreSQL */}
            <div className="bg-slate-900/90 border border-emerald-500/30 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">Supabase PostgreSQL (Primary Cloud Database)</h4>
                    <p className="text-xs text-emerald-400 font-medium">Single Source of Truth & Zero Duplicate Guarantee</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300">
                  Cloud Active
                </span>
              </div>

              <div className="space-y-2.5 text-xs text-slate-300 mb-5">
                <p className="font-semibold text-white">Data Storage & Schema:</p>
                <ul className="space-y-1.5 list-disc pl-4 text-slate-400">
                  <li><strong className="text-slate-200">event_records</strong>: Complete normalized attendee dataset with strict <code className="text-amber-400 font-mono">order_id UNIQUE</code> indexing.</li>
                  <li><strong className="text-slate-200">event_id Separation</strong>: Strict isolation between <code className="text-amber-300 font-mono">garba_groove</code> (Garba Groove 2026) and <code className="text-amber-300 font-mono">navratri_utsav</code> (Navratri Utsav 2026).</li>
                  <li><strong className="text-slate-200">import_batches</strong>: Audit log of every uploaded Excel batch file.</li>
                  <li><strong className="text-slate-200">Attendance Verification</strong>: Stores real-time check-in state (<code className="text-emerald-400 font-mono">PENDING</code> | <code className="text-emerald-400 font-mono">PRESENT</code> | <code className="text-emerald-400 font-mono">CANCELLED</code>) for venue scanners.</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                <strong className="text-slate-200">Database Connection (.env.local):</strong>
                <pre className="mt-1 text-slate-500 font-mono text-[10px]">
                  NEXT_PUBLIC_SUPABASE_URL=https://your-id.supabase.co{'\n'}
                  SUPABASE_SERVICE_ROLE_KEY=your-key
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
