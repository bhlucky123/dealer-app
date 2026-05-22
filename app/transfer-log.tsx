import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TransferLog = {
  id: number;
  from_vendor: number;
  to_vendor: number;
  from_vendor_name?: string;
  to_vendor_name?: string;
  draw_name?: string;
  session_date?: string;
  number: string;
  count: number;
  type: string;
  sub_type: string;
  transferred_at: string;
};

type RecallLog = {
  id: number;
  from_vendor: number;
  to_vendor: number;
  from_vendor_name?: string;
  to_vendor_name?: string;
  draw_name?: string;
  session_date?: string;
  number: string;
  recalled_count: number;
  original_transferred_count: number;
  type: string;
  sub_type: string;
  recalled_at: string;
};

type Tab = "transfers" | "recalls";

const TYPE_LABEL: Record<string, string> = {
  single_digit: "Single",
  double_digit: "Double",
  triple_digit: "Triple",
};

function fmtTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

const TransferLogScreen = () => {
  const { selectedDraw } = useDrawStore();
  const [tab, setTab] = useState<Tab>("transfers");

  const {
    data: rawTransfers,
    isLoading: loadingTransfers,
    isFetching: fetchingTransfers,
    error: transferError,
    refetch: refetchTransfers,
  } = useQuery<TransferLog[] | { results: TransferLog[] }>({
    queryKey: ["transfer-log", selectedDraw?.id],
    queryFn: () =>
      api
        .get("/draw-monitoring/transfer-log/", {
          params: { draw_session__draw__id: selectedDraw?.id },
        })
        .then((r) => r.data),
    enabled: !!selectedDraw?.id,
  });

  const {
    data: rawRecalls,
    isLoading: loadingRecalls,
    isFetching: fetchingRecalls,
    error: recallError,
    refetch: refetchRecalls,
  } = useQuery<RecallLog[] | { results: RecallLog[] }>({
    queryKey: ["recall-log", selectedDraw?.id],
    queryFn: () =>
      api
        .get("/draw-monitoring/recall-log/", {
          params: { draw_session__draw__id: selectedDraw?.id },
        })
        .then((r) => r.data),
    enabled: !!selectedDraw?.id,
  });

  const transfers: TransferLog[] = useMemo(() => {
    if (Array.isArray(rawTransfers)) return rawTransfers;
    const r = (rawTransfers as any)?.results;
    return Array.isArray(r) ? r : [];
  }, [rawTransfers]);

  const recalls: RecallLog[] = useMemo(() => {
    if (Array.isArray(rawRecalls)) return rawRecalls;
    const r = (rawRecalls as any)?.results;
    return Array.isArray(r) ? r : [];
  }, [rawRecalls]);

  const totalTransferCount = transfers.reduce((s, i) => s + (i?.count ?? 0), 0);
  const totalRecallCount = recalls.reduce((s, i) => s + (i?.recalled_count ?? 0), 0);

  const isLoading = tab === "transfers" ? loadingTransfers : loadingRecalls;
  const isFetching = tab === "transfers" ? fetchingTransfers : fetchingRecalls;
  const error = tab === "transfers" ? transferError : recallError;
  const refetch = tab === "transfers" ? refetchTransfers : refetchRecalls;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["bottom"]}>
      <View className="flex-1 p-4">
        {/* Header summary */}
        <View className="mb-3 flex-row items-center gap-2">
          <View className="flex-1 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5">
            <Text className="text-[10px] text-violet-500 font-semibold uppercase">
              Draw
            </Text>
            <Text
              className="text-violet-900 font-bold text-sm mt-0.5"
              numberOfLines={1}
            >
              {selectedDraw?.name || "—"}
            </Text>
          </View>
          {!isLoading && (tab === "transfers" ? transfers.length > 0 : recalls.length > 0) && (
            <View className="bg-gray-100 rounded-xl px-3 py-2.5">
              <Text className="text-[10px] text-gray-500 font-semibold uppercase">
                {tab === "transfers" ? "Transfers" : "Recalls"}
              </Text>
              <Text className="text-gray-800 font-bold text-sm mt-0.5">
                {tab === "transfers"
                  ? `${transfers.length} · ${totalTransferCount}`
                  : `${recalls.length} · ${totalRecallCount}`}
              </Text>
            </View>
          )}
        </View>

        {/* Tab switcher */}
        <View className="flex-row mb-3 bg-gray-100 rounded-xl p-1">
          <TouchableOpacity
            onPress={() => setTab("transfers")}
            className={`flex-1 py-2 rounded-lg items-center ${
              tab === "transfers" ? "bg-white shadow-sm" : ""
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                tab === "transfers" ? "text-violet-700" : "text-gray-500"
              }`}
            >
              Transfers
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("recalls")}
            className={`flex-1 py-2 rounded-lg items-center ${
              tab === "recalls" ? "bg-white shadow-sm" : ""
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                tab === "recalls" ? "text-orange-600" : "text-gray-500"
              }`}
            >
              Recalls
            </Text>
          </TouchableOpacity>
        </View>

        {!selectedDraw?.id ? (
          <View className="flex-1 justify-center items-center">
            <Text className="text-base text-gray-500">
              No draw selected. Please choose one.
            </Text>
          </View>
        ) : isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={tab === "transfers" ? "#7c3aed" : "#ea580c"} />
            <Text className="mt-3 text-gray-600">
              Loading {tab === "transfers" ? "transfers" : "recalls"}...
            </Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center">
            <View className="bg-red-50 border border-red-200 px-6 py-8 rounded-xl items-center shadow w-full">
              <Text className="text-red-700 font-bold text-lg mb-2">
                Failed to load {tab === "transfers" ? "transfers" : "recalls"}
              </Text>
              <TouchableOpacity
                onPress={() => refetch()}
                className="bg-violet-600 px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-semibold">Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : tab === "transfers" ? (
          <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
            <View className="flex-row bg-violet-50 border-b border-violet-100 px-3 py-2.5">
              <Text className="flex-[1.2] text-[10px] font-bold text-violet-700 uppercase">
                When
              </Text>
              <Text className="flex-[2] text-[10px] font-bold text-violet-700 uppercase">
                To
              </Text>
              <Text className="flex-[1] text-[10px] font-bold text-violet-700 uppercase text-center">
                Number
              </Text>
              <Text className="w-12 text-[10px] font-bold text-violet-700 uppercase text-right">
                Cnt
              </Text>
            </View>
            <FlatList
              data={transfers}
              keyExtractor={(i) => String(i.id)}
              renderItem={({ item, index }) => (
                <View
                  className="flex-row items-center px-3 py-3 border-b border-gray-100"
                  style={{
                    backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                  }}
                >
                  <View className="flex-[1.2]">
                    <Text className="text-[11px] font-semibold text-gray-800">
                      {fmtDate(item.session_date || item.transferred_at)}
                    </Text>
                    <Text className="text-[10px] text-gray-400 mt-0.5">
                      {fmtTime(item.transferred_at)}
                    </Text>
                  </View>
                  <View className="flex-[2] pr-2">
                    <Text
                      className="text-[12px] font-semibold text-gray-800"
                      numberOfLines={1}
                    >
                      {item.to_vendor_name || `#${item.to_vendor}`}
                    </Text>
                    <Text className="text-[9px] text-gray-400 mt-0.5">
                      {TYPE_LABEL[item.type] || item.type} · {item.sub_type}
                    </Text>
                  </View>
                  <Text className="flex-[1] text-[13px] text-center font-bold text-gray-900 tracking-wider">
                    {item.number}
                  </Text>
                  <Text className="w-12 text-right text-[13px] font-bold text-red-600">
                    ×{item.count}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <View className="py-16 items-center">
                  <Text className="text-gray-500 text-sm">
                    No transfers for this draw.
                  </Text>
                </View>
              }
              refreshControl={
                <RefreshControl
                  refreshing={fetchingTransfers && !loadingTransfers}
                  onRefresh={refetchTransfers}
                  colors={["#7c3aed"]}
                  tintColor="#7c3aed"
                />
              }
            />
          </View>
        ) : (
          <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
            <View className="flex-row bg-orange-50 border-b border-orange-100 px-3 py-2.5">
              <Text className="flex-[1.2] text-[10px] font-bold text-orange-700 uppercase">
                When
              </Text>
              <Text className="flex-[2] text-[10px] font-bold text-orange-700 uppercase">
                From → To
              </Text>
              <Text className="flex-[1] text-[10px] font-bold text-orange-700 uppercase text-center">
                Number
              </Text>
              <Text className="w-12 text-[10px] font-bold text-orange-700 uppercase text-right">
                Cnt
              </Text>
            </View>
            <FlatList
              data={recalls}
              keyExtractor={(i) => String(i.id)}
              renderItem={({ item, index }) => (
                <View
                  className="flex-row items-center px-3 py-3 border-b border-gray-100"
                  style={{
                    backgroundColor: index % 2 === 0 ? "#ffffff" : "#f9fafb",
                  }}
                >
                  <View className="flex-[1.2]">
                    <Text className="text-[11px] font-semibold text-gray-800">
                      {fmtDate(item.session_date || item.recalled_at)}
                    </Text>
                    <Text className="text-[10px] text-gray-400 mt-0.5">
                      {fmtTime(item.recalled_at)}
                    </Text>
                  </View>
                  <View className="flex-[2] pr-2">
                    <Text
                      className="text-[12px] font-semibold text-gray-800"
                      numberOfLines={1}
                    >
                      {item.from_vendor_name || `#${item.from_vendor}`} →{" "}
                      {item.to_vendor_name || `#${item.to_vendor}`}
                    </Text>
                    <Text className="text-[9px] text-gray-400 mt-0.5">
                      {TYPE_LABEL[item.type] || item.type} · {item.sub_type}
                    </Text>
                  </View>
                  <Text className="flex-[1] text-[13px] text-center font-bold text-gray-900 tracking-wider">
                    {item.number}
                  </Text>
                  <Text className="w-12 text-right text-[13px] font-bold text-orange-600">
                    ×{item.recalled_count}
                  </Text>
                </View>
              )}
              ListEmptyComponent={
                <View className="py-16 items-center">
                  <Text className="text-gray-500 text-sm">
                    No recalls for this draw.
                  </Text>
                </View>
              }
              refreshControl={
                <RefreshControl
                  refreshing={fetchingRecalls && !loadingRecalls}
                  onRefresh={refetchRecalls}
                  colors={["#ea580c"]}
                  tintColor="#ea580c"
                />
              }
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default TransferLogScreen;
