import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { Calendar } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const DailyReport = () => {
  const { selectedDraw } = useDrawStore();

  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [allGames, setAllGames] = useState(false);
  const [dayTotal, setDayTotal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const buildQuery = () => {
    const params: Record<string, any> = {};
    if (fromDate) params.date_time__gte = fromDate.toISOString().split("T")[0];
    if (toDate) params.date_time__lte = toDate.toISOString().split("T")[0];
    // if (dayTotal) params.day_total = true;
    if (selectedDraw?.id && !allGames) params.draw_session__draw__id = selectedDraw.id;
    console.log("params", params);

    return params;
  };

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["/draw-booking/daily-report", buildQuery()],
    queryFn: async () => {
      const res = await api.get("/draw-booking/daily-report/", { params: buildQuery() });
      return res.data;
    },
    enabled: !!selectedDraw?.id,
  });

  const renderTableHeader = (cols: string[]) => (
    <View className="flex-row bg-gray-200/70 border-b border-gray-300 py-1">
      {cols.map((c) => (
        <Text
          key={c}
          className="flex-1 text-[9px] font-bold text-center text-gray-700 uppercase tracking-wider"
        >
          {c}
        </Text>
      ))}
    </View>
  );

  const renderSummaryRow = (item: any, isTotal = false) => (
    <View
      className={`flex-row py-1 ${isTotal ? "bg-gray-100" : ""} border-b border-gray-100`}
      key={isTotal ? "summary-total" : item.draw + (item.agent?.username || "")}
    >
      <Text className="flex-1 text-[11px] text-center text-gray-800">
        {isTotal ? "Total" : item.agent?.username || item.dealer?.username || "-"}
      </Text>
      <Text className="flex-1 text-[11px] text-center text-gray-800">{item.draw || ""}</Text>
      <Text className="flex-1 text-[11px] text-center text-gray-800">{item.total_amount}</Text>
      <Text className="flex-1 text-[11px] text-center text-gray-800">{item.total_win || 0}</Text>
      <Text className="flex-1 text-[11px] text-center text-gray-800">
        {(item.total_amount || 0) - (item.total_win || 0)}
      </Text>
    </View>
  );

  const renderDetailRow = (item: any, isTotal = false) => (
    <View
      className={`flex-row py-1 ${isTotal ? "bg-gray-100" : ""} border-b border-gray-100`}
      key={isTotal ? "detail-total" : item.date + item.draw + item.agent?.username}
    >
      <Text className={`flex-1 text-[${isTotal ? '11px' : '9px'}] text-center text-gray-800`}>
        {isTotal ? "Total" : item.date}
      </Text>
      <Text className="flex-1 text-[11px] text-center text-gray-800">
        {isTotal ? "" : item.agent?.username || item.dealer?.username || "-"}
      </Text>
      <Text className="flex-1 text-[11px] text-center text-gray-800">{item.draw}</Text>
      <Text className="flex-1 text-[11px] text-center text-gray-800">{item.total_amount}</Text>
      <Text className="flex-1 text-[11px] text-center text-gray-800">{item.total_win || 0}</Text>
      <Text className="flex-1 text-[11px] text-center text-gray-800">
        {(item.total_amount || 0) - (item.total_win || 0)}
      </Text>
    </View>
  );

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <View className="flex-1 bg-white">

      {/* Filters */}
      <View className="px-4 pt-4 gap-3">
        {/* Dates */}
        <View className="flex-row gap-3">
          {[
            { label: "FROM", date: fromDate, show: setShowFromPicker },
            { label: "TO", date: toDate, show: setShowToPicker },
          ].map(({ label, date, show }, idx) => (
            <TouchableOpacity
              key={label}
              onPress={() => show(true)}
              className="flex-1 border border-gray-400 rounded-lg px-3 py-2 flex-row justify-between items-center"
            >
              <Text className="text-[12px] text-gray-600">{date ? date.toLocaleDateString() : label}</Text>
              <Calendar color="#6B7280" size={16} />
            </TouchableOpacity>
          ))}
        </View>
        {/* Checkboxes */}
        <View className="flex-row items-center justify-between gap-6">
          <View className="flex gap-3">
            <TouchableOpacity
              className="flex-row items-center gap-2"
              onPress={() => setAllGames((p) => !p)}
            >
              <View className={`w-4 h-4 rounded border ${allGames ? "bg-green-600 border-green-600" : "border-gray-500"}`} />
              <Text className="text-gray-700 text-[12px]">All Games</Text>
            </TouchableOpacity>
          </View>
          {/* <TouchableOpacity
            className="flex-row items-center gap-2"
            onPress={() => setDayTotal((p) => !p)}
          >
            <View className={`w-4 h-4 rounded border ${dayTotal ? "bg-green-600 border-green-600" : "border-gray-500"}`} />
            <Text className="text-gray-700 text-[12px]">Day Total</Text>
          </TouchableOpacity> */}
        </View>
      </View>

      {/* Loading */}
      {isLoading && (
        <View className="flex-1 justify-center items-center"><ActivityIndicator /></View>
      )}

      {/* Error */}
      {!isLoading && error && (
        <View className="flex-1 justify-center items-center px-4">
          <Text className="text-red-600 text-center text-[14px] font-semibold">
            {error?.message ? `Error: ${error.message}` : "An error occurred while fetching the report."}
          </Text>
          <TouchableOpacity
            className="mt-4 px-4 py-2 bg-green-600 rounded"
            onPress={() => refetch()}
          >
            <Text className="text-white font-semibold text-[14px]">Refetch</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Data */}
      {!isLoading && !error && (
        <ScrollView
          className="mt-4 px-4"
          refreshControl={
            <RefreshControl
              refreshing={refreshing || isFetching}
              onRefresh={onRefresh}
              colors={["#16a34a"]}
              tintColor="#16a34a"
            />
          }
        >
          {/* SUMMARY */}
          <View className="border border-gray-300 rounded-lg overflow-hidden">
            <Text className="bg-gray-200 px-3 py-1 font-bold text-sm">SUMMARY</Text>
            {renderTableHeader(["SUBDEALER", "GAME", "SALE", "WIN", "BAL"])}
            {data?.summary?.map((s: any) => renderSummaryRow(s))}
            {data?.summary && renderSummaryRow(data.summary.reduce((acc: any, cur: any) => ({
              total_amount: (acc.total_amount || 0) + cur.total_amount,
              total_win: (acc.total_win || 0) + (cur.total_win || 0),
            }), {}), true)}
          </View>

          {/* DETAILED */}
          <View className="border border-gray-300 rounded-lg mt-4 overflow-hidden">
            <Text className="bg-gray-200 px-3 py-1 font-bold text-sm">DETAILED</Text>
            {renderTableHeader(["DATE", "SUBDEALER", "GAME", "SALE", "WIN", "BAL"])}
            {data?.report?.map((d: any) => renderDetailRow(d))}
            {data?.report && renderDetailRow(data.report.reduce((acc: any, cur: any) => ({
              total_amount: (acc.total_amount || 0) + cur.total_amount,
              total_win: (acc.total_win || 0) + (cur.total_win || 0),
            }), {}), true)}
          </View>
        </ScrollView>
      )}

      {/* Date Pickers */}
      {showFromPicker && (
        <DateTimePicker
          value={fromDate || new Date()}
          mode="date"
          display={Platform.OS === "android" ? "default" : "spinner"}
          onChange={(_e, d) => {
            if (d) setFromDate(d);
            setShowFromPicker(false);
          }}
        />
      )}
      {showToPicker && (
        <DateTimePicker
          value={toDate || new Date()}
          mode="date"
          display={Platform.OS === "android" ? "default" : "spinner"}
          onChange={(_e, d) => {
            if (d) setToDate(d);
            setShowToPicker(false);
          }}
        />
      )}
    </View>
  );
};

export default DailyReport;
