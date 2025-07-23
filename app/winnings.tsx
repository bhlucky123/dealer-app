import { useAuthStore } from "@/store/auth";
import useDrawStore from "@/store/draw";
import api from "@/utils/axios";
import { getToday, getTommorow } from "@/utils/date";
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

// Update WinnerReport type to allow dealer/agent to be string or object (for type safety)
type WinnerReport = {
    customer_name: string;
    bill_number: number;
    prize: number;
    win_number: string;
    count: string;
    lsk: string;
    draw: string;
    dealer: string | { id: number; username: string; user_type: string; commission: number; single_digit_number_commission: number; cap_amount: number };
    agent: string | { id: number; username: string; user_type: string; commission: number; single_digit_number_commission: number; cap_amount: number } | null;
    booking_datetime?: string; // Add this if your API returns a date field
};

// Helper function to format date as dd/mm/yyyy
function formatDateToDDMMYYYY(date: Date | string | undefined | null): string {
    if (!date) return "";
    let d: Date;
    if (typeof date === "string") {
        d = new Date(date);
    } else {
        d = date;
    }
    if (isNaN(d.getTime())) return "";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

const WinnersReportScreen = () => {
    const { selectedDraw } = useDrawStore();
    const [search, setSearch] = useState("");
    const [fromDate, setFromDate] = useState<Date>(getToday());
    const [toDate, setToDate] = useState<Date>(getTommorow());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [fullView, setFullView] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState("");
    const [selectedDealer, setSelectedDealer] = useState("");

    const { user } = useAuthStore();

    // QueryClient for caching
    const queryClient = useQueryClient();
    const cachedAgents = queryClient.getQueryData<Agent[]>(["agents"]);
    const cachedDealers = queryClient.getQueryData<Agent[]>(["dealers"]);

    // Fetch agents if user is DEALER
    const {
        data: agents = [],
        isLoading: isAgentLoading,
    } = useQuery<Agent[]>({
        queryKey: ["agents"],
        queryFn: () => api.get("/agent/manage/").then((res) => res.data),
        enabled: user?.user_type === "DEALER" && !cachedAgents,
        initialData: user?.user_type === "DEALER" ? cachedAgents : undefined,
    });

    // Fetch dealers if user is ADMIN
    const {
        data: dealers = [],
        isLoading: isDealerLoading,
    } = useQuery<Agent[]>({
        queryKey: ["dealers"],
        queryFn: () => api.get("/administrator/dealer/").then((res) => res.data),
        enabled: user?.user_type === "ADMIN" && !cachedDealers,
        initialData: user?.user_type === "ADMIN" ? cachedDealers : undefined,
    });

    // Build query params
    const buildQuery = () => {
        const params: Record<string, string> = {};
        if (fromDate) params["date_time__gte"] = fromDate.toISOString();
        if (toDate) params["date_time__lte"] = toDate.toISOString();
        if (fullView) params["full_view"] = "true";
        if (user?.user_type === "DEALER" && selectedAgent)
            params["booked_agent__id"] = selectedAgent;
        if (user?.user_type === "ADMIN" && selectedDealer)
            params["booked_agent__id"] = selectedDealer;
        if (selectedDraw?.id) params["draw_session__draw__id"] = String(selectedDraw.id);

        return Object.keys(params)
            .map(key => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
            .join("&");
    };

    const { data = [], isLoading, error } = useQuery<WinnerReport[]>({
        queryKey: ["/draw-result/winners/", buildQuery()],
        queryFn: async () => {
            const res = await api.get(`/draw-result/winners/?${buildQuery()}`);
            return res.data;
        },
        enabled: !!selectedDraw?.id,
    });

    console.log("winners", data);


    // Determine if we should show the total footer
    const shouldShowTotalFooter = !!selectedDraw?.id && !isLoading && !error && data;

    // Helper to safely get username from dealer/agent (string or object)
    const getUsername = (userField: any) => {
        if (!userField) return "";
        if (typeof userField === "string") return userField;
        if (typeof userField === "object" && userField.username) return userField.username;
        return "";
    };

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

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={() => setShowFromPicker(true)}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                        >
                            <Text className="text-gray-700">
                                From:{" "}
                                <Text
                                    className={fromDate ? "text-gray-900 font-medium" : "text-gray-500"}
                                >
                                    {formatDateToDDMMYYYY(fromDate) || "Select Date"}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => setShowToPicker(true)}
                            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 active:bg-gray-50"
                        >
                            <Text className="text-gray-700">
                                To:{" "}
                                <Text
                                    className={toDate ? "text-gray-900 font-medium" : "text-gray-500"}
                                >
                                    {formatDateToDDMMYYYY(toDate) || "Select Date"}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Show agent/dealer filter only for DEALER or ADMIN */}
                    {user?.user_type === "DEALER" && (
                        <RNPickerSelect
                            onValueChange={setSelectedAgent}
                            items={[
                                ...agents.map((agent) => ({
                                    label: agent.username,
                                    value: agent.id,
                                    key: agent.id.toString(),
                                })),
                            ]}
                            value={selectedAgent}
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
                                selectedAgent !== null && selectedAgent !== "" ? (
                                    <TouchableOpacity
                                        onPress={() => setSelectedAgent("")}
                                        style={{ position: "absolute", right: 10, top: 12, zIndex: 10 }}
                                        className="bg-white w-10 h-10 flex items-center"
                                    >
                                        <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
                                    </TouchableOpacity>
                                ) : null
                            }
                        />
                    )}
                    {user?.user_type === "ADMIN" && (
                        <RNPickerSelect
                            onValueChange={setSelectedDealer}
                            items={[
                                ...dealers.map((dealer) => ({
                                    label: dealer.username,
                                    value: dealer.id,
                                    key: dealer.id.toString(),
                                })),
                            ]}
                            value={selectedDealer}
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
                                selectedDealer !== null && selectedDealer !== "" ? (
                                    <TouchableOpacity
                                        onPress={() => setSelectedDealer("")}
                                        style={{ position: "absolute", right: 10, top: 12, zIndex: 10 }}
                                        className="bg-white w-10 h-10 flex items-center"
                                    >
                                        <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
                                    </TouchableOpacity>
                                ) : null
                            }
                        />
                    )}

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
                        <Text className="mt-3 text-gray-600">Loading Winners data...</Text>
                    </View>
                ) : error ? (
                    <View className="flex-1 bg-red-50 border border-red-200 px-4 py-3 rounded-lg justify-center items-center">
                        <Text className="text-red-700 font-medium">
                            Error loading report.
                        </Text>
                    </View>
                ) : (
                    <View className="flex-1 rounded-2xl bg-white shadow-sm border border-gray-200 overflow-hidden">
                        <FlatList
                            data={data || []}
                            keyExtractor={(item, index) => item?.bill_number?.toString() || index?.toString()}
                            ListHeaderComponent={() => (
                                <View className="flex-row bg-gray-100/80 border-b border-gray-200 px-4 py-3">
                                    <Text className="flex-[1.1] text-xs font-semibold text-gray-600 uppercase">Date</Text>
                                    <Text className="flex-[1.2] text-xs font-semibold text-center text-gray-600 uppercase">Game</Text>
                                    <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Number</Text>
                                    <Text className="flex-1 text-xs font-semibold text-center text-gray-600 uppercase">Dealer</Text>
                                    <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">Prize</Text>
                                    <Text className="flex-1 text-xs font-semibold text-right text-gray-600 uppercase">Amount</Text>
                                </View>
                            )}
                            renderItem={({ item, index }) => (
                                <View
                                    className={[
                                        "px-4 py-2 border-b border-gray-100",
                                        index % 2 === 0 ? "bg-white" : "bg-gray-50"
                                    ].join(" ")}
                                    style={{
                                        marginBottom: 6,
                                        borderRadius: 10,
                                        marginHorizontal: 6,
                                        shadowColor: "#000",
                                        shadowOpacity: 0.03,
                                        shadowRadius: 2,
                                        elevation: 1,
                                    }}
                                >
                                    {/* Top Row: Date, Game, Dealer */}
                                    <View className="flex-row items-center mb-1">
                                        <View className="flex-[1.1]">
                                            <Text className="text-xs text-gray-700 font-semibold">
                                                {item.booking_datetime ? formatDateToDDMMYYYY(item.booking_datetime) : ""}
                                            </Text>
                                            <Text className="text-[10px] text-gray-400">
                                                Bill #{item.bill_number}
                                            </Text>
                                        </View>
                                        <Text className="flex-[1.2] text-xs text-center text-violet-700 font-semibold">
                                            {item.draw}
                                        </Text>
                                        <View className="flex-1 items-center">
                                            <Text className="text-xs text-center text-gray-700 font-semibold">
                                                {getUsername(item.dealer)}
                                            </Text>
                                            {item.agent && (
                                                <Text className="text-[10px] text-center text-gray-400">
                                                    Agent: {getUsername(item.agent)}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    <View className="h-[1px] bg-gray-200 my-1" />
                                    {/* Bottom Row: Number, LSK, Count, Prize, Amount */}
                                    <View className="flex-row items-center">
                                        <View className="flex-1 items-center">
                                            <Text className="text-base text-center text-emerald-700 font-bold tracking-widest">
                                                {item.win_number}
                                            </Text>
                                            <Text className="text-xs text-center text-gray-500">
                                                {item.lsk}
                                            </Text>
                                            <Text className="text-[11px] text-center text-gray-400">
                                                Count: <Text className="font-semibold">{item.count}</Text>
                                            </Text>
                                        </View>
                                        <View className="flex-1 items-end">
                                            <Text className="text-sm text-right text-violet-700 font-bold">
                                                ₹{item.prize.toLocaleString()}
                                            </Text>
                                            <Text className="text-xs text-right text-emerald-700 font-semibold">
                                                Amount: ₹{item.prize.toLocaleString()}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                            ListEmptyComponent={
                                <View className="flex-1 justify-center items-center py-16">
                                    <Text className="text-gray-500 text-base">
                                        No Winner's data available.
                                    </Text>
                                </View>
                            }
                        />
                    </View>
                )}

                {/* --- Total Footer (always at the bottom if applicable) --- */}
                {shouldShowTotalFooter && (
                    <View className="border-t border-gray-200 py-3 bg-gray-100 px-4 mt-4 rounded-lg">
                        <View className="flex-row">
                            <Text className="flex-1 font-bold text-sm text-gray-800">TOTAL</Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm"> </Text>
                            <Text className="flex-1 text-sm text-center font-semibold text-gray-700">
                                {/* These fields are not available on WinnerReport[]; adjust as needed */}
                                {/* {data?.total_bill_count || 0} */}
                                0
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-violet-700">
                                {/* {data?.total_dealer_amount || 0} */}
                                0
                            </Text>
                            <Text className="flex-1 text-sm text-right font-semibold text-emerald-700">
                                {/* {data?.total_customer_amount || 0} */}
                                0
                            </Text>
                        </View>
                    </View>
                )}

                {/* --- Date Pickers --- */}
                {showFromPicker && (
                    <DateTimePicker
                        mode="date"
                        value={fromDate || new Date()}
                        onChange={(event, date) => {
                            if (date) setFromDate(date);
                            setShowFromPicker(false);
                        }}
                    />
                )}
                {showToPicker && (
                    <DateTimePicker
                        mode="date"
                        value={toDate || new Date()}
                        onChange={(event, date) => {
                            if (date) setToDate(date);
                            setShowToPicker(false);
                        }}
                    />
                )}
            </View>
        </SafeAreaView>
    );
};

export default WinnersReportScreen;