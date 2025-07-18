import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import RNPickerSelect from "react-native-picker-select";
import { SafeAreaView } from "react-native-safe-area-context";
import { Agent } from "./(tabs)/agent";

const dummyDetails = {
    // ... (unchanged, omitted for brevity)
};

const getToday = () => {
    const now = new Date();
    // Remove time part for consistency
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

// Helper function to format date as dd/mm/yyyy
const formatDateDDMMYYYY = (date?: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const SalesReportScreen = () => {
    const { selectedDraw } = useDrawStore();
    const [search, setSearch] = useState("");
    // Set default dates to today
    const [fromDate, setFromDate] = useState<Date | null>(getToday());
    const [toDate, setToDate] = useState<Date | null>(getToday());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [fullView, setFullView] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState(""); // renamed from selectedAgent for generality

    const { user } = useAuthStore();

    // --- Queries for agents and dealers ---
    const queryClient = useQueryClient();
    const cachedAgents = queryClient.getQueryData<Agent[]>(["agents"]);
    const cachedDealers = queryClient.getQueryData<Agent[]>(["dealers"]);

    // AGENT list (for DEALER user)
    const {
        data: agents = [],
        isLoading: isAgentLoading,
        isError: isAgentError,
        error: AgentError,
        refetch: agentRefetch,
        isFetching: isAgentFetching,
    } = useQuery<Agent[]>({
        queryKey: ["agents"],
        queryFn: () => api.get("/agent/manage/").then((res) => res.data),
        enabled: user?.user_type === "DEALER" && !cachedAgents,
        initialData: user?.user_type === "DEALER" ? cachedAgents : undefined,
    });

    // DEALER list (for ADMIN user)
    const {
        data: dealers = [],
        isLoading: isDealerLoading,
        isError: isDealerError,
        error: DealerError,
        refetch: dealerRefetch,
        isFetching: isDealerFetching,
    } = useQuery<Agent[]>({
        queryKey: ["dealers"],
        queryFn: () => api.get("/administrator/dealer/").then((res) => res.data),
        enabled: user?.user_type === "ADMIN" && !cachedDealers,
        initialData: user?.user_type === "ADMIN" ? cachedDealers : undefined,
    });

    // --- Build Query ---
    const buildQuery = () => {
        const params: Record<string, string> = {};

        if (search) params["search"] = search;
        if (fromDate) params["date_time__gte"] = fromDate.toISOString();
        if (toDate) params["date_time__lte"] = toDate.toISOString();
        if (fullView) params["full_view"] = "true";
        if (selectedDraw?.id) params["draw_session__draw__id"] = String(selectedDraw.id);

        // Only add filter for ADMIN or DEALER
        if (user?.user_type === "ADMIN" && selectedFilter) {
            params["booked_dealer__id"] = selectedFilter;
        }
        if (user?.user_type === "DEALER" && selectedFilter) {
            params["booked_agent__id"] = selectedFilter;
        }
        // AGENT: no filter

        // console.log("params", params);

        return Object.keys(params)
            .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
            .join("&");
    };

    const { data, isLoading, error } = useQuery({
        queryKey: ["/draw-booking/sales-report/", buildQuery()],
        queryFn: async () => {
            const res = await api.get(`/draw-booking/sales-report/?${buildQuery()}`);
            return res.data;
        },
        enabled: !!selectedDraw?.id,
    });

    // Determine if we should show the total footer
    const shouldShowTotalFooter = !!selectedDraw?.id && !isLoading && !error && data;
    

    // --- Render ---
    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 p-4">
                {/* Filters */}
                <View className="gap-3">
                    <TextInput
                        placeholder="Search by Bill No."
                        value={search}
                        keyboardType="numeric"
                        onChangeText={setSearch}
                        className="border border-gray-300 rounded-lg px-4 py-3 text-base focus:border-violet-500"
                        placeholderTextColor="#9ca3af"
                    />

                    {/* Date Filters with Labels */}
                    <View>
                        <View className="flex-row gap-3">
                            <View className="flex-1">
                                <Text className="text-xs text-gray-500 mb-1">From</Text>
                                <TouchableOpacity
                                    onPress={() => setShowFromPicker(true)}
                                    className="border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                                >
                                    <Text
                                        className={fromDate ? "text-gray-900 font-medium" : "text-gray-500"}
                                    >
                                        {fromDate ? formatDateDDMMYYYY(fromDate) : "Select Date"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View className="flex-1">
                                <Text className="text-xs text-gray-500 mb-1">To</Text>
                                <TouchableOpacity
                                    onPress={() => setShowToPicker(true)}
                                    className="border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                                >
                                    <Text
                                        className={toDate ? "text-gray-900 font-medium" : "text-gray-500"}
                                    >
                                        {toDate ? formatDateDDMMYYYY(toDate) : "Select Date"}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Conditional filter: ADMIN = dealer picker, DEALER = agent picker, AGENT = none */}
                    {user?.user_type === "ADMIN" && (
                        <RNPickerSelect
                            onValueChange={setSelectedFilter}
                            items={[
                                ...dealers.map((dealer) => ({
                                    label: dealer.username,
                                    value: dealer.id,
                                    key: dealer.id.toString(),
                                })),
                            ]}
                            value={selectedFilter}
                            style={{
                                viewContainer: {
                                    borderColor: "#9ca3af",
                                    borderWidth: 1,
                                    borderRadius: 6,
                                },
                                placeholder: {
                                    color: "#374151"
                                }
                            }}
                            placeholder={{ label: "Select Dealer", value: null }}
                            Icon={() =>
                                selectedFilter !== null && selectedFilter !== "" ? (
                                    <TouchableOpacity
                                        onPress={() => setSelectedFilter("")}
                                        style={{ position: "absolute", right: 10, top: 12, zIndex: 10 }}
                                        className="bg-white w-10 h-10 flex items-center"
                                    >
                                        <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
                                    </TouchableOpacity>
                                ) : null
                            }
                        />
                    )}
                    {user?.user_type === "DEALER" && (
                        <RNPickerSelect
                            onValueChange={setSelectedFilter}
                            items={[
                                ...agents.map((agent) => ({
                                    label: agent.username,
                                    value: agent.id,
                                    key: agent.id.toString(),
                                })),
                            ]}
                            value={selectedFilter}
                            style={{
                                viewContainer: {
                                    borderColor: "#9ca3af",
                                    borderWidth: 1,
                                    borderRadius: 6,
                                },
                                placeholder: {
                                    color: "#374151"
                                }
                            }}
                            placeholder={{ label: "Select Agent", value: null }}
                            Icon={() =>
                                selectedFilter !== null && selectedFilter !== "" ? (
                                    <TouchableOpacity
                                        onPress={() => setSelectedFilter("")}
                                        style={{ position: "absolute", right: 10, top: 12, zIndex: 10 }}
                                        className="bg-white w-10 h-10 flex items-center"
                                    >
                                        <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
                                    </TouchableOpacity>
                                ) : null
                            }
                        />
                    )}
                    {/* AGENT: no filter picker */}

                    <View className="flex-row items-center justify-between px-1 pt-1">
                        <Text className="text-sm text-gray-700">Full View</Text>
                        <Switch
                            value={fullView}
                            onValueChange={setFullView}
                            trackColor={{ false: "#e5e7eb", true: "#a78bfa" }}
                            thumbColor={fullView ? "#7c3aed" : "#f4f3f4"}
                            ios_backgroundColor="#e5e7eb"
                        />
                    </View>
                </View>

                {/* --- Main Content Area --- */}
                {!selectedDraw?.id ? (
                    <View className="flex-1 justify-center items-center">
                        <Text className="text-base text-gray-500">
                            No draw selected. Please choose one.
                        </Text>
                    </View>
                ) : isLoading ? (
                    <View className="flex-1 justify-center items-center">
                        <ActivityIndicator size="large" color="#7c3aed" />
                        <Text className="mt-3 text-gray-600">Loading sales data...</Text>
                    </View>
                ) : error ? (
                    <View className="flex-1 bg-red-50 border border-red-200 px-4 py-3 rounded-lg justify-center items-center">
                        <Text className="text-red-700 font-medium">
                            Error loading report.
                        </Text>
                    </View>
                ) : (
                    <>
                        {data?.result?.length ? (
                            <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                                <FlatList
                                    data={data.result}
                                    keyExtractor={(item) => item.bill_number.toString()}
                                    ListHeaderComponent={() => (
                                        <View className="flex-row bg-gray-100/80 border-b border-gray-200 px-4 py-3">
                                            <Text className="flex-[1.1] text-xs font-semibold text-gray-600 uppercase">
                                                Date
                                            </Text>
                                            <Text className="flex-[1.2] text-xs font-semibold text-center text-gray-600 uppercase">
                                                Dealer
                                            </Text>
                                            <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">
                                                Bill No.
                                            </Text>
                                            <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">
                                                Cnt
                                            </Text>
                                            <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">
                                                D. Amt
                                            </Text>
                                            <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">
                                                C. Amt
                                            </Text>
                                        </View>
                                    )}
                                    renderItem={({ item, index }) => (
                                        <View className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                            {/* ------------ main bill row ------------ */}
                                            <View className="flex-row px-4 py-3 items-center border-b border-gray-100">
                                                <View className="flex-[1.1] flex-col justify-center">
                                                    <Text className="text-[10px] text-gray-800 font-medium">
                                                        {formatDateDDMMYYYY(new Date(item.date_time))}
                                                    </Text>
                                                    <Text className="text-[9px] text-gray-500 mt-0.5">
                                                        {new Date(item.date_time).toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                            hour12: false,
                                                        })}
                                                    </Text>
                                                </View>
                                                <Text className="flex-[1.2] text-sm text-center text-gray-700">
                                                    {item.dealer.username}
                                                </Text>
                                                <Text className="flex-1 text-sm text-center text-gray-700">
                                                    {item.bill_number}
                                                </Text>
                                                <Text className="flex-1 text-sm text-center text-gray-700">
                                                    {item.bill_count}
                                                </Text>
                                                <Text className="flex-1 text-sm text-right text-violet-700 font-semibold">
                                                    {item.dealer_amount.toFixed(2)}
                                                </Text>
                                                <Text className="flex-1 text-sm text-right text-emerald-700 font-semibold">
                                                    {item.customer_amount.toFixed(2)}
                                                </Text>
                                            </View>

                                            {/* ------------ optional detail rows (Full View) ------------ */}
                                            {fullView &&
                                                item.booking_details?.map((d) => (
                                                    <View
                                                        key={d.id}
                                                        className="flex-row px-4 py-2 bg-amber-50/20 border-b border-amber-100 last:border-b-0"
                                                    >
                                                        <Text className="flex-[1.1] text-[10px] text-gray-600">
                                                            {d.sub_type}
                                                        </Text>
                                                        <Text className="flex-[1.2] text-[10px] text-center text-gray-600">
                                                            {d.number}
                                                        </Text>
                                                        <Text className="flex-1 text-[10px] text-center text-gray-600">
                                                            {d.count}
                                                        </Text>
                                                        <Text className="flex-1 text-[10px] text-center text-gray-600">
                                                            {d.amount}
                                                        </Text>
                                                        <Text className="flex-1 text-[10px] text-right text-violet-600">
                                                            {d.dealer_amount.toFixed(2)}
                                                        </Text>
                                                        <Text className="flex-1 text-[10px] text-right text-emerald-600">
                                                            {d.agent_amount.toFixed(2)}
                                                        </Text>
                                                    </View>
                                                ))}
                                        </View>
                                    )}
                                    ListEmptyComponent={
                                        <View className="flex-1 justify-center items-center py-16">
                                            <Text className="text-gray-500 text-base">
                                                No sales data for current filters.
                                            </Text>
                                        </View>
                                    }
                                />
                            </View>
                        ) : (
                            <View className="flex-1 justify-center items-center">
                                <Text className="text-gray-500">No sales data available.</Text>
                            </View>
                        )}
                    </>
                )}

                {/* --- Total Footer (always at the bottom if applicable) --- */}
                {shouldShowTotalFooter && (
                    <View className="border-t border-gray-200 py-3 bg-gray-100 px-4 mt-4 rounded-lg">
                        <View className="flex-row">
                            <Text className="flex-1 font-bold text-sm text-gray-800">TOTAL</Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm text-center font-semibold text-gray-700">
                                {data?.total_bill_count || 0}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-violet-700">
                                {data?.total_dealer_amount || 0}
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-emerald-700">
                                {data?.total_customer_amount || 0}
                            </Text>
                        </View>
                    </View>
                )}

                {/* --- Date Pickers --- */}
                {showFromPicker && (
                    <DateTimePicker
                        mode="date"
                        value={fromDate || getToday()}
                        onChange={(event, date) => {
                            if (date) setFromDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
                            setShowFromPicker(false);
                        }}
                    />
                )}
                {showToPicker && (
                    <DateTimePicker
                        mode="date"
                        value={toDate || getToday()}
                        onChange={(event, date) => {
                            if (date) setToDate(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
                            setShowToPicker(false);
                        }}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default SalesReportScreen;