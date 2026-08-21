import { useAuthStore } from '@/store/auth';
import api from '@/utils/axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Check, ChevronDown, ChevronRight, Copy, Share2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Clipboard, Linking, Platform, RefreshControl, SafeAreaView, ScrollView, Text, ToastAndroid, TouchableOpacity, View } from 'react-native';

type Bucket = {
  count: number;
  amount: number;
  rate: number | null;
  rates: number[];
};

type Breakdown = Record<string, Bucket | undefined>;

type SalesRow = {
  name?: string;
  draw_name?: string;
  time?: string;
  sell?: number | string;
  total_sell?: number | string;
  price?: number | string;
  total_price?: number | string;
  breakdown?: Breakdown;
};

type DayReport = {
  date?: string;
  date_display?: string;
  sales_details?: SalesRow[];
  breakdown?: Breakdown;
  summary?: any;
};

// Order the number-type rows are shown/exported in. `super` / `box` are
// sub-splits of `three_digit` (only default draws have them), so they are
// indented under it.
const BREAKDOWN_ROWS: { key: string; label: string; indent?: boolean }[] = [
  { key: 'single', label: 'Single' },
  { key: 'double', label: 'Double' },
  { key: 'three_digit', label: '3-Digit' },
  { key: 'super', label: 'Super', indent: true },
  { key: 'box', label: 'Box', indent: true },
  { key: 'four_digit', label: '4-Digit' },
  { key: 'other', label: 'Other' },
];

const fmt = (val: number | string | null | undefined) => {
  if (val == null || val === '') return '';
  const n = Number(val);
  if (isNaN(n)) return '';
  return n.toLocaleString('en-IN');
};

const fmtCurrency = (val: number | null | undefined) => {
  if (val == null) return '₹0.00';
  return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const fmtRate = (val: number | null | undefined) => {
  if (val == null) return '';
  return Number(val).toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const formatDateYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateDisplay = (d: Date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const formatDateShort = (d: Date) => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
};

const addDays = (d: Date, days: number) => {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
};

/** Rows of a breakdown that actually have numbers booked. */
const visibleBuckets = (breakdown?: Breakdown) => {
  if (!breakdown) return [];
  return BREAKDOWN_ROWS
    .map((row) => ({ ...row, bucket: breakdown[row.key] }))
    .filter((row) => (row.bucket?.count ?? 0) > 0);
};

const SummaryRow = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <View className="flex-row justify-between py-2.5" style={{ borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
    <Text className="text-sm text-gray-500">{label}</Text>
    <Text className="text-sm font-bold" style={{ color: color || '#1e293b' }}>{value}</Text>
  </View>
);

const BreakdownHeader = () => (
  <View className="flex-row px-3 py-1.5" style={{ backgroundColor: '#f1f5f9' }}>
    <Text className="flex-1 text-[10px] font-bold text-gray-400">TYPE</Text>
    <Text className="text-[10px] font-bold text-gray-400 text-right" style={{ width: 48 }}>COUNT</Text>
    <Text className="text-[10px] font-bold text-gray-400 text-right" style={{ width: 52 }}>RATE</Text>
    <Text className="text-[10px] font-bold text-gray-400 text-right" style={{ width: 80 }}>AMOUNT</Text>
  </View>
);

const BreakdownTable = ({ breakdown }: { breakdown?: Breakdown }) => {
  const rows = visibleBuckets(breakdown);
  const total = breakdown?.total;

  if (rows.length === 0) {
    return (
      <View className="px-3 py-3">
        <Text className="text-xs text-gray-400">No numbers booked</Text>
      </View>
    );
  }

  return (
    <View>
      <BreakdownHeader />
      {rows.map((row) => (
        <View
          key={row.key}
          className="flex-row px-3 py-2 items-center"
          style={{ borderTopWidth: 1, borderTopColor: '#f1f5f9' }}
        >
          <Text
            className={`flex-1 text-xs ${row.indent ? 'text-gray-500' : 'font-semibold text-gray-700'}`}
            style={row.indent ? { paddingLeft: 12 } : undefined}
          >
            {row.indent ? `↳ ${row.label}` : row.label}
          </Text>
          <Text className="text-xs font-bold text-gray-900 text-right" style={{ width: 48 }}>
            {fmt(row.bucket?.count)}
          </Text>
          <Text className="text-[11px] text-gray-400 text-right" style={{ width: 52 }}>
            {row.bucket?.rate != null ? `× ${fmtRate(row.bucket.rate)}` : '—'}
          </Text>
          <Text className="text-xs font-bold text-right" style={{ width: 80, color: '#4f46e5' }}>
            {fmtCurrency(row.bucket?.amount)}
          </Text>
        </View>
      ))}
      {total && (
        <View
          className="flex-row px-3 py-2 items-center"
          style={{ borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#f8fafc' }}
        >
          <Text className="flex-1 text-xs font-bold text-gray-700">Total</Text>
          <Text className="text-xs font-extrabold text-gray-900 text-right" style={{ width: 48 }}>
            {fmt(total.count)}
          </Text>
          <Text className="text-[11px] text-gray-400 text-right" style={{ width: 52 }} />
          <Text className="text-xs font-extrabold text-right" style={{ width: 80, color: '#4f46e5' }}>
            {fmtCurrency(total.amount)}
          </Text>
        </View>
      )}
    </View>
  );
};

const SalesDetailsCard = ({
  title,
  rows,
  expandedKeys,
  onToggle,
  keyPrefix,
  defaultOpen = false,
}: {
  title: string;
  rows: SalesRow[];
  expandedKeys: Record<string, boolean>;
  onToggle: (key: string) => void;
  keyPrefix: string;
  defaultOpen?: boolean;
}) => (
  <View
    className="rounded-2xl overflow-hidden"
    style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
  >
    <View className="px-4 py-3" style={{ backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
      <Text className="text-sm font-bold text-gray-700">{title}</Text>
      <Text className="text-[10px] text-gray-400 mt-0.5">Tap a draw to see its number counts</Text>
    </View>
    <View className="flex-row px-4 py-2.5" style={{ backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
      <Text className="flex-1 text-xs font-bold text-gray-400">TIME</Text>
      <Text className="text-xs font-bold text-gray-400 text-right" style={{ width: 54 }}>COUNT</Text>
      <Text className="text-xs font-bold text-gray-400 text-right" style={{ width: 74 }}>SELL</Text>
      <Text className="text-xs font-bold text-gray-400 text-right" style={{ width: 74 }}>PRIZE</Text>
    </View>
    {rows.map((item, idx) => {
      const rowKey = `${keyPrefix}-${idx}`;
      const isOpen = expandedKeys[rowKey] ?? defaultOpen;
      return (
        <View key={rowKey} style={{ borderBottomWidth: idx < rows.length - 1 ? 1 : 0, borderBottomColor: '#f1f5f9' }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onToggle(rowKey)}
            className="flex-row px-4 py-3 items-center"
            style={{ backgroundColor: idx % 2 === 0 ? '#fff' : '#fafbfc' }}
          >
            <View className="flex-1 flex-row items-center">
              {isOpen ? (
                <ChevronDown size={14} color="#94a3b8" strokeWidth={2.5} />
              ) : (
                <ChevronRight size={14} color="#94a3b8" strokeWidth={2.5} />
              )}
              <Text className="text-sm font-semibold text-gray-800 ml-1">
                {item?.draw_name || item?.name || item?.time || ''}
              </Text>
            </View>
            <Text className="text-sm font-semibold text-gray-500 text-right" style={{ width: 54 }}>
              {fmt(item?.breakdown?.total?.count)}
            </Text>
            <Text className="text-sm font-bold text-gray-900 text-right" style={{ width: 74 }}>
              {fmt(item?.sell ?? item?.total_sell)}
            </Text>
            <Text className="text-sm font-bold text-right" style={{ width: 74, color: '#b45309' }}>
              {fmt(item?.price ?? item?.total_price)}
            </Text>
          </TouchableOpacity>
          {isOpen && (
            <View style={{ backgroundColor: '#fbfcfe', borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
              <BreakdownTable breakdown={item?.breakdown} />
            </View>
          )}
        </View>
      );
    })}
  </View>
);

const Report = () => {
  const local = useLocalSearchParams();
  const navigation = useNavigation();
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'day' | 'range'>('day');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [rangeStart, setRangeStart] = useState(() => addDays(new Date(), -6));
  const [rangeEnd, setRangeEnd] = useState(new Date());
  const [picker, setPicker] = useState<null | 'day' | 'start' | 'end'>(null);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const id = Array.isArray(local?.id)
    ? local.id[0] || ""
    : local?.id || "";

  const { user } = useAuthStore();

  const isRangeMode = mode === 'range';

  const {
    data,
    isLoading,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: isRangeMode
      ? ["sales-report", id, "range", formatDateYMD(rangeStart), formatDateYMD(rangeEnd)]
      : ["sales-report", id, "day", formatDateYMD(selectedDate)],
    queryFn: async () => {
      const body: any = { dealer_id: id };
      if (isRangeMode) {
        body.start_date = formatDateYMD(rangeStart);
        body.end_date = formatDateYMD(rangeEnd);
      } else {
        body.date = formatDateYMD(selectedDate);
      }
      const res = await api.post("/draw-result/sales-report-api/", body);
      return res.data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (data?.dealer_name) {
      navigation.setOptions({ title: `Report (${data.dealer_name})` });
    }
  }, [data?.dealer_name, navigation]);

  const toggleRow = (key: string) =>
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));

  const toggleDay = (key: string) =>
    setExpandedDays((prev) => ({ ...prev, [key]: !prev[key] }));

  const onDateChange = (event: any, date?: Date) => {
    const which = picker;
    setPicker(null);
    if (!date || event?.type === 'dismissed') return;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const clamped = date > today ? new Date() : date;

    if (which === 'day') {
      setSelectedDate(clamped);
    } else if (which === 'start') {
      setRangeStart(clamped);
      if (clamped > rangeEnd) setRangeEnd(clamped);
    } else if (which === 'end') {
      setRangeEnd(clamped);
      if (clamped < rangeStart) setRangeStart(clamped);
    }
  };

  const goToPrevDay = () => setSelectedDate(addDays(selectedDate, -1));

  const goToNextDay = () => {
    const d = addDays(selectedDate, 1);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d <= today) {
      setSelectedDate(d);
    }
  };

  const applyPreset = (days: number | 'month') => {
    const today = new Date();
    if (days === 'month') {
      setRangeStart(new Date(today.getFullYear(), today.getMonth(), 1));
      setRangeEnd(today);
      return;
    }
    setRangeStart(addDays(today, -(days - 1)));
    setRangeEnd(today);
  };

  const isToday = formatDateYMD(selectedDate) === formatDateYMD(new Date());

  const pickerValue =
    picker === 'start' ? rangeStart : picker === 'end' ? rangeEnd : selectedDate;

  if (isLoading && !data) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <View style={{ backgroundColor: '#eef2ff', borderRadius: 20, padding: 20 }}>
          <ActivityIndicator size="large" color="#4f46e5" />
        </View>
        <Text className="mt-4 text-gray-500 font-semibold">Loading report...</Text>
      </SafeAreaView>
    );
  }

  if (error && !data) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center px-6">
        <View className="bg-red-50 rounded-2xl p-6 items-center" style={{ borderWidth: 1, borderColor: '#fecaca' }}>
          <Text className="text-red-600 font-bold text-base">Failed to load report</Text>
          <Text className="text-red-400 text-sm mt-1">
            {(error as any)?.response?.data?.error || 'Please try again later'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const {
    dealer_name,
    date_display,
    sales_details = [],
    breakdown,
    reports = [],
    admin_bank_account_details,
    summary,
  } = data || {};

  const dayReports: DayReport[] = reports || [];

  const buildBreakdownLines = (bd?: Breakdown, indent = '   ') => {
    let text = '';
    for (const row of visibleBuckets(bd)) {
      const count = fmt(row.bucket?.count);
      const amount = fmt(row.bucket?.amount);
      const prefix = row.indent ? `${indent}  ` : indent;
      // Mirrors how the counts are read out: `Single = 140*10.5=1470` when every
      // number went at the same rate, otherwise just the count and the total.
      const value = row.bucket?.rate != null
        ? `${count}*${fmtRate(row.bucket.rate)}${amount ? `=${amount}` : ''}`
        : `${count} nos${amount ? ` = ${amount}` : ''}`;
      text += `${prefix}${row.label} = ${value}\n`;
    }
    return text;
  };

  const buildDayBlock = (report: DayReport) => {
    let text = '';
    const rows = report?.sales_details || [];

    text += `🕒 Sales Details:\n\n`;
    if (rows.length > 0) {
      for (const item of rows) {
        const name = item?.draw_name || item?.name || item?.time || '';
        const sell = fmt(item?.sell ?? item?.total_sell);
        const price = fmt(item?.price ?? item?.total_price);
        text += `${name} | Sell: ${sell}${price ? ` | Prize: ${price}` : ''}\n`;
        text += buildBreakdownLines(item?.breakdown);
      }
    } else {
      text += `No sales\n`;
    }

    const totals = visibleBuckets(report?.breakdown);
    if (totals.length > 0) {
      text += `\n🔢 Number Counts:\n\n`;
      text += buildBreakdownLines(report?.breakdown, '');
      text += `Total = ${fmt(report?.breakdown?.total?.count)}\n`;
    }

    const s = report?.summary;
    text += `\n📌 Summary:\n\n`;
    text += `Total Sell: ${fmt(s?.total_sell)}\n`;
    text += `Total Prize: ${fmt(s?.total_price)}\n`;
    text += `Agent Comm: ${fmt(s?.agent_comm)}\n`;
    text += `Today's Balance: ${fmt(s?.today_balance)}\n`;
    text += `Old Balance: ${fmt(s?.old_balance)}\n`;
    text += `Received Amount: ${fmt(s?.received_amount)}\n`;
    text += `Paid Amount: ${fmt(s?.paid_amount)}\n`;
    text += `Total Balance: ${fmt(s?.total_balance)}\n`;

    return text;
  };

  const buildCopyText = () => {
    let text = '';

    if (isRangeMode) {
      text += `📊 SALES REPORT – ${date_display || ''}\n\n`;
      text += `👤 Name: ${dealer_name || ''}\n\n`;

      if (dayReports.length === 0) {
        text += `No sales in this period.\n`;
      }

      for (const report of dayReports) {
        text += `====================================\n`;
        text += `📅 ${report?.date_display || report?.date || ''}\n`;
        text += `====================================\n`;
        text += buildDayBlock(report);
        text += `\n`;
      }

      text += `####################################\n`;
      text += `🧾 PERIOD TOTAL (${date_display || ''})\n`;
      text += `####################################\n\n`;
      text += buildDayBlock({ sales_details, breakdown, summary });
      text += `\n`;
    } else {
      const report: DayReport = dayReports[0] || { sales_details, breakdown, summary };
      text += `📊 DAILY SALES REPORT – ${date_display || ''}\n\n`;
      text += `👤 Name: ${dealer_name || ''}\n\n`;
      text += buildDayBlock(report);
      text += `\n`;
    }

    text += `------------------------------------\n`;
    if (admin_bank_account_details) {
      text += `${admin_bank_account_details}\n`;
    }

    return text;
  };

  const handleCopy = () => {
    const text = buildCopyText();
    Clipboard.setString(text);
    if (Platform.OS === 'android') {
      ToastAndroid.show(
        isRangeMode ? `Copied ${dayReports.length} day report(s)!` : 'Report copied!',
        ToastAndroid.SHORT,
      );
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = buildCopyText();
    const encoded = encodeURIComponent(text);
    Linking.openURL(`whatsapp://send?text=${encoded}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 pb-10">
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            colors={["#4f46e5"]}
            tintColor="#4f46e5"
          />
        }
      >
        {/* Header */}
        <View className="px-4 pt-4 pb-2 flex-row items-center justify-center">
          {isFetching && (
            <Text className='text-center'>Refershing...</Text>
          )}
        </View>

        {/* A failed refetch (e.g. a range the server rejects) keeps the previous
            data on screen, so surface the reason inline. */}
        {!!error && !!data && (
          <View className="px-4 mb-3">
            <View className="rounded-xl px-4 py-3" style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' }}>
              <Text className="text-xs font-semibold text-red-600">
                {(error as any)?.response?.data?.error || 'Could not load this report'}
              </Text>
            </View>
          </View>
        )}

        {/* Single day / date range switch */}
        <View className="px-4 mb-3">
          <View
            className="flex-row rounded-2xl p-1"
            style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' }}
          >
            {([['day', 'Single Day'], ['range', 'Date Range']] as const).map(([value, label]) => {
              const active = mode === value;
              return (
                <TouchableOpacity
                  key={value}
                  onPress={() => setMode(value)}
                  activeOpacity={0.8}
                  className="flex-1 items-center py-2.5 rounded-xl"
                  style={active ? { backgroundColor: '#4f46e5' } : undefined}
                >
                  <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-gray-500'}`}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Date picker row */}
        {!isRangeMode ? (
          <View className="px-4 mb-3">
            <View
              className="flex-row items-center rounded-2xl px-2 py-2"
              style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' }}
            >
              <TouchableOpacity
                onPress={goToPrevDay}
                activeOpacity={0.7}
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
                }}
              >
                <Text className="text-lg font-bold text-gray-700">‹</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPicker('day')}
                activeOpacity={0.8}
                className="flex-1 mx-2 items-center py-2.5 rounded-xl"
                style={{ backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
              >
                <Text className="text-base font-bold text-gray-800">
                  {formatDateDisplay(selectedDate)}
                </Text>
                {isToday && (
                  <View className="mt-1 px-2.5 py-0.5 rounded-full" style={{ backgroundColor: '#eef2ff' }}>
                    <Text className="text-[10px] font-bold" style={{ color: '#4f46e5' }}>TODAY</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={goToNextDay}
                activeOpacity={0.7}
                disabled={isToday}
                style={{
                  width: 44, height: 44, borderRadius: 12,
                  backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
                  opacity: isToday ? 0.3 : 1,
                  shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
                }}
              >
                <Text className="text-lg font-bold text-gray-700">›</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View className="px-4 mb-3">
            <View
              className="rounded-2xl px-2 py-2"
              style={{ backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' }}
            >
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() => setPicker('start')}
                  activeOpacity={0.8}
                  className="flex-1 items-center py-2.5 rounded-xl"
                  style={{ backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
                >
                  <Text className="text-[10px] font-bold text-gray-400">FROM</Text>
                  <Text className="text-sm font-bold text-gray-800 mt-0.5">{formatDateShort(rangeStart)}</Text>
                </TouchableOpacity>

                <Text className="mx-2 text-gray-400 font-bold">→</Text>

                <TouchableOpacity
                  onPress={() => setPicker('end')}
                  activeOpacity={0.8}
                  className="flex-1 items-center py-2.5 rounded-xl"
                  style={{ backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 }}
                >
                  <Text className="text-[10px] font-bold text-gray-400">TO</Text>
                  <Text className="text-sm font-bold text-gray-800 mt-0.5">{formatDateShort(rangeEnd)}</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row mt-2 gap-2">
                {([[7, 'Last 7 days'], [30, 'Last 30 days'], ['month', 'This month']] as const).map(
                  ([preset, label]) => (
                    <TouchableOpacity
                      key={String(preset)}
                      onPress={() => applyPreset(preset as any)}
                      activeOpacity={0.8}
                      className="flex-1 items-center py-2 rounded-xl"
                      style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }}
                    >
                      <Text className="text-[10px] font-bold text-gray-600">{label}</Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>
            </View>
          </View>
        )}

        {picker && (
          <DateTimePicker
            value={pickerValue}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onDateChange}
            maximumDate={new Date()}
          />
        )}

        {/* Action buttons */}
        <View className="px-4 mb-3">
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={handleCopy}
              activeOpacity={0.75}
              disabled={!data}
              className="flex-1 flex-row items-center justify-center py-3 rounded-xl"
              style={{
                backgroundColor: copied ? '#059669' : '#4f46e5',
                opacity: !data ? 0.4 : 1,
              }}
            >
              {copied ? (
                <Check size={16} color="#fff" strokeWidth={3} />
              ) : (
                <Copy size={16} color="#fff" strokeWidth={2.5} />
              )}
              <Text className="text-white font-bold text-sm ml-2">
                {copied ? 'Copied!' : isRangeMode ? 'Copy All' : 'Copy'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleWhatsAppShare}
              activeOpacity={0.75}
              disabled={!data}
              className="flex-1 flex-row items-center justify-center py-3 rounded-xl"
              style={{
                backgroundColor: '#25D366',
                opacity: !data ? 0.4 : 1,
              }}
            >
              <Share2 size={16} color="#fff" strokeWidth={2.5} />
              <Text className="text-white font-bold text-sm ml-2">
                WhatsApp
              </Text>
            </TouchableOpacity>
          </View>
          {isRangeMode && (
            <Text className="text-[10px] text-gray-400 mt-2 text-center">
              Exports every day in {date_display || 'the range'} ({dayReports.length} day
              {dayReports.length === 1 ? '' : 's'} with sales) plus the period total
            </Text>
          )}
        </View>

        {/* Sales Details (period aggregate) */}
        {sales_details && sales_details.length > 0 && (
          <View className="px-4 mb-3">
            <SalesDetailsCard
              title={isRangeMode ? `Sales Details — ${date_display || 'Period'} total` : 'Sales Details'}
              rows={sales_details}
              expandedKeys={expandedKeys}
              onToggle={toggleRow}
              keyPrefix="period"
              defaultOpen
            />
          </View>
        )}

        {/* Number counts for the whole period / day */}
        <View className="px-4 mb-3">
          <View
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
          >
            <View className="px-4 py-3" style={{ backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
              <Text className="text-sm font-bold text-gray-700">Number Counts</Text>
              <Text className="text-[10px] text-gray-400 mt-0.5">
                Super and Box are part of the 3-Digit total
              </Text>
            </View>
            <BreakdownTable breakdown={breakdown} />
          </View>
        </View>

        {/* Per-day reports (range mode) */}
        {isRangeMode && dayReports.length > 0 && (
          <View className="px-4 mb-3">
            <Text className="text-xs font-bold text-gray-400 mb-2">DAY BY DAY</Text>
            {dayReports.map((report) => {
              const dayKey = report?.date || String(report?.date_display);
              const isOpen = !!expandedDays[dayKey];
              return (
                <View
                  key={dayKey}
                  className="rounded-2xl overflow-hidden mb-2"
                  style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' }}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toggleDay(dayKey)}
                    className="flex-row items-center px-4 py-3"
                    style={{ backgroundColor: '#f8fafc' }}
                  >
                    {isOpen ? (
                      <ChevronDown size={16} color="#64748b" strokeWidth={2.5} />
                    ) : (
                      <ChevronRight size={16} color="#64748b" strokeWidth={2.5} />
                    )}
                    <Text className="text-sm font-bold text-gray-800 ml-1.5 flex-1">
                      {report?.date_display || report?.date}
                    </Text>
                    <Text className="text-xs font-semibold text-gray-500 mr-3">
                      {fmt(report?.breakdown?.total?.count)} nos
                    </Text>
                    <Text className="text-sm font-bold" style={{ color: '#4f46e5' }}>
                      {fmtCurrency(report?.summary?.total_sell)}
                    </Text>
                  </TouchableOpacity>

                  {isOpen && (
                    <View className="px-3 py-3">
                      {(report?.sales_details || []).length > 0 && (
                        <View className="mb-3">
                          <SalesDetailsCard
                            title="Sales Details"
                            rows={report?.sales_details || []}
                            expandedKeys={expandedKeys}
                            onToggle={toggleRow}
                            keyPrefix={`day-${dayKey}`}
                          />
                        </View>
                      )}
                      <View
                        className="rounded-2xl overflow-hidden mb-3"
                        style={{ borderWidth: 1, borderColor: '#e2e8f0' }}
                      >
                        <View className="px-3 py-2" style={{ backgroundColor: '#f8fafc' }}>
                          <Text className="text-xs font-bold text-gray-700">Number Counts</Text>
                        </View>
                        <BreakdownTable breakdown={report?.breakdown} />
                      </View>
                      <View className="px-1">
                        <SummaryRow label="Total Sell" value={fmtCurrency(report?.summary?.total_sell)} color="#4f46e5" />
                        <SummaryRow label="Total Prize" value={fmtCurrency(report?.summary?.total_price)} color="#b45309" />
                        <SummaryRow label="Agent Commission" value={fmtCurrency(report?.summary?.agent_comm)} />
                        <SummaryRow label="Day Balance" value={fmtCurrency(report?.summary?.today_balance)} />
                        <SummaryRow label="Received Amount" value={fmtCurrency(report?.summary?.received_amount)} color="#047857" />
                        <SummaryRow label="Paid Amount" value={fmtCurrency(report?.summary?.paid_amount)} color="#dc2626" />
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Summary */}
        <View className="px-4 mb-3">
          <View
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
          >
            <View className="px-4 py-3" style={{ backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
              <Text className="text-sm font-bold text-gray-700">
                {isRangeMode ? `Summary — ${date_display || 'Period'}` : 'Summary'}
              </Text>
            </View>
            <View className="px-4">
              <SummaryRow label="Total Sell" value={fmtCurrency(summary?.total_sell)} color="#4f46e5" />
              <SummaryRow label="Total Prize" value={fmtCurrency(summary?.total_price)} color="#b45309" />
              <SummaryRow label="Agent Commission" value={fmtCurrency(summary?.agent_comm)} />
              <SummaryRow label={isRangeMode ? "Period Balance" : "Today's Balance"} value={fmtCurrency(summary?.today_balance)} />
              <SummaryRow label="Old Balance" value={fmtCurrency(summary?.old_balance)} />
              <SummaryRow label="Received Amount" value={fmtCurrency(summary?.received_amount)} color="#047857" />
              <SummaryRow label="Paid Amount" value={fmtCurrency(summary?.paid_amount)} color="#dc2626" />
            </View>
            <View className="mx-4 my-3 rounded-xl px-4 py-3" style={{ backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' }}>
              <View className="flex-row justify-between items-center">
                <Text className="text-sm font-bold text-gray-700">Total Balance</Text>
                <Text className="text-lg font-extrabold" style={{ color: '#047857' }}>
                  {fmtCurrency(summary?.total_balance)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Bank details */}
        {admin_bank_account_details && (
          <View className="px-4 mb-3">
            <View
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
            >
              <View className="px-4 py-3" style={{ backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }}>
                <Text className="text-sm font-bold text-gray-700">Bank Account Details</Text>
              </View>
              <View className="px-4 py-3">
                <Text className="text-sm text-gray-700 leading-5">
                  {admin_bank_account_details}
                </Text>
              </View>
            </View>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

export default Report;
