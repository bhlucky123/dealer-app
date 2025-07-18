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
  const [refreshing, setRefreshing] = useState(false);

  const buildQuery = () => {
    const params: Record<string, any> = {};
    if (fromDate) params.date_time__gte = fromDate.toISOString().split("T")[0];
    if (toDate) params.date_time__lte = toDate.toISOString().split("T")[0];
    if (selectedDraw?.id && !allGames) params.draw_session__draw__id = selectedDraw.id;
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
    <View className="flex-row bg-gray-100 border-b border-gray-200 py-2">
      {cols.map((col) => (
        <Text key={col} className="flex-1 text-xs font-semibold text-center text-gray-700 uppercase">
          {col}
        </Text>
      ))}
    </View>
  );

  const renderSummaryRow = (item: any, isTotal = false) => (
    <View
      key={isTotal ? "summary-total" : item.draw + (item.agent?.username || "")}
      className={`flex-row py-2 border-b border-gray-100 ${isTotal ? "bg-gray-100" : "bg-white"}`}
    >
      <Text className="flex-1 text-xs text-center text-gray-800">
        {isTotal ? "Total" : item.agent?.username || item.dealer?.username || "-"}
      </Text>
      <Text className="flex-1 text-xs text-center text-gray-800">{item.draw}</Text>
      <Text className="flex-1 text-xs text-center text-gray-800">{item.total_amount}</Text>
      <Text className="flex-1 text-xs text-center text-gray-800">{item.total_win || 0}</Text>
    </View>
  );

  const renderDetailRow = (item: any, isTotal = false) => (
    <View
      key={isTotal ? "detail-total" : item.date + item.draw + item.agent?.username}
      className={`flex-row py-2 border-b border-gray-100 ${isTotal ? "bg-gray-100" : "bg-white"}`}
    >
      <Text className="flex-1 text-xs text-center text-gray-800">
        {isTotal ? "Total" : item.date}
      </Text>
      <Text className="flex-1 text-xs text-center text-gray-800">
        {item.agent?.username || item.dealer?.username || "-"}
      </Text>
      <Text className="flex-1 text-xs text-center text-gray-800">{item.draw}</Text>
      <Text className="flex-1 text-xs text-center text-gray-800">{item.total_amount}</Text>
      <Text className="flex-1 text-xs text-center text-gray-800">{item.total_win || 0}</Text>
    </View>
  );

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
      {/* Filter section */}
      <View className="px-4 pt-4 space-y-4">
        <View className="flex-row gap-3">
          {[{ label: "FROM", date: fromDate, show: setShowFromPicker }, { label: "TO", date: toDate, show: setShowToPicker }].map(
            ({ label, date, show }) => (
              <TouchableOpacity
                key={label}
                onPress={() => show(true)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 flex-row justify-between items-center bg-white"
                activeOpacity={0.7}
                style={{ elevation: 0 }}
              >
                <Text className="text-sm text-gray-600">
                  {date ? date.toLocaleDateString() : label}
                </Text>
                <Calendar size={16} color="#6B7280" />
              </TouchableOpacity>
            )
          )}
        </View>

        <TouchableOpacity
          onPress={() => setAllGames((prev) => !prev)}
          className="flex-row items-center gap-2 mt-2"
          activeOpacity={0.7}
        >
          <View
            className={`w-4 h-4 rounded border ${allGames ? "bg-green-600 border-green-600" : "border-gray-400"} `}
            style={{ elevation: 0 }}
          />
          <Text className="text-sm text-gray-700">All Games</Text>
        </TouchableOpacity>
      </View>

      {/* Loading state */}
      {isLoading && (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <View className="flex-1 justify-center items-center px-4">
          <Text className="text-red-600 text-center text-sm font-semibold">
            {error?.message || "Failed to fetch report."}
          </Text>
          <TouchableOpacity
            onPress={() => refetch()}
            className="mt-4 px-4 py-2 bg-green-600 rounded"
            activeOpacity={0.7}
            style={{ elevation: 0 }}
          >
            <Text className="text-white font-semibold text-sm">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Report content */}
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
          {/* Summary Table */}
          <View className="border border-gray-200 rounded-lg overflow-hidden bg-white" style={{ elevation: 0 }}>
            <Text className="bg-gray-100 px-3 py-2 font-bold text-sm border-b border-gray-200">SUMMARY</Text>
            {renderTableHeader(["SUBDEALER", "GAME", "SALE", "WIN"])}
            {data?.summary?.map((item: any) => renderSummaryRow(item))}
            {data?.summary &&
              renderSummaryRow(
                data.summary.reduce(
                  (acc: any, cur: any) => ({
                    total_amount: (acc.total_amount || 0) + cur.total_amount,
                    total_win: (acc.total_win || 0) + (cur.total_win || 0),
                  }),
                  {}
                ),
                true
              )}
          </View>

          {/* Detailed Table */}
          <View className="border border-gray-200 rounded-lg mt-6 overflow-hidden bg-white" style={{ elevation: 0 }}>
            <Text className="bg-gray-100 px-3 py-2 font-bold text-sm border-b border-gray-200">DETAILED</Text>
            {renderTableHeader(["DATE", "SUBDEALER", "GAME", "SALE", "WIN"])}
            {data?.report?.map((item: any) => renderDetailRow(item))}
            {data?.report &&
              renderDetailRow(
                data.report.reduce(
                  (acc: any, cur: any) => ({
                    total_amount: (acc.total_amount || 0) + cur.total_amount,
                    total_win: (acc.total_win || 0) + (cur.total_win || 0),
                  }),
                  {}
                ),
                true
              )}
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
